"""User model - represents authenticated users."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

if TYPE_CHECKING:
    from src.models.tenant import Tenant


class UserRole(str, Enum):
    """User roles for authorization."""
    
    ADMIN = "admin"  # Heliox admin - full access to admin panel
    OWNER = "owner"  # Tenant owner - can manage tenant, billing, users
    MEMBER = "member"  # Tenant member - can view and manage API keys


class User(Base):
    """
    User represents an authenticated user in the system.
    
    Users belong to a tenant and have roles that determine their permissions.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    
    # Auth fields
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,  # Null for OAuth-only users
    )
    
    # Profile
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Tenant association
    tenant_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    # Role
    role: Mapped[UserRole] = mapped_column(
        String(20),
        default=UserRole.MEMBER,
        nullable=False,
    )
    
    # OAuth providers (store provider IDs for linking)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    github_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    
    # Email verification
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verification_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Password reset
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
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
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship(
        "Tenant",
        back_populates="users",
    )

    @property
    def is_admin(self) -> bool:
        """Check if user is a Heliox admin."""
        return self.role == UserRole.ADMIN

    @property
    def is_owner(self) -> bool:
        """Check if user is a tenant owner."""
        return self.role == UserRole.OWNER

    @property
    def can_manage_tenant(self) -> bool:
        """Check if user can manage tenant settings."""
        return self.role in (UserRole.ADMIN, UserRole.OWNER)

    @property
    def can_manage_billing(self) -> bool:
        """Check if user can manage billing."""
        return self.role in (UserRole.ADMIN, UserRole.OWNER)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
