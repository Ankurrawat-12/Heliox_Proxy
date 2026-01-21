# Heliox Proxy - Docker Commands
# ================================

.PHONY: help build up down restart logs shell migrate seed test clean

# Default target
help:
	@echo "Heliox Proxy - Available Commands"
	@echo "=================================="
	@echo ""
	@echo "Docker Commands:"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make build       - Build all Docker images"
	@echo "  make rebuild     - Force rebuild all images"
	@echo "  make logs        - View logs from all services"
	@echo "  make logs-api    - View logs from gateway-api only"
	@echo ""
	@echo "Database Commands:"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed the database"
	@echo "  make db-reset    - Reset database (DESTRUCTIVE)"
	@echo ""
	@echo "Development:"
	@echo "  make shell       - Open Python shell in gateway-api"
	@echo "  make bash        - Open bash shell in gateway-api"
	@echo "  make test        - Run tests"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean       - Remove containers and volumes"
	@echo "  make clean-all   - Remove everything including images"

# =============================================================================
# Docker Commands
# =============================================================================

# Start all services
up:
	@echo "Starting Heliox services..."
	cd infra && docker compose up -d
	@echo ""
	@echo "Services started! Access:"
	@echo "  - Gateway API: http://localhost:8000"
	@echo "  - Admin UI:    http://localhost:3000"
	@echo "  - API Docs:    http://localhost:8000/docs"

# Start with logs
up-logs:
	cd infra && docker compose up

# Stop all services
down:
	@echo "Stopping Heliox services..."
	cd infra && docker compose down

# Restart all services
restart: down up

# Build images
build:
	@echo "Building Docker images..."
	cd infra && docker compose build

# Force rebuild
rebuild:
	@echo "Rebuilding Docker images..."
	cd infra && docker compose build --no-cache

# View logs
logs:
	cd infra && docker compose logs -f

logs-api:
	cd infra && docker compose logs -f gateway-api

logs-migrate:
	cd infra && docker compose logs migrate

# =============================================================================
# Database Commands
# =============================================================================

# Run migrations only
migrate:
	@echo "Running database migrations..."
	cd infra && docker compose run --rm migrate migrate

# Seed database
seed:
	@echo "Seeding database..."
	cd infra && docker compose run --rm migrate seed

# Run migrations and seed
migrate-seed:
	@echo "Running migrations and seeding..."
	cd infra && docker compose run --rm migrate migrate-and-seed

# Reset database (DESTRUCTIVE)
db-reset:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	cd infra && docker compose down -v
	cd infra && docker compose up -d postgres redis
	@sleep 5
	cd infra && docker compose up -d

# =============================================================================
# Development
# =============================================================================

# Open Python shell
shell:
	cd infra && docker compose exec gateway-api python

# Open bash shell
bash:
	cd infra && docker compose exec gateway-api /bin/bash

# Run tests
test:
	cd infra && docker compose run --rm gateway-api test

# Development mode with hot reload
dev:
	cd infra && docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# =============================================================================
# Cleanup
# =============================================================================

# Remove containers and volumes
clean:
	@echo "Cleaning up containers and volumes..."
	cd infra && docker compose down -v --remove-orphans

# Remove everything including images
clean-all:
	@echo "Removing all containers, volumes, and images..."
	cd infra && docker compose down -v --rmi all --remove-orphans

# =============================================================================
# Production
# =============================================================================

# Production build
prod-build:
	cd infra && docker compose -f docker-compose.yml build --no-cache

# Production up
prod-up:
	cd infra && docker compose -f docker-compose.yml up -d

# Health check
health:
	@echo "Checking service health..."
	@curl -s http://localhost:8000/health | python -m json.tool || echo "Gateway API: DOWN"
	@curl -s http://localhost:8001/health | python -m json.tool || echo "Upstream: DOWN"
