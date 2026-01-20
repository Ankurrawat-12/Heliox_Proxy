"""Tenant model - represents a customer/organization."""

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

if TYPE_CHECKING:
    from src.models.api_key import ApiKey
    from src.models.plan import Plan
    from src.models.route import Route


class Tenant(Base):
    """
    Tenant represents a customer or organization using the gateway.
    
    Each tenant can have multiple API keys and routes.
    Tenants are associated with a plan that determines their limits.
    """

    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    
    # Plan association
    plan_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
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
    plan: Mapped["Plan | None"] = relationship(
        "Plan",
        back_populates="tenants",
    )
    api_keys: Mapped[list["ApiKey"]] = relationship(
        "ApiKey",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    routes: Mapped[list["Route"]] = relationship(
        "Route",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name={self.name}, plan_id={self.plan_id})>"
