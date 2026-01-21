"""Customer Portal API endpoints.

These endpoints allow authenticated users to manage their own tenant's resources.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models import ApiKey, Plan, RequestLog, Route, Tenant, User
from src.models.api_key import ApiKeyStatus, generate_api_key
from src.api.auth import get_current_user

router = APIRouter(prefix="/portal", tags=["Customer Portal"])


# =============================================================================
# SCHEMAS
# =============================================================================


class TenantInfo(BaseModel):
    """Tenant info for portal."""
    
    id: str
    name: str
    description: str | None
    plan_name: str | None
    plan_tier: str | None
    api_key_count: int
    route_count: int
    max_api_keys: int
    max_routes: int
    quota_daily: int
    quota_monthly: int
    created_at: datetime


class PortalApiKey(BaseModel):
    """API key info for portal."""
    
    id: str
    name: str
    key_prefix: str
    key: str | None = None  # Only on creation
    status: str
    is_active: bool  # Derived from status
    quota_daily: int
    quota_monthly: int
    rate_limit_rps: float | None
    created_at: datetime
    last_used_at: datetime | None


class CreateApiKeyRequest(BaseModel):
    """Request to create an API key."""
    
    name: str = Field(..., min_length=1, max_length=255)


class UsageSummary(BaseModel):
    """Usage summary for the current period."""
    
    daily_requests: int
    monthly_requests: int
    daily_limit: int
    monthly_limit: int
    daily_percent: float
    monthly_percent: float
    cache_hit_rate: float
    avg_latency_ms: float
    error_rate: float


class PlanInfo(BaseModel):
    """Plan info for upgrade options."""
    
    id: str
    name: str
    tier: str
    description: str | None
    price_monthly_cents: int
    quota_daily: int
    quota_monthly: int
    rate_limit_rps: float
    max_api_keys: int
    max_routes: int
    cache_enabled: bool
    analytics_enabled: bool
    priority_support: bool
    is_current: bool


# =============================================================================
# HELPERS
# =============================================================================


def require_tenant(user: User) -> Tenant:
    """Require user to have a tenant."""
    if not user.tenant:
        raise HTTPException(status_code=400, detail="No organization associated with your account")
    return user.tenant


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.get("/tenant", response_model=TenantInfo)
async def get_my_tenant(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantInfo:
    """Get current user's tenant info."""
    tenant = require_tenant(user)
    
    # Get counts
    key_count = await db.execute(
        select(func.count(ApiKey.id)).where(ApiKey.tenant_id == tenant.id)
    )
    route_count = await db.execute(
        select(func.count(Route.id)).where(Route.tenant_id == tenant.id)
    )
    
    # Get plan limits
    plan = user.tenant.plan
    max_keys = plan.max_api_keys if plan else 2
    max_routes = plan.max_routes if plan else 5
    quota_daily = plan.quota_daily if plan else 1000
    quota_monthly = plan.quota_monthly if plan else 10000
    
    return TenantInfo(
        id=tenant.id,
        name=tenant.name,
        description=tenant.description,
        plan_name=plan.name if plan else "Free",
        plan_tier=plan.tier.value if plan and hasattr(plan.tier, 'value') else "free",
        api_key_count=key_count.scalar() or 0,
        route_count=route_count.scalar() or 0,
        max_api_keys=max_keys,
        max_routes=max_routes,
        quota_daily=quota_daily,
        quota_monthly=quota_monthly,
        created_at=tenant.created_at,
    )


@router.get("/usage", response_model=UsageSummary)
async def get_usage(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UsageSummary:
    """Get usage summary for the current billing period."""
    tenant = require_tenant(user)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get daily requests
    daily_result = await db.execute(
        select(func.count(RequestLog.id))
        .where(RequestLog.tenant_id == tenant.id)
        .where(RequestLog.timestamp >= today_start)
    )
    daily_requests = daily_result.scalar() or 0
    
    # Get monthly requests
    monthly_result = await db.execute(
        select(func.count(RequestLog.id))
        .where(RequestLog.tenant_id == tenant.id)
        .where(RequestLog.timestamp >= month_start)
    )
    monthly_requests = monthly_result.scalar() or 0
    
    # Get plan limits
    plan = tenant.plan
    daily_limit = plan.quota_daily if plan else 1000
    monthly_limit = plan.quota_monthly if plan else 10000
    
    # Calculate percentages
    daily_percent = (daily_requests / daily_limit * 100) if daily_limit > 0 else 0
    monthly_percent = (monthly_requests / monthly_limit * 100) if monthly_limit > 0 else 0
    
    # Get cache and latency stats (last 24 hours)
    stats_result = await db.execute(
        select(
            func.count(RequestLog.id).label("total"),
            func.avg(RequestLog.latency_ms).label("avg_latency"),
            func.count().filter(RequestLog.cache_status.in_(["hit", "stale"])).label("cache_hits"),
            func.count().filter(RequestLog.error_type != "none").label("errors"),
        )
        .where(RequestLog.tenant_id == tenant.id)
        .where(RequestLog.timestamp >= now - timedelta(hours=24))
    )
    stats = stats_result.one()
    
    total = stats.total or 0
    cache_hit_rate = (stats.cache_hits or 0) / total if total > 0 else 0
    error_rate = (stats.errors or 0) / total if total > 0 else 0
    
    return UsageSummary(
        daily_requests=daily_requests,
        monthly_requests=monthly_requests,
        daily_limit=daily_limit,
        monthly_limit=monthly_limit,
        daily_percent=min(daily_percent, 100),
        monthly_percent=min(monthly_percent, 100),
        cache_hit_rate=cache_hit_rate,
        avg_latency_ms=float(stats.avg_latency or 0),
        error_rate=error_rate,
    )


@router.get("/keys", response_model=list[PortalApiKey])
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PortalApiKey]:
    """List API keys for the current tenant."""
    tenant = require_tenant(user)
    
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.tenant_id == tenant.id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    
    return [
        PortalApiKey(
            id=key.id,
            name=key.name,
            key_prefix=key.key_prefix,
            status=key.status.value if hasattr(key.status, 'value') else str(key.status),
            is_active=key.is_active,
            quota_daily=key.quota_daily,
            quota_monthly=key.quota_monthly,
            rate_limit_rps=key.rate_limit_rps,
            created_at=key.created_at,
            last_used_at=key.last_used_at,
        )
        for key in keys
    ]


@router.post("/keys", response_model=PortalApiKey)
async def create_api_key(
    data: CreateApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalApiKey:
    """Create a new API key for the current tenant."""
    tenant = require_tenant(user)
    plan = tenant.plan
    
    # Check plan limits
    key_count = await db.execute(
        select(func.count(ApiKey.id)).where(ApiKey.tenant_id == tenant.id)
    )
    current_count = key_count.scalar() or 0
    
    max_keys = plan.max_api_keys if plan else 2
    if max_keys > 0 and current_count >= max_keys:
        raise HTTPException(
            status_code=403,
            detail=f"Plan limit reached: Your plan allows max {max_keys} API keys. Upgrade to create more."
        )
    
    # Use plan defaults
    quota_daily = plan.quota_daily if plan else 1000
    quota_monthly = plan.quota_monthly if plan else 10000
    rate_limit_rps = plan.rate_limit_rps if plan else 10.0
    rate_limit_burst = plan.rate_limit_burst if plan else 20
    
    # Create key
    key = generate_api_key()
    api_key = ApiKey(
        tenant_id=tenant.id,
        name=data.name,
        key=key,
        key_prefix=key[:10],
        quota_daily=quota_daily,
        quota_monthly=quota_monthly,
        rate_limit_rps=rate_limit_rps,
        rate_limit_burst=rate_limit_burst,
    )
    db.add(api_key)
    await db.flush()
    
    return PortalApiKey(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key=api_key.key,  # Return full key only on creation
        status=api_key.status.value,
        is_active=api_key.is_active,
        quota_daily=api_key.quota_daily,
        quota_monthly=api_key.quota_monthly,
        rate_limit_rps=api_key.rate_limit_rps,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
    )


@router.post("/keys/{key_id}/rotate", response_model=PortalApiKey)
async def rotate_api_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalApiKey:
    """Rotate an API key (generate new secret)."""
    tenant = require_tenant(user)
    
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.id == key_id)
        .where(ApiKey.tenant_id == tenant.id)
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Generate new key
    new_key = generate_api_key()
    api_key.key = new_key
    api_key.key_prefix = new_key[:10]
    await db.flush()
    
    return PortalApiKey(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key=api_key.key,  # Return full key after rotation
        status=api_key.status.value,
        is_active=api_key.is_active,
        quota_daily=api_key.quota_daily,
        quota_monthly=api_key.quota_monthly,
        rate_limit_rps=api_key.rate_limit_rps,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
    )


@router.patch("/keys/{key_id}/toggle", response_model=PortalApiKey)
async def toggle_api_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalApiKey:
    """Enable or disable an API key."""
    tenant = require_tenant(user)
    
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.id == key_id)
        .where(ApiKey.tenant_id == tenant.id)
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Toggle status
    if api_key.status == ApiKeyStatus.ACTIVE:
        api_key.status = ApiKeyStatus.DISABLED
    else:
        api_key.status = ApiKeyStatus.ACTIVE
    
    await db.flush()
    
    return PortalApiKey(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        status=api_key.status.value,
        is_active=api_key.is_active,
        quota_daily=api_key.quota_daily,
        quota_monthly=api_key.quota_monthly,
        rate_limit_rps=api_key.rate_limit_rps,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
    )


@router.delete("/keys/{key_id}")
async def delete_api_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete an API key."""
    tenant = require_tenant(user)
    
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.id == key_id)
        .where(ApiKey.tenant_id == tenant.id)
    )
    key = result.scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    await db.delete(key)
    await db.flush()
    
    return {"message": "API key deleted"}


@router.get("/plans", response_model=list[PlanInfo])
async def list_plans(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlanInfo]:
    """List available plans for upgrade."""
    tenant = require_tenant(user)
    current_plan_id = tenant.plan_id
    
    result = await db.execute(
        select(Plan)
        .where(Plan.is_active == True)
        .order_by(Plan.price_monthly_cents.asc())
    )
    plans = result.scalars().all()
    
    return [
        PlanInfo(
            id=plan.id,
            name=plan.name,
            tier=plan.tier.value if hasattr(plan.tier, 'value') else str(plan.tier),
            description=plan.description,
            price_monthly_cents=plan.price_monthly_cents,
            quota_daily=plan.quota_daily,
            quota_monthly=plan.quota_monthly,
            rate_limit_rps=plan.rate_limit_rps,
            max_api_keys=plan.max_api_keys,
            max_routes=plan.max_routes,
            cache_enabled=plan.cache_enabled,
            analytics_enabled=plan.analytics_enabled,
            priority_support=plan.priority_support,
            is_current=plan.id == current_plan_id,
        )
        for plan in plans
    ]
