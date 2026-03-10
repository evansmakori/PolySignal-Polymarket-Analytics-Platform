"""
FastAPI main application
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import create_pool, close_pool, ensure_tables
from .api.markets import router as markets_router
from .api.websocket import router as websocket_router
from .api.ai import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan: start up and shut down."""
    # Startup
    try:
        await create_pool()
        from .core.database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            try:
                await conn.execute("GRANT ALL ON SCHEMA public TO CURRENT_USER")
            except Exception:
                pass
            try:
                await conn.execute("SET search_path TO public")
            except Exception:
                pass
        await ensure_tables()
        print("✓ PostgreSQL connection pool initialized")
        print("✓ Database tables ensured")

        # Start daily lifecycle manager background job
        from .core.lifecycle import run_daily_lifecycle_job
        asyncio.create_task(run_daily_lifecycle_job())
        print("✓ Lifecycle manager started")

        # Backfill any markets with NULL predictive_score on startup
        try:
            from .core.scoring import calculate_market_score
            from .core.database import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                null_markets = await conn.fetch("""
                    SELECT DISTINCT ON (market_id) market_id, liquidity, spread,
                        volume_24h, volume_total, price_change_1d, volatility,
                        expected_value, kelly_fraction, orderbook_imbalance,
                        sentiment_momentum
                    FROM polymarket_market_stats
                    WHERE predictive_score IS NULL OR predictive_score < 1.0
                    ORDER BY market_id, snapshot_ts DESC
                """)
                updated = 0
                for row in null_markets:
                    try:
                        import math
                        score_result = calculate_market_score(dict(row))
                        score = score_result.get("score")
                        category = score_result.get("category", "Neutral / Watchlist")
                        liq = float(row.get("liquidity") or 1)
                        vol = float(row.get("volume_total") or 1)
                        if score is None or score < 1.0:
                            liq_score = min(100.0, max(0.0, math.log10(max(liq, 1)) / math.log10(1_000_000) * 100))
                            vol_score = min(100.0, max(0.0, math.log10(max(vol, 1)) / math.log10(10_000_000) * 100))
                            score = round(max(1.0, liq_score * 0.6 + vol_score * 0.4), 2)
                            category = "Neutral / Watchlist"
                        await conn.execute("""
                            UPDATE polymarket_market_stats
                            SET predictive_score = $1, score_category = $2
                            WHERE market_id = $3 AND (predictive_score IS NULL OR predictive_score < 1.0)
                        """, score, category, row["market_id"])
                        updated += 1
                    except Exception:
                        pass
                if updated:
                    print(f"✓ Backfilled scores for {updated} markets with NULL scores")
        except Exception as e:
            print(f"⚠ Score backfill warning: {e}")
    except Exception as e:
        print(f"⚠ Database initialization warning: {e}")
    yield
    # Shutdown
    try:
        await close_pool()
        print("✓ PostgreSQL connection pool closed")
    except Exception:
        pass


# Create FastAPI app
app = FastAPI(
    title="PolySignal — Polymarket Analytics Platform API",
    description="Real-time analytics and trading signals for Polymarket prediction markets",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(markets_router)
app.include_router(websocket_router)
app.include_router(ai_router)


@app.get("/")
async def root():
    """Root endpoint - API information."""
    return {
        "name": "PolySignal — Polymarket Analytics Platform API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from .core.database import get_pool
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unavailable: {str(e)}"

    return {
        "status": "ok",
        "database": db_status,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
    )
