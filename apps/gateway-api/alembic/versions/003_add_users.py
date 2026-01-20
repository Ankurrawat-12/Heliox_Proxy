"""Add users table for authentication

Revision ID: 003
Revises: 002
Create Date: 2024-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('role', sa.String(20), nullable=False, default='member'),
        sa.Column('google_id', sa.String(255), nullable=True, unique=True),
        sa.Column('github_id', sa.String(255), nullable=True, unique=True),
        sa.Column('email_verified', sa.Boolean(), default=False),
        sa.Column('email_verification_token', sa.String(255), nullable=True),
        sa.Column('email_verification_expires', sa.DateTime(timezone=True), nullable=True),
        sa.Column('password_reset_token', sa.String(255), nullable=True),
        sa.Column('password_reset_expires', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    )
    
    # Create indexes
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_tenant_id', 'users', ['tenant_id'])
    op.create_index('ix_users_google_id', 'users', ['google_id'])
    op.create_index('ix_users_github_id', 'users', ['github_id'])
    
    # Add foreign key to tenants
    op.create_foreign_key(
        'fk_users_tenant_id',
        'users', 'tenants',
        ['tenant_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add Stripe fields to tenants
    op.add_column('tenants', sa.Column('stripe_customer_id', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('stripe_subscription_id', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('billing_email', sa.String(255), nullable=True))
    
    op.create_index('ix_tenants_stripe_customer_id', 'tenants', ['stripe_customer_id'])


def downgrade() -> None:
    # Remove Stripe fields from tenants
    op.drop_index('ix_tenants_stripe_customer_id', table_name='tenants')
    op.drop_column('tenants', 'billing_email')
    op.drop_column('tenants', 'stripe_subscription_id')
    op.drop_column('tenants', 'stripe_customer_id')
    
    # Drop users table
    op.drop_constraint('fk_users_tenant_id', 'users', type_='foreignkey')
    op.drop_index('ix_users_github_id', table_name='users')
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_index('ix_users_tenant_id', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
