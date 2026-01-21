"""Plan model - defines subscription tiers with limits."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

if TYPE_CHECKING:
    from src.models.tenant import Tenant


class PlanTier(str, Enum):
    """Subscription tier levels."""
    
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


class Plan(Base):
    """
    Plan defines subscription tiers with usage limits.
    
    Each tenant is associated with a plan that determines their limits.
    """

    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    tier: Mapped[PlanTier] = mapped_column(
        String(20),
        default=PlanTier.FREE,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Pricing (monthly, in cents to avoid float issues)
    price_monthly_cents: Mapped[int] = mapped_column(Integer, default=0)
    
    # Request limits
    quota_daily: Mapped[int] = mapped_column(Integer, default=1000)  # 0 = unlimited
    quota_monthly: Mapped[int] = mapped_column(Integer, default=10000)  # 0 = unlimited
    
    # Rate limits
    rate_limit_rps: Mapped[float] = mapped_column(Float, default=10.0)
    rate_limit_burst: Mapped[int] = mapped_column(Integer, default=20)
    
    # Feature limits
    max_api_keys: Mapped[int] = mapped_column(Integer, default=2)  # 0 = unlimited
    max_routes: Mapped[int] = mapped_column(Integer, default=5)  # 0 = unlimited
    
    # Features (boolean flags)
    cache_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    analytics_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_support: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_domains: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Payment integration
    razorpay_plan_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
    )
    stripe_price_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # Default plan for new tenants
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    tenants: Mapped[list["Tenant"]] = relationship(
        "Tenant",
        back_populates="plan",
    )

    @property
    def price_monthly_dollars(self) -> float:
        """Get price in dollars."""
        return self.price_monthly_cents / 100

    @property
    def is_unlimited_daily(self) -> bool:
        """Check if daily quota is unlimited."""
        return self.quota_daily == 0

    @property
    def is_unlimited_monthly(self) -> bool:
        """Check if monthly quota is unlimited."""
        return self.quota_monthly == 0

    def __repr__(self) -> str:
        return f"<Plan(id={self.id}, name={self.name}, tier={self.tier})>"


# Predefined plan configurations
PREDEFINED_PLANS = [
    {
        "name": "Free",
        "tier": PlanTier.FREE,
        "description": "Perfect for testing and small projects",
        "price_monthly_cents": 0,
        "quota_daily": 1000,
        "quota_monthly": 10000,
        "rate_limit_rps": 10.0,
        "rate_limit_burst": 20,
        "max_api_keys": 2,
        "max_routes": 5,
        "cache_enabled": True,
        "analytics_enabled": False,
        "priority_support": False,
        "custom_domains": False,
        "is_default": True,
    },
    {
        "name": "Pro",
        "tier": PlanTier.PRO,
        "description": "For growing applications and teams",
        "price_monthly_cents": 2900,  # $29/month
        "quota_daily": 50000,
        "quota_monthly": 500000,
        "rate_limit_rps": 100.0,
        "rate_limit_burst": 200,
        "max_api_keys": 10,
        "max_routes": 25,
        "cache_enabled": True,
        "analytics_enabled": True,
        "priority_support": False,
        "custom_domains": False,
        "is_default": False,
    },
    {
        "name": "Enterprise",
        "tier": PlanTier.ENTERPRISE,
        "description": "For large-scale production workloads",
        "price_monthly_cents": 19900,  # $199/month
        "quota_daily": 0,  # Unlimited
        "quota_monthly": 0,  # Unlimited
        "rate_limit_rps": 1000.0,
        "rate_limit_burst": 2000,
        "max_api_keys": 0,  # Unlimited
        "max_routes": 0,  # Unlimited
        "cache_enabled": True,
        "analytics_enabled": True,
        "priority_support": True,
        "custom_domains": True,
        "is_default": False,
    },
]
