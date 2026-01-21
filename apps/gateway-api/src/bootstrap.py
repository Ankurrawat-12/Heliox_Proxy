"""Bootstrap module - runs schema updates before anything else loads."""

import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_database_url_sync() -> str:
    """Get sync database URL from environment."""
    database_url = os.environ.get("DATABASE_URL", "")
    database_url_sync = os.environ.get("DATABASE_URL_SYNC", "")
    
    if database_url_sync:
        return database_url_sync
    
    if database_url:
        return database_url.replace("postgresql+asyncpg://", "postgresql://")
    
    return "postgresql://heliox:heliox_password@localhost:5432/heliox"


def run_schema_updates() -> None:
    """Run schema updates directly via SQL before ORM loads."""
    from sqlalchemy import create_engine, text
    
    database_url = get_database_url_sync()
    logger.info(f"Running schema updates on: {database_url[:50]}...")
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # =====================================================================
            # PLANS TABLE
            # =====================================================================
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
            else:
                # Plans table exists - check for missing columns
                result = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'plans' AND column_name = 'razorpay_plan_id'
                    )
                """))
                if not result.scalar():
                    logger.info("Adding razorpay_plan_id to plans...")
                    conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(255)"))
                    conn.commit()
                
                result = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'plans' AND column_name = 'stripe_price_id'
                    )
                """))
                if not result.scalar():
                    logger.info("Adding stripe_price_id to plans...")
                    conn.execute(text("ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255)"))
                    conn.commit()
            
            # =====================================================================
            # TENANTS TABLE UPDATES
            # =====================================================================
            
            # Add all potentially missing columns to tenants table
            tenant_columns = [
                ("plan_id", "UUID REFERENCES plans(id) ON DELETE SET NULL"),
                ("billing_email", "VARCHAR(255)"),
                ("stripe_customer_id", "VARCHAR(255)"),
                ("stripe_subscription_id", "VARCHAR(255)"),
                ("razorpay_customer_id", "VARCHAR(255)"),
                ("razorpay_subscription_id", "VARCHAR(255)"),
                ("razorpay_payment_id", "VARCHAR(255)"),
            ]
            
            for col_name, col_type in tenant_columns:
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'tenants' AND column_name = '{col_name}'
                    )
                """))
                if not result.scalar():
                    logger.info(f"Adding {col_name} to tenants...")
                    conn.execute(text(f"ALTER TABLE tenants ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                    conn.commit()
            
            # Set default plan for existing tenants without one
            conn.execute(text("""
                UPDATE tenants SET plan_id = (SELECT id FROM plans WHERE is_default = true LIMIT 1)
                WHERE plan_id IS NULL
            """))
            conn.commit()
            
            # =====================================================================
            # USERS TABLE
            # =====================================================================
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                )
            """))
            if not result.scalar():
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
                        google_id VARCHAR(255),
                        github_id VARCHAR(255),
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
            
            # =====================================================================
            # ENSURE ADMIN USER EXISTS
            # =====================================================================
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM users WHERE role = 'admin'
                )
            """))
            admin_exists = result.scalar()
            
            if not admin_exists:
                import bcrypt
                admin_email = os.environ.get("ADMIN_EMAIL", "admin@heliox.dev")
                admin_password = os.environ.get("ADMIN_PASSWORD", "admin123456")
                admin_name = os.environ.get("ADMIN_NAME", "Heliox Admin")
                
                # Hash password
                password_hash = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
                
                logger.info(f"Creating admin user: {admin_email}")
                conn.execute(text("""
                    INSERT INTO users (email, password_hash, name, role, email_verified, is_active)
                    VALUES (:email, :password_hash, :name, 'admin', true, true)
                    ON CONFLICT (email) DO UPDATE SET role = 'admin'
                """), {"email": admin_email, "password_hash": password_hash, "name": admin_name})
                conn.commit()
                logger.info(f"Admin user created successfully!")
            
            logger.info("Schema updates completed successfully!")
            
    except Exception as e:
        logger.error(f"Schema updates failed: {e}")
        # Don't raise - let the app try to start anyway


# Run schema updates when this module is imported
run_schema_updates()
