from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(
    prefix="/api/broilers",
    tags=["Broiler Supply"],
)


class ChickSupplyPayload(BaseModel):
    week_ending: str
    available_chicks: int
    notes: Optional[str] = None


def ensure_chick_supply_table(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS broiler_chick_supply (
                id SERIAL PRIMARY KEY,
                week_ending TEXT NOT NULL UNIQUE,
                available_chicks INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    db.commit()


@router.get("/chick-supply-summary")
def get_chick_supply_summary(db: Session = Depends(get_db)):
    ensure_chick_supply_table(db)

    supply_row = db.execute(
        text(
            """
            SELECT COALESCE(SUM(available_chicks), 0) AS available_chicks
            FROM broiler_chick_supply
            """
        )
    ).mappings().first()

    available_chicks = 0

    if supply_row is not None:
        available_chicks = int(supply_row["available_chicks"] or 0)

    return {
        "available_chicks": available_chicks,
    }


@router.get("/chick-supply")
def list_chick_supply(db: Session = Depends(get_db)):
    ensure_chick_supply_table(db)

    rows = db.execute(
        text(
            """
            SELECT
                id,
                week_ending,
                available_chicks,
                notes,
                created_at,
                updated_at
            FROM broiler_chick_supply
            ORDER BY week_ending
            """
        )
    ).mappings().all()

    return [dict(row) for row in rows]


@router.post("/chick-supply")
def upsert_chick_supply(payload: ChickSupplyPayload, db: Session = Depends(get_db)):
    ensure_chick_supply_table(db)

    existing = db.execute(
        text(
            """
            SELECT id
            FROM broiler_chick_supply
            WHERE week_ending = :week_ending
            """
        ),
        {"week_ending": payload.week_ending},
    ).mappings().first()

    if existing:
        db.execute(
            text(
                """
                UPDATE broiler_chick_supply
                SET
                    available_chicks = :available_chicks,
                    notes = :notes,
                    updated_at = CURRENT_TIMESTAMP
                WHERE week_ending = :week_ending
                """
            ),
            {
                "week_ending": payload.week_ending,
                "available_chicks": payload.available_chicks,
                "notes": payload.notes,
            },
        )
    else:
        db.execute(
            text(
                """
                INSERT INTO broiler_chick_supply (
                    week_ending,
                    available_chicks,
                    notes
                )
                VALUES (
                    :week_ending,
                    :available_chicks,
                    :notes
                )
                """
            ),
            {
                "week_ending": payload.week_ending,
                "available_chicks": payload.available_chicks,
                "notes": payload.notes,
            },
        )

    db.commit()

    return {
        "status": "saved",
        "week_ending": payload.week_ending,
        "available_chicks": payload.available_chicks,
        "notes": payload.notes,
    }