"""Authentication API endpoints."""

import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import get_settings
from src.database import get_db
from src.models import Plan, Tenant, User
from src.models.user import UserRole
from src.services.email import email_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return str(random.randint(100000, 999999))


# =============================================================================
# SCHEMAS
# =============================================================================


class SignupRequest(BaseModel):
    """Request to create a new account."""
    
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    company_name: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    """Request to login."""
    
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""
    
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: "UserResponse"


class UserResponse(BaseModel):
    """User info response."""
    
    id: str
    email: str
    name: str
    avatar_url: str | None
    role: str
    tenant_id: str | None
    tenant_name: str | None
    plan_name: str | None
    email_verified: bool
    created_at: datetime


class PasswordResetRequest(BaseModel):
    """Request to reset password."""
    
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Confirm password reset with token."""
    
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class ChangePasswordRequest(BaseModel):
    """Request to change password (authenticated)."""
    
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class UpdateProfileRequest(BaseModel):
    """Request to update user profile."""
    
    name: str | None = Field(None, min_length=1, max_length=255)
    avatar_url: str | None = None


class VerifyOtpRequest(BaseModel):
    """Request to verify email with OTP."""
    
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class ResendOtpRequest(BaseModel):
    """Request to resend OTP."""
    
    email: EmailStr


class SignupResponse(BaseModel):
    """Signup response (before email verification)."""
    
    message: str
    email: str
    requires_verification: bool = True


# =============================================================================
# HELPERS
# =============================================================================


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: str, expires_hours: int = 24) -> tuple[str, int]:
    """Create a JWT access token."""
    settings = get_settings()
    expires_delta = timedelta(hours=expires_hours)
    expires_at = datetime.now(timezone.utc) + expires_delta
    
    payload = {
        "sub": user_id,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }
    
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> str | None:
    """Decode and verify a JWT access token. Returns user_id or None."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user from JWT token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = parts[1]
    user_id = decode_access_token(token)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant).selectinload(Tenant.plan))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Require the current user to be a Heliox admin."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def build_user_response(user: User) -> UserResponse:
    """Build a UserResponse from a User model."""
    tenant_name = None
    plan_name = None
    
    if user.tenant:
        tenant_name = user.tenant.name
        if user.tenant.plan:
            plan_name = user.tenant.plan.name
    
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        plan_name=plan_name,
        email_verified=user.email_verified,
        created_at=user.created_at,
    )


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/signup", response_model=SignupResponse)
async def signup(
    data: SignupRequest,
    db: AsyncSession = Depends(get_db),
) -> SignupResponse:
    """Create a new user account and tenant. Requires OTP verification before login."""
    
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == data.email))
    existing_user = existing.scalar_one_or_none()
    if existing_user:
        # If user exists but not verified, allow re-registration with new OTP
        if not existing_user.email_verified:
            # Generate new OTP
            otp = generate_otp()
            existing_user.email_verification_token = otp
            existing_user.email_verification_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
            existing_user.password_hash = hash_password(data.password)
            existing_user.name = data.name
            await db.flush()
            
            # Send OTP email
            email_service.send_otp_email(data.email, otp)
            
            return SignupResponse(
                message="Verification code sent to your email",
                email=data.email,
                requires_verification=True,
            )
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if company name already exists
    existing_tenant = await db.execute(select(Tenant).where(Tenant.name == data.company_name))
    if existing_tenant.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Company name already taken")
    
    # Get default plan
    default_plan = await db.execute(select(Plan).where(Plan.is_default == True))
    plan = default_plan.scalar_one_or_none()
    
    # Create tenant
    tenant = Tenant(
        name=data.company_name,
        plan_id=plan.id if plan else None,
        billing_email=data.email,
    )
    db.add(tenant)
    await db.flush()
    
    # Generate 6-digit OTP
    otp = generate_otp()
    
    # Create user as owner (not verified yet)
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        tenant_id=tenant.id,
        role=UserRole.OWNER,
        email_verified=False,
        email_verification_token=otp,
        email_verification_expires=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(user)
    await db.flush()
    
    # Send OTP email
    email_service.send_otp_email(data.email, otp)
    
    return SignupResponse(
        message="Verification code sent to your email",
        email=data.email,
        requires_verification=True,
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    data: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Verify email with OTP and return auth token."""
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant).selectinload(Tenant.plan))
        .where(User.email == data.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    
    if not user.email_verification_token:
        raise HTTPException(status_code=400, detail="No verification pending")
    
    if user.email_verification_expires and user.email_verification_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code expired. Please request a new one.")
    
    if user.email_verification_token != data.otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Mark email as verified
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    await db.flush()
    
    # Send welcome email
    if user.tenant:
        email_service.send_welcome_email(user.email, user.tenant.name)
    
    # Generate token
    access_token, expires_in = create_access_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=build_user_response(user),
    )


@router.post("/resend-otp")
async def resend_otp(
    data: ResendOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resend verification OTP."""
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email is registered, a verification code will be sent"}
    
    if user.email_verified:
        return {"message": "Email already verified. You can login."}
    
    # Generate new OTP
    otp = generate_otp()
    user.email_verification_token = otp
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.flush()
    
    # Send OTP email
    email_service.send_otp_email(user.email, otp)
    
    return {"message": "Verification code sent to your email"}


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Login with email and password."""
    
    # Find user
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant).selectinload(Tenant.plan))
        .where(User.email == data.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="Please login with your OAuth provider")
    
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Check email verification (except for admins)
    if not user.email_verified and user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="Please verify your email before logging in. Check your inbox for the verification code."
        )
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    
    # Generate token
    access_token, expires_in = create_access_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=build_user_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    """Get current user info."""
    return build_user_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update current user profile."""
    
    if data.name is not None:
        user.name = data.name
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    
    await db.flush()
    
    # Reload with tenant
    result = await db.execute(
        select(User)
        .options(selectinload(User.tenant).selectinload(Tenant.plan))
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    
    return build_user_response(user)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change password (authenticated user)."""
    
    if not user.password_hash:
        raise HTTPException(status_code=400, detail="Cannot change password for OAuth account")
    
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    user.password_hash = hash_password(data.new_password)
    await db.flush()
    
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Request password reset email."""
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if user and user.password_hash:
        # Generate reset token
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.flush()
        
        # Send password reset email
        email_service.send_password_reset_email(user.email, token)
    
    # Always return success to prevent email enumeration
    return {"message": "If your email is registered, you will receive a password reset link"}


@router.post("/reset-password")
async def reset_password(
    data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reset password with token."""
    
    result = await db.execute(
        select(User).where(
            User.password_reset_token == data.token,
            User.password_reset_expires > datetime.now(timezone.utc),
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    user.password_hash = hash_password(data.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.flush()
    
    return {"message": "Password reset successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(user: User = Depends(get_current_user)) -> TokenResponse:
    """Refresh the access token."""
    
    access_token, expires_in = create_access_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=build_user_response(user),
    )


@router.post("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify email address with token."""
    
    result = await db.execute(
        select(User).where(
            User.email_verification_token == token,
            User.email_verification_expires > datetime.now(timezone.utc),
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    await db.flush()
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resend email verification."""
    
    if user.email_verified:
        return {"message": "Email already verified"}
    
    # Generate new verification token
    verification_token = secrets.token_urlsafe(32)
    user.email_verification_token = verification_token
    user.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.flush()
    
    # Send verification email
    email_service.send_verification_email(user.email, verification_token)
    
    return {"message": "Verification email sent"}


@router.get("/test-email")
async def test_email() -> dict:
    """Test email configuration (sends a test email synchronously)."""
    from src.config import get_settings
    settings = get_settings()
    
    if not settings.smtp_configured:
        return {
            "success": False,
            "error": "SMTP not configured",
            "config": {
                "smtp_host": settings.smtp_host or "(not set)",
                "smtp_port": settings.smtp_port,
                "smtp_user": settings.smtp_user or "(not set)",
                "smtp_from_email": settings.smtp_from_email or "(not set)",
            }
        }
    
    # Try to send a test email synchronously (not in background)
    try:
        import smtplib
        from email.mime.text import MIMEText
        
        msg = MIMEText("This is a test email from Heliox API Gateway.")
        msg["Subject"] = "Heliox Test Email"
        msg["From"] = f"Heliox <{settings.smtp_from_email or settings.smtp_user}>"
        msg["To"] = settings.smtp_user  # Send to self
        
        if settings.smtp_secure:
            smtp = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
        else:
            smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            smtp.starttls()
        
        smtp.login(settings.smtp_user, settings.smtp_pass)
        smtp.sendmail(settings.smtp_from_email or settings.smtp_user, settings.smtp_user, msg.as_string())
        smtp.quit()
        
        return {
            "success": True,
            "message": f"Test email sent to {settings.smtp_user}",
            "config": {
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
                "smtp_user": settings.smtp_user,
            }
        }
    except smtplib.SMTPAuthenticationError as e:
        return {
            "success": False,
            "error": f"Authentication failed: {str(e)}",
            "hint": "Check SMTP_USER and SMTP_PASS. For Gmail, use an App Password."
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}",
            "config": {
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
            }
        }
