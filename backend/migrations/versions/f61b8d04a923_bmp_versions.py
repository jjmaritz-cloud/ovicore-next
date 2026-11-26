"""Company-scoped versioned BMP register."""
from alembic import op
import sqlalchemy as sa
revision = "f61b8d04a923"
down_revision = "e48a02b63c11"
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table("bmp_versions"):
        return
    op.create_table("bmp_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("family_key", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("production_type", sa.String(40), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("tasks", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_by", sa.String(255)), sa.Column("approved_at", sa.DateTime()),
        sa.Column("archived_by", sa.String(255)), sa.Column("archived_at", sa.DateTime()),
        sa.UniqueConstraint("company_id", "family_key", "version", name="uq_bmp_family_version"))
    op.create_index("ix_bmp_versions_company_id", "bmp_versions", ["company_id"])


def downgrade():
    op.drop_table("bmp_versions")
