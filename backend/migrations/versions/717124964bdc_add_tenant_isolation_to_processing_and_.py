"""add tenant isolation to processing and chick supply

Revision ID: 717124964bdc
Revises: 527805ea7a07
Create Date: 2026-07-18

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "717124964bdc"
down_revision: Union[str, Sequence[str], None] = "527805ea7a07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS broiler_chick_supply (
            id SERIAL PRIMARY KEY,
            company_id INTEGER,
            week_ending TEXT NOT NULL,
            available_chicks INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    op.execute(
        """
        ALTER TABLE broiler_processing
        ADD COLUMN IF NOT EXISTS company_id INTEGER
        """
    )

def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE broiler_processing
        ADD COLUMN IF NOT EXISTS company_id INTEGER
        """
    )

    op.execute(
        """
        UPDATE broiler_processing AS processing
        SET company_id = cycles.company_id
        FROM broiler_placement_plans AS cycles
        WHERE processing.broiler_cycle_id = cycles.id
          AND processing.company_id IS NULL
        """
    )

    op.execute(
        """
        ALTER TABLE broiler_chick_supply
        ADD COLUMN IF NOT EXISTS company_id INTEGER
        """
    )

    op.execute(
        """
        UPDATE broiler_chick_supply
        SET company_id = 1
        WHERE company_id IS NULL
        """
    )

    op.execute(
        """
        ALTER TABLE broiler_chick_supply
        DROP CONSTRAINT IF EXISTS
        broiler_chick_supply_week_ending_key
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS
        ux_broiler_chick_supply_company_week
        ON broiler_chick_supply (
            company_id,
            week_ending
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS
        ux_broiler_chick_supply_company_week
        """
    )

    op.execute(
        """
        ALTER TABLE broiler_chick_supply
        DROP COLUMN IF EXISTS company_id
        """
    )

    op.execute(
        """
        ALTER TABLE broiler_processing
        DROP COLUMN IF EXISTS company_id
        """
    )