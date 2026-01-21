#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for database to be ready
wait_for_db() {
    log_info "Waiting for database to be ready..."
    
    # Extract host and port from DATABASE_URL_SYNC
    # Format: postgresql://user:pass@host:port/dbname
    if [ -n "$DATABASE_URL_SYNC" ]; then
        DB_HOST=$(echo $DATABASE_URL_SYNC | sed -n 's/.*@\([^:\/]*\).*/\1/p')
        DB_PORT=$(echo $DATABASE_URL_SYNC | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        
        if [ -z "$DB_PORT" ]; then
            DB_PORT=5432
        fi
        
        log_info "Checking connection to $DB_HOST:$DB_PORT..."
        
        max_attempts=30
        attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if python -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
    s.connect(('$DB_HOST', $DB_PORT))
    s.close()
    exit(0)
except:
    exit(1)
" 2>/dev/null; then
                log_info "Database is ready!"
                return 0
            fi
            
            log_warn "Attempt $attempt/$max_attempts: Database not ready, waiting..."
            sleep 2
            attempt=$((attempt + 1))
        done
        
        log_error "Database not ready after $max_attempts attempts"
        return 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd /app
    
    if [ -f "alembic.ini" ]; then
        log_info "Running Alembic migrations..."
        alembic upgrade head
        
        if [ $? -eq 0 ]; then
            log_info "Migrations completed successfully!"
        else
            log_error "Alembic migrations failed, trying direct schema updates..."
            python -c "
from src.main import run_direct_schema_updates
from src.config import get_settings
settings = get_settings()
run_direct_schema_updates(settings.database_url_sync)
"
        fi
    else
        log_warn "No alembic.ini found, running direct schema updates..."
        python -c "
from src.main import run_direct_schema_updates
from src.config import get_settings
settings = get_settings()
run_direct_schema_updates(settings.database_url_sync)
"
    fi
}

# Seed the database
seed_database() {
    log_info "Seeding database..."
    
    python -c "
import asyncio
from src.database import get_db_context
from src.seed import seed_database

async def run_seed():
    async with get_db_context() as db:
        result = await seed_database(db)
        if result.get('skipped'):
            print('Database already seeded, skipping...')
        else:
            print(f'Seeded: {result}')

asyncio.run(run_seed())
"
    
    if [ $? -eq 0 ]; then
        log_info "Database seeding completed!"
    else
        log_warn "Database seeding encountered issues (may already be seeded)"
    fi
}

# Main entrypoint logic
case "$1" in
    migrate)
        wait_for_db
        run_migrations
        ;;
    
    seed)
        wait_for_db
        seed_database
        ;;
    
    migrate-and-seed)
        wait_for_db
        run_migrations
        seed_database
        ;;
    
    serve)
        wait_for_db
        run_migrations
        
        if [ "$AUTO_SEED" = "true" ] || [ "$AUTO_SEED" = "True" ] || [ "$AUTO_SEED" = "1" ]; then
            seed_database
        fi
        
        log_info "Starting Heliox Gateway API..."
        exec python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
        ;;
    
    dev)
        wait_for_db
        run_migrations
        seed_database
        
        log_info "Starting Heliox Gateway API in development mode..."
        exec python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --reload
        ;;
    
    test)
        log_info "Running tests..."
        exec python -m pytest tests/ -v
        ;;
    
    shell)
        log_info "Starting Python shell..."
        exec python
        ;;
    
    bash)
        log_info "Starting bash shell..."
        exec /bin/bash
        ;;
    
    *)
        # If command not recognized, just execute it
        exec "$@"
        ;;
esac
