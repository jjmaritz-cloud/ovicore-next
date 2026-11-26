"""Company-scoped flock technical contacts."""
from alembic import op
import sqlalchemy as sa
revision = "e48a02b63c11"
down_revision = "d9f41b7c620a"
branch_labels = None
depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table("flock_technical_contacts"):
        op.create_table("flock_technical_contacts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("role", sa.String(40), nullable=False),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("created_by", sa.String(255), nullable=False),
            sa.UniqueConstraint("company_id", "role", "name", name="uq_flock_contact_company_role_name"))
        op.create_index("ix_flock_technical_contacts_company_id", "flock_technical_contacts", ["company_id"])


def downgrade():
    op.drop_table("flock_technical_contacts")
