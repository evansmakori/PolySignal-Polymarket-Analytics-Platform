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



async def _init_db_and_jobs():
    """Initialize DB pool and background jobs — runs in background after startup."""
    # Retry DB connection with delay to avoid exhausting connections at startup
    for attempt in range(1, 11):
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
            print(f"✓ Database pool created on attempt {attempt}")
            print("✓ PostgreSQL connection pool initialized")
            print("✓ Database tables ensured")
            break
        except Exception as e:
            print(f"⚠ DB connection attempt {attempt}/10 failed: {e}")
            if attempt < 10:
                await asyncio.sleep(3)
            else:
                print("⚠ Database initialization warning: could not connect after 10 attempts")
                return

    enable_jobs = settings.ENABLE_BACKGROUND_JOBS
    if enable_jobs:
        from .core.lifecycle import (
            run_daily_lifecycle_job,
            run_score_backfill_job,
            run_active_event_refresh_job,
        )
        asyncio.create_task(run_daily_lifecycle_job())
        asyncio.create_task(run_score_backfill_job())
        asyncio.create_task(run_active_event_refresh_job())
        print("✓ Lifecycle manager started")
        print("✓ Score backfill job started (runs every 5 minutes)")
        print("✓ Active event refresh job started (runs every 5 minutes)")
    else:
        print("✓ Background jobs disabled (set ENABLE_BACKGROUND_JOBS=true to enable)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan: start up and shut down."""
    # Start DB init in background so app starts immediately even if DB is busy
    asyncio.create_task(_init_db_and_jobs())
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
# Note: CORSMiddleware does not apply to WebSocket connections in FastAPI/Starlette.
# WebSocket 403s are caused by the middleware checking Origin against allowed_origins.
# Using allow_origins=["*"] with allow_credentials=False fixes this.
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse
from starlette.types import ASGIApp

class WebSocketCORSBypassMiddleware(BaseHTTPMiddleware):
    """Allow WebSocket upgrade requests to bypass CORS checks."""
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.headers.get("upgrade", "").lower() == "websocket":
            # Pass WebSocket upgrades through without CORS checks
            return await call_next(request)
        return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(WebSocketCORSBypassMiddleware)

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
