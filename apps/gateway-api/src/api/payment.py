"""Payment API endpoints for Razorpay integration."""

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import get_settings
from src.database import get_db
from src.models import Plan, Tenant, User
from src.api.auth import get_current_user
from src.services.payment import payment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# =============================================================================
# SCHEMAS
# =============================================================================


class CreateOrderRequest(BaseModel):
    """Request to create a payment order."""
    
    plan_id: str


class CreateOrderResponse(BaseModel):
    """Response with Razorpay order details."""
    
    order_id: str
    amount: int  # in paise
    currency: str
    key_id: str  # Razorpay key ID for frontend
    plan_name: str


class VerifyPaymentRequest(BaseModel):
    """Request to verify payment."""
    
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str


class CreateSubscriptionRequest(BaseModel):
    """Request to create a subscription."""
    
    plan_id: str


class CreateSubscriptionResponse(BaseModel):
    """Response with Razorpay subscription details."""
    
    subscription_id: str
    short_url: str | None
    key_id: str


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel subscription."""
    
    cancel_at_cycle_end: bool = True


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    data: CreateOrderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreateOrderResponse:
    """Create a Razorpay order for one-time payment."""
    
    settings = get_settings()
    
    if not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    # Get the plan
    result = await db.execute(select(Plan).where(Plan.id == data.plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if plan.price_monthly_cents == 0:
        raise HTTPException(status_code=400, detail="Cannot create order for free plan")
    
    # Convert cents to paise (1 INR = 100 paise, assuming 1 USD = ~83 INR)
    # For simplicity, we'll treat cents as paise directly for Indian market
    amount_paise = plan.price_monthly_cents
    
    try:
        order = await payment_service.create_order(
            amount_paise=amount_paise,
            currency="INR",
            receipt=f"order_{user.tenant_id}_{plan.id}",
            notes={
                "tenant_id": user.tenant_id,
                "plan_id": plan.id,
                "user_id": user.id,
            },
        )
        
        return CreateOrderResponse(
            order_id=order["id"],
            amount=order["amount"],
            currency=order["currency"],
            key_id=settings.razorpay_key_id,
            plan_name=plan.name,
        )
        
    except Exception as e:
        logger.error(f"Failed to create Razorpay order: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")


@router.post("/verify-payment")
async def verify_payment(
    data: VerifyPaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify payment and upgrade plan."""
    
    settings = get_settings()
    
    if not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    # Verify signature
    is_valid = await payment_service.verify_payment(
        razorpay_order_id=data.razorpay_order_id,
        razorpay_payment_id=data.razorpay_payment_id,
        razorpay_signature=data.razorpay_signature,
    )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    # Get the plan
    result = await db.execute(select(Plan).where(Plan.id == data.plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get tenant
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant")
    
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Update tenant plan
    tenant.plan_id = plan.id
    tenant.razorpay_payment_id = data.razorpay_payment_id
    await db.flush()
    
    logger.info(f"Tenant {tenant.id} upgraded to plan {plan.name}")
    
    return {
        "message": "Payment verified and plan upgraded",
        "plan": plan.name,
    }


@router.post("/create-subscription", response_model=CreateSubscriptionResponse)
async def create_subscription(
    data: CreateSubscriptionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CreateSubscriptionResponse:
    """Create a Razorpay subscription for recurring payments."""
    
    settings = get_settings()
    
    if not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    # Get the plan
    result = await db.execute(select(Plan).where(Plan.id == data.plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if plan.price_monthly_cents == 0:
        raise HTTPException(status_code=400, detail="Cannot create subscription for free plan")
    
    if not plan.razorpay_plan_id:
        raise HTTPException(status_code=400, detail="Plan not configured for subscriptions")
    
    # Get tenant
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant")
    
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        # Create or get customer
        customer_id = tenant.razorpay_customer_id
        if not customer_id:
            customer = await payment_service.create_customer(
                email=user.email,
                name=user.name,
                notes={"tenant_id": tenant.id},
            )
            customer_id = customer["id"]
            tenant.razorpay_customer_id = customer_id
            await db.flush()
        
        # Create subscription
        subscription = await payment_service.create_subscription(
            plan_id=plan.razorpay_plan_id,
            customer_id=customer_id,
            notes={
                "tenant_id": tenant.id,
                "plan_id": plan.id,
            },
        )
        
        return CreateSubscriptionResponse(
            subscription_id=subscription["id"],
            short_url=subscription.get("short_url"),
            key_id=settings.razorpay_key_id,
        )
        
    except Exception as e:
        logger.error(f"Failed to create Razorpay subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription")


@router.post("/cancel-subscription")
async def cancel_subscription(
    data: CancelSubscriptionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cancel the current subscription."""
    
    settings = get_settings()
    
    if not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    # Get tenant
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant")
    
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if not tenant.razorpay_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")
    
    try:
        await payment_service.cancel_subscription(
            subscription_id=tenant.razorpay_subscription_id,
            cancel_at_cycle_end=data.cancel_at_cycle_end,
        )
        
        if not data.cancel_at_cycle_end:
            # Immediate cancellation - revert to free plan
            result = await db.execute(select(Plan).where(Plan.is_default == True))
            free_plan = result.scalar_one_or_none()
            if free_plan:
                tenant.plan_id = free_plan.id
            tenant.razorpay_subscription_id = None
        
        await db.flush()
        
        return {"message": "Subscription cancelled"}
        
    except Exception as e:
        logger.error(f"Failed to cancel subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Handle Razorpay webhooks."""
    
    settings = get_settings()
    
    # Get signature
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    # Get raw body
    body = await request.body()
    
    # Verify signature
    if settings.razorpay_webhook_secret:
        is_valid = payment_service.verify_webhook_signature(body, signature)
        if not is_valid:
            logger.warning("Invalid webhook signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Parse payload
    import json
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event = payload.get("event")
    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    
    logger.info(f"Received Razorpay webhook: {event}")
    
    if event == "subscription.activated":
        # Subscription activated - update tenant
        tenant_id = entity.get("notes", {}).get("tenant_id")
        plan_id = entity.get("notes", {}).get("plan_id")
        subscription_id = entity.get("id")
        
        if tenant_id and plan_id:
            result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            
            if tenant:
                tenant.plan_id = plan_id
                tenant.razorpay_subscription_id = subscription_id
                await db.flush()
                logger.info(f"Activated subscription for tenant {tenant_id}")
    
    elif event == "subscription.cancelled":
        subscription_id = entity.get("id")
        
        if subscription_id:
            result = await db.execute(
                select(Tenant).where(Tenant.razorpay_subscription_id == subscription_id)
            )
            tenant = result.scalar_one_or_none()
            
            if tenant:
                # Revert to free plan
                result = await db.execute(select(Plan).where(Plan.is_default == True))
                free_plan = result.scalar_one_or_none()
                if free_plan:
                    tenant.plan_id = free_plan.id
                tenant.razorpay_subscription_id = None
                await db.flush()
                logger.info(f"Cancelled subscription for tenant {tenant.id}")
    
    elif event == "payment.failed":
        # Handle payment failure
        subscription_id = entity.get("id")
        logger.warning(f"Payment failed for subscription {subscription_id}")
    
    return {"status": "ok"}
