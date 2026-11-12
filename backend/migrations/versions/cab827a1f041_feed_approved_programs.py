"""Approved feeding program versions and assigned flock links.

Revision ID: cab827a1f041
Revises: 717124964bdc
"""
from alembic import op
import sqlalchemy as sa

revision = "cab827a1f041"
down_revision = "717124964bdc"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("feed_approved_programs"):
        op.create_table("feed_approved_programs",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("mill_id", sa.String(64), nullable=False),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("stages", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("created_by", sa.String(160), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("company_id", "mill_id", "name", "version", name="uq_feed_program_version"))
        op.create_index("ix_feed_approved_programs_company_id", "feed_approved_programs", ["company_id"])
    if not inspector.has_table("feed_flock_program_links"):
        op.create_table("feed_flock_program_links",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("flock_id", sa.Integer(), nullable=False),
            sa.Column("program_id", sa.String(64), nullable=False),
            sa.Column("assigned_by", sa.String(160), nullable=False),
            sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("company_id", "flock_id", name="uq_feed_flock_program"))
        op.create_index("ix_feed_flock_program_links_company_id", "feed_flock_program_links", ["company_id"])
        op.create_index("ix_feed_flock_program_links_flock_id", "feed_flock_program_links", ["flock_id"])


def downgrade():
    # Preserve historical feeding-program evidence. Destructive rollback is intentionally disabled.
    raise RuntimeError("Manual migration rollback required; feed program history must be preserved")
