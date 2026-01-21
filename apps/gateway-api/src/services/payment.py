"""Payment service for Razorpay integration."""

import hmac
import hashlib
import logging
from typing import Optional
from datetime import datetime

import httpx

from src.config import get_settings

logger = logging.getLogger(__name__)


class RazorpayService:
    """Service for Razorpay payment integration."""
    
    BASE_URL = "https://api.razorpay.com/v1"
    
    def __init__(self):
        self.settings = get_settings()
    
    @property
    def is_configured(self) -> bool:
        """Check if Razorpay is configured."""
        return self.settings.razorpay_configured
    
    def _get_auth(self) -> tuple[str, str]:
        """Get basic auth credentials."""
        return (self.settings.razorpay_key_id, self.settings.razorpay_key_secret)
    
    async def create_order(
        self,
        amount_paise: int,
        currency: str = "INR",
        receipt: Optional[str] = None,
        notes: Optional[dict] = None,
    ) -> dict:
        """
        Create a Razorpay order.
        
        Args:
            amount_paise: Amount in paise (100 paise = 1 INR)
            currency: Currency code (default INR)
            receipt: Optional receipt ID
            notes: Optional notes dict
        
        Returns:
            Order object from Razorpay
        """
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        payload = {
            "amount": amount_paise,
            "currency": currency,
        }
        
        if receipt:
            payload["receipt"] = receipt
        if notes:
            payload["notes"] = notes
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/orders",
                json=payload,
                auth=self._get_auth(),
            )
            response.raise_for_status()
            return response.json()
    
    async def create_subscription(
        self,
        plan_id: str,
        customer_id: Optional[str] = None,
        total_count: int = 12,  # 12 months
        quantity: int = 1,
        notes: Optional[dict] = None,
    ) -> dict:
        """
        Create a Razorpay subscription.
        
        Args:
            plan_id: Razorpay plan ID
            customer_id: Optional Razorpay customer ID
            total_count: Number of billing cycles
            quantity: Quantity of the plan
            notes: Optional notes dict
        
        Returns:
            Subscription object from Razorpay
        """
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        payload = {
            "plan_id": plan_id,
            "total_count": total_count,
            "quantity": quantity,
        }
        
        if customer_id:
            payload["customer_id"] = customer_id
        if notes:
            payload["notes"] = notes
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/subscriptions",
                json=payload,
                auth=self._get_auth(),
            )
            response.raise_for_status()
            return response.json()
    
    async def create_customer(
        self,
        email: str,
        name: Optional[str] = None,
        contact: Optional[str] = None,
        notes: Optional[dict] = None,
    ) -> dict:
        """
        Create a Razorpay customer.
        
        Args:
            email: Customer email
            name: Customer name
            contact: Customer phone
            notes: Optional notes dict
        
        Returns:
            Customer object from Razorpay
        """
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        payload = {"email": email}
        
        if name:
            payload["name"] = name
        if contact:
            payload["contact"] = contact
        if notes:
            payload["notes"] = notes
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/customers",
                json=payload,
                auth=self._get_auth(),
            )
            response.raise_for_status()
            return response.json()
    
    async def create_plan(
        self,
        name: str,
        amount_paise: int,
        period: str = "monthly",
        interval: int = 1,
        currency: str = "INR",
        description: Optional[str] = None,
        notes: Optional[dict] = None,
    ) -> dict:
        """
        Create a Razorpay plan for subscriptions.
        
        Args:
            name: Plan name
            amount_paise: Amount in paise per period
            period: Billing period (daily, weekly, monthly, yearly)
            interval: Billing interval
            currency: Currency code
            description: Plan description
            notes: Optional notes dict
        
        Returns:
            Plan object from Razorpay
        """
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        payload = {
            "period": period,
            "interval": interval,
            "item": {
                "name": name,
                "amount": amount_paise,
                "currency": currency,
            },
        }
        
        if description:
            payload["item"]["description"] = description
        if notes:
            payload["notes"] = notes
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/plans",
                json=payload,
                auth=self._get_auth(),
            )
            response.raise_for_status()
            return response.json()
    
    async def get_subscription(self, subscription_id: str) -> dict:
        """Get subscription details."""
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/subscriptions/{subscription_id}",
                auth=self._get_auth(),
            )
            response.raise_for_status()
            return response.json()
    
    async def cancel_subscription(
        self,
        subscription_id: str,
        cancel_at_cycle_end: bool = True,
    ) -> dict:
        """
        Cancel a subscription.
        
        Args:
            subscription_id: Razorpay subscription ID
            cancel_at_cycle_end: If True, cancel at end of current billing cycle
        
        Returns:
            Updated subscription object
        """
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/subscriptions/{subscription_id}/cancel",
                json={"cancel_at_cycle_end": cancel_at_cycle_end},
                auth=self._get_auth(),
            )
            response.raise_for_status()
            return response.json()
    
    async def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        """
        Verify payment signature.
        
        Args:
            razorpay_order_id: Order ID from Razorpay
            razorpay_payment_id: Payment ID from Razorpay
            razorpay_signature: Signature from Razorpay
        
        Returns:
            True if signature is valid
        """
        if not self.is_configured:
            raise ValueError("Razorpay is not configured")
        
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_signature = hmac.new(
            self.settings.razorpay_key_secret.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, razorpay_signature)
    
    def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
    ) -> bool:
        """
        Verify webhook signature.
        
        Args:
            payload: Raw webhook payload
            signature: X-Razorpay-Signature header
        
        Returns:
            True if signature is valid
        """
        if not self.settings.razorpay_webhook_secret:
            logger.warning("Razorpay webhook secret not configured")
            return False
        
        expected_signature = hmac.new(
            self.settings.razorpay_webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        
        return hmac.compare_digest(expected_signature, signature)


# Global payment service instance
payment_service = RazorpayService()
