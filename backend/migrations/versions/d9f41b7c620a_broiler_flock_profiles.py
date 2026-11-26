"""Company-scoped additional broiler flock profile.

Revision ID: d9f41b7c620a
Revises: cab827a1f041
"""
from alembic import op
import sqlalchemy as sa
revision = "d9f41b7c620a"
down_revision = "cab827a1f041"
branch_labels = None
depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table("broiler_flock_profiles"):
        op.create_table("broiler_flock_profiles",
            sa.Column("placement_plan_id", sa.Integer(), sa.ForeignKey("broiler_placement_plans.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("details", sa.JSON(), nullable=False))
        op.create_index("ix_broiler_flock_profiles_company_id", "broiler_flock_profiles", ["company_id"])


def downgrade():
    op.drop_table("broiler_flock_profiles")
