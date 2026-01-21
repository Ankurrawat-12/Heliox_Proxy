"""Main FastAPI application entry point."""

# IMPORTANT: Run schema updates BEFORE any ORM models are imported
# This ensures database schema matches what SQLAlchemy expects
import src.bootstrap  # noqa: F401 - runs schema updates on import

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from src import __version__
from src.api.admin import router as admin_router
from src.api.algorithms import router as algorithms_router
from src.api.auth import router as auth_router
from src.api.gateway import router as gateway_router
from src.api.health import router as health_router
from src.api.payment import router as payment_router
from src.api.portal import router as portal_router
from src.config import get_settings
from src.database import close_db, get_db_context, init_db
from src.gateway.proxy import gateway_proxy
from src.middleware.logging import LoggingMiddleware, setup_logging
from src.middleware.request_id import RequestIdMiddleware
from src.services.redis_client import redis_client

logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """Run database migrations/schema updates on startup."""
    import subprocess
    import os
    
    settings = get_settings()
    
    # Get the directory where alembic.ini is located
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_ini = os.path.join(base_dir, "alembic.ini")
    
    if os.path.exists(alembic_ini):
        logger.info("Running database migrations...")
        logger.info(f"Using database: {settings.database_url_sync[:50]}...")
        try:
            # Pass environment with current env + ensure DATABASE_URL is set
            env = os.environ.copy()
            env["DATABASE_URL"] = settings.database_url
            env["DATABASE_URL_SYNC"] = settings.database_url_sync
            
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                cwd=base_dir,
                capture_output=True,
                text=True,
                env=env,
            )
            if result.returncode == 0:
                logger.info("Migrations completed successfully")
                if result.stdout:
                    logger.info(f"Migration output: {result.stdout}")
            else:
                logger.error(f"Migration failed with code {result.returncode}")
                logger.error(f"Migration stdout: {result.stdout}")
                logger.error(f"Migration stderr: {result.stderr}")
                # Fall back to direct SQL
                run_direct_schema_updates(settings.database_url_sync)
        except Exception as e:
            logger.error(f"Could not run migrations: {e}")
            # Fall back to direct SQL
            run_direct_schema_updates(settings.database_url_sync)
    else:
        logger.info(f"No alembic.ini found at {alembic_ini}, running direct schema updates")
        run_direct_schema_updates(settings.database_url_sync)


def run_direct_schema_updates(database_url: str) -> None:
    """Run direct SQL schema updates as fallback."""
    from sqlalchemy import create_engine, text
    
    logger.info("Running direct schema updates...")
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Check and create plans table
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'plans'
                )
            """))
            plans_exists = result.scalar()
            
            if not plans_exists:
                logger.info("Creating plans table...")
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS plans (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        name VARCHAR(100) NOT NULL UNIQUE,
                        tier VARCHAR(20) NOT NULL DEFAULT 'free',
                        description VARCHAR(500),
                        price_monthly_cents INTEGER DEFAULT 0,
                        quota_daily INTEGER DEFAULT 1000,
                        quota_monthly INTEGER DEFAULT 10000,
                        rate_limit_rps FLOAT DEFAULT 10.0,
                        rate_limit_burst INTEGER DEFAULT 20,
                        max_api_keys INTEGER DEFAULT 2,
                        max_routes INTEGER DEFAULT 5,
                        cache_enabled BOOLEAN DEFAULT TRUE,
                        analytics_enabled BOOLEAN DEFAULT FALSE,
                        priority_support BOOLEAN DEFAULT FALSE,
                        custom_domains BOOLEAN DEFAULT FALSE,
                        razorpay_plan_id VARCHAR(255) UNIQUE,
                        stripe_price_id VARCHAR(255) UNIQUE,
                        is_active BOOLEAN DEFAULT TRUE,
                        is_default BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """))
                conn.commit()
                
                # Seed default plans
                logger.info("Seeding default plans...")
                conn.execute(text("""
                    INSERT INTO plans (name, tier, description, price_monthly_cents, quota_daily, quota_monthly, 
                                      rate_limit_rps, rate_limit_burst, max_api_keys, max_routes,
                                      cache_enabled, analytics_enabled, priority_support, custom_domains, is_active, is_default)
                    VALUES 
                    ('Free', 'free', 'Perfect for testing and small projects', 
                     0, 1000, 10000, 10.0, 20, 2, 5, true, false, false, false, true, true),
                    ('Pro', 'pro', 'For growing applications and teams', 
                     2900, 50000, 500000, 100.0, 200, 10, 25, true, true, false, false, true, false),
                    ('Enterprise', 'enterprise', 'For large-scale production workloads', 
                     19900, 0, 0, 1000.0, 2000, 0, 0, true, true, true, true, true, false)
                    ON CONFLICT (name) DO NOTHING
                """))
                conn.commit()
            
            # Check and add payment columns to plans table
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'plans' AND column_name = 'razorpay_plan_id'
                )
            """))
            razorpay_plan_id_exists = result.scalar()
            
            if not razorpay_plan_id_exists:
                logger.info("Adding payment columns to plans table...")
                conn.execute(text("""
                    ALTER TABLE plans 
                    ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(255) UNIQUE,
                    ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255) UNIQUE
                """))
                conn.commit()
            
            # Check and add plan_id to tenants
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'tenants' AND column_name = 'plan_id'
                )
            """))
            plan_id_exists = result.scalar()
            
            if not plan_id_exists:
                logger.info("Adding plan_id to tenants table...")
                conn.execute(text("""
                    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL
                """))
                conn.commit()
                
                # Set default plan for existing tenants
                conn.execute(text("""
                    UPDATE tenants SET plan_id = (SELECT id FROM plans WHERE is_default = true LIMIT 1)
                    WHERE plan_id IS NULL
                """))
                conn.commit()
            
            # Check and add Razorpay columns to tenants
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'tenants' AND column_name = 'razorpay_customer_id'
                )
            """))
            razorpay_exists = result.scalar()
            
            if not razorpay_exists:
                logger.info("Adding Razorpay columns to tenants table...")
                conn.execute(text("""
                    ALTER TABLE tenants 
                    ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255)
                """))
                conn.commit()
            
            # Check and create users table
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                )
            """))
            users_exists = result.scalar()
            
            if not users_exists:
                logger.info("Creating users table...")
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email VARCHAR(255) NOT NULL UNIQUE,
                        password_hash VARCHAR(255),
                        name VARCHAR(255) NOT NULL,
                        avatar_url VARCHAR(500),
                        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
                        role VARCHAR(20) NOT NULL DEFAULT 'member',
                        google_id VARCHAR(255) UNIQUE,
                        github_id VARCHAR(255) UNIQUE,
                        email_verified BOOLEAN DEFAULT FALSE,
                        email_verification_token VARCHAR(255),
                        email_verification_expires TIMESTAMPTZ,
                        password_reset_token VARCHAR(255),
                        password_reset_expires TIMESTAMPTZ,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        last_login_at TIMESTAMPTZ
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users(tenant_id)"))
                conn.commit()
            
            logger.info("Direct schema updates completed successfully")
            
    except Exception as e:
        logger.error(f"Direct schema updates failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan handler."""
    settings = get_settings()
    
    # Startup
    setup_logging()
    
    # Run database migrations
    run_migrations()
    
    # Connect to Redis
    await redis_client.connect()
    
    # Initialize database (create tables if needed)
    await init_db()
    
    # Auto-seed database if enabled
    if settings.auto_seed:
        from src.seed import seed_database
        async with get_db_context() as db:
            result = await seed_database(db)
            if not result.get("skipped"):
                logger.info(f"Auto-seeded database: {result}")
    
    yield
    
    # Shutdown
    await gateway_proxy.close()
    await redis_client.disconnect()
    await close_db()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Heliox Gateway",
        description="Production-grade API Gateway with caching, rate limiting, and abuse detection",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add custom middleware (order matters - first added is outermost)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)
    
    # Include routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(payment_router)
    app.include_router(portal_router)
    app.include_router(gateway_router)
    app.include_router(admin_router)
    app.include_router(algorithms_router)
    
    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
