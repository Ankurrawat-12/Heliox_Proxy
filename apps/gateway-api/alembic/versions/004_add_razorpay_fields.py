"""Add Razorpay fields and update plan/tenant models

Revision ID: 004
Revises: 003
Create Date: 2024-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Razorpay fields to tenants
    op.add_column('tenants', sa.Column('razorpay_customer_id', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('razorpay_subscription_id', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('razorpay_payment_id', sa.String(255), nullable=True))
    op.create_index('ix_tenants_razorpay_customer_id', 'tenants', ['razorpay_customer_id'])
    
    # Add payment integration fields to plans
    op.add_column('plans', sa.Column('razorpay_plan_id', sa.String(255), nullable=True, unique=True))
    op.add_column('plans', sa.Column('stripe_price_id', sa.String(255), nullable=True, unique=True))


def downgrade() -> None:
    # Remove payment integration fields from plans
    op.drop_column('plans', 'stripe_price_id')
    op.drop_column('plans', 'razorpay_plan_id')
    
    # Remove Razorpay fields from tenants
    op.drop_index('ix_tenants_razorpay_customer_id', table_name='tenants')
    op.drop_column('tenants', 'razorpay_payment_id')
    op.drop_column('tenants', 'razorpay_subscription_id')
    op.drop_column('tenants', 'razorpay_customer_id')
