"""Add plans table and tenant plan association

Revision ID: 002
Revises: 001
Create Date: 2024-01-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create plans table
    op.create_table(
        'plans',
        sa.Column('id', postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('tier', sa.String(20), nullable=False, default='free'),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('price_monthly_cents', sa.Integer(), default=0),
        sa.Column('quota_daily', sa.Integer(), default=1000),
        sa.Column('quota_monthly', sa.Integer(), default=10000),
        sa.Column('rate_limit_rps', sa.Float(), default=10.0),
        sa.Column('rate_limit_burst', sa.Integer(), default=20),
        sa.Column('max_api_keys', sa.Integer(), default=2),
        sa.Column('max_routes', sa.Integer(), default=5),
        sa.Column('cache_enabled', sa.Boolean(), default=True),
        sa.Column('analytics_enabled', sa.Boolean(), default=False),
        sa.Column('priority_support', sa.Boolean(), default=False),
        sa.Column('custom_domains', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_plans_tier', 'plans', ['tier'])
    op.create_index('ix_plans_is_default', 'plans', ['is_default'])

    # Add plan_id to tenants table
    op.add_column('tenants', sa.Column('plan_id', postgresql.UUID(as_uuid=False), nullable=True))
    op.create_index('ix_tenants_plan_id', 'tenants', ['plan_id'])
    op.create_foreign_key(
        'fk_tenants_plan_id',
        'tenants', 'plans',
        ['plan_id'], ['id'],
        ondelete='SET NULL'
    )

    # Insert predefined plans
    op.execute("""
        INSERT INTO plans (id, name, tier, description, price_monthly_cents, quota_daily, quota_monthly, 
                          rate_limit_rps, rate_limit_burst, max_api_keys, max_routes,
                          cache_enabled, analytics_enabled, priority_support, custom_domains, is_active, is_default)
        VALUES 
        (gen_random_uuid(), 'Free', 'free', 'Perfect for testing and small projects', 
         0, 1000, 10000, 10.0, 20, 2, 5, true, false, false, false, true, true),
        (gen_random_uuid(), 'Pro', 'pro', 'For growing applications and teams', 
         2900, 50000, 500000, 100.0, 200, 10, 25, true, true, false, false, true, false),
        (gen_random_uuid(), 'Enterprise', 'enterprise', 'For large-scale production workloads', 
         19900, 0, 0, 1000.0, 2000, 0, 0, true, true, true, true, true, false)
    """)

    # Update existing tenants to use the Free plan
    op.execute("""
        UPDATE tenants 
        SET plan_id = (SELECT id FROM plans WHERE is_default = true LIMIT 1)
        WHERE plan_id IS NULL
    """)


def downgrade() -> None:
    # Remove foreign key and column from tenants
    op.drop_constraint('fk_tenants_plan_id', 'tenants', type_='foreignkey')
    op.drop_index('ix_tenants_plan_id', table_name='tenants')
    op.drop_column('tenants', 'plan_id')

    # Drop plans table
    op.drop_index('ix_plans_is_default', table_name='plans')
    op.drop_index('ix_plans_tier', table_name='plans')
    op.drop_table('plans')
