"""Add BMP effective dates and supersession history without altering legacy versions."""
from alembic import op
import sqlalchemy as sa
revision = 'a73e9c02b514'
down_revision = 'f61b8d04a923'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bmp_versions') as batch:
        batch.add_column(sa.Column('effective_date', sa.Date(), nullable=True))
        batch.add_column(sa.Column('change_summary', sa.Text(), nullable=True))
        batch.add_column(sa.Column('superseded_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('superseded_by_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_bmp_superseded_by', 'bmp_versions', ['superseded_by_id'], ['id'])


def downgrade():
    raise RuntimeError('Unsafe downgrade: BMP release history may exist. Restore a verified backup instead.')
