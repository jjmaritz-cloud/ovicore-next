"""Persist layer and rearing BMP snapshots and assignment audit history."""
from alembic import op
import sqlalchemy as sa
revision = "b84fa2d691c3"
down_revision = "a73e9c02b514"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("layer_rearing_flocks", "commercial_layer_flocks"):
        op.add_column(table, sa.Column("bmp_snapshot", sa.JSON(), nullable=True))
        op.add_column(table, sa.Column("bmp_assignment_history", sa.JSON(), nullable=True))


def downgrade():
    raise RuntimeError("Unsafe downgrade: flock assignment history may exist. Restore a verified backup instead.")
