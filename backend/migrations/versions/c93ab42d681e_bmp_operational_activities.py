"""Store operational BMP activity records on layer flock lifecycle records."""
from alembic import op
import sqlalchemy as sa
revision = 'c93ab42d681e'
down_revision = 'b84fa2d691c3'
branch_labels = None
depends_on = None


def upgrade():
    for table in ('layer_rearing_flocks', 'commercial_layer_flocks'):
        op.add_column(table, sa.Column('bmp_activity_state', sa.JSON(), nullable=True))


def downgrade():
    raise RuntimeError('Operational audit records may exist; restore verified backup instead.')
