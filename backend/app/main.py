"""
FastAPI main application
"""
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
    await create_pool()
    await ensure_tables()
    print("✓ PostgreSQL connection pool initialized")
    print("✓ Database tables ensured")
    yield
    # Shutdown
    await close_pool()
    print("✓ PostgreSQL connection pool closed")


# Create FastAPI app
app = FastAPI(
    title="Polymarket Trading Dashboard API",
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
        "name": "Polymarket Trading Dashboard API",
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
        db_status = f"unhealthy: {str(e)}"

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
