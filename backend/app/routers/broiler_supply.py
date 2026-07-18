from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.routers.auth import get_current_user


router = APIRouter(
    prefix="/api/broilers",
    tags=["Broiler Supply"],
)


class ChickSupplyPayload(BaseModel):
    week_ending: str
    available_chicks: int
    notes: Optional[str] = None
    company_id: Optional[int] = None


def resolve_company_id(
    current_user: models.AppUser,
    requested_company_id: Optional[int],
) -> int:
    if current_user.is_global_admin:
        company_id = (
            requested_company_id
            if requested_company_id is not None
            else current_user.company_id
        )

        if company_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="company_id is required",
            )

        return company_id

    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not assigned to a company",
        )

    if (
        requested_company_id is not None
        and requested_company_id
        != current_user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this company",
        )

    return current_user.company_id


@router.get("/chick-supply-summary")
def get_chick_supply_summary(
    company_id: Optional[int] = Query(default=None),
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    supply_row = db.execute(
        text(
            """
            SELECT
                COALESCE(
                    SUM(available_chicks),
                    0
                ) AS available_chicks
            FROM broiler_chick_supply
            WHERE company_id = :company_id
            """
        ),
        {
            "company_id": resolved_company_id,
        },
    ).mappings().first()

    available_chicks = 0

    if supply_row is not None:
        available_chicks = int(
            supply_row["available_chicks"] or 0
        )

    return {
        "company_id": resolved_company_id,
        "available_chicks": available_chicks,
    }


@router.get("/chick-supply")
def list_chick_supply(
    company_id: Optional[int] = Query(default=None),
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    rows = db.execute(
        text(
            """
            SELECT
                id,
                company_id,
                week_ending,
                available_chicks,
                notes,
                created_at,
                updated_at
            FROM broiler_chick_supply
            WHERE company_id = :company_id
            ORDER BY week_ending
            """
        ),
        {
            "company_id": resolved_company_id,
        },
    ).mappings().all()

    return [dict(row) for row in rows]


@router.post("/chick-supply")
def upsert_chick_supply(
    payload: ChickSupplyPayload,
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    resolved_company_id = resolve_company_id(
        current_user,
        payload.company_id,
    )

    existing = db.execute(
        text(
            """
            SELECT id
            FROM broiler_chick_supply
            WHERE company_id = :company_id
              AND week_ending = :week_ending
            """
        ),
        {
            "company_id": resolved_company_id,
            "week_ending": payload.week_ending,
        },
    ).mappings().first()

    values = {
        "company_id": resolved_company_id,
        "week_ending": payload.week_ending,
        "available_chicks": (
            payload.available_chicks
        ),
        "notes": payload.notes,
    }

    if existing:
        db.execute(
            text(
                """
                UPDATE broiler_chick_supply
                SET
                    available_chicks =
                        :available_chicks,
                    notes = :notes,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE company_id = :company_id
                  AND week_ending = :week_ending
                """
            ),
            values,
        )
    else:
        db.execute(
            text(
                """
                INSERT INTO broiler_chick_supply (
                    company_id,
                    week_ending,
                    available_chicks,
                    notes
                )
                VALUES (
                    :company_id,
                    :week_ending,
                    :available_chicks,
                    :notes
                )
                """
            ),
            values,
        )

    db.commit()

    return {
        "status": "saved",
        "company_id": resolved_company_id,
        "week_ending": payload.week_ending,
        "available_chicks": (
            payload.available_chicks
        ),
        "notes": payload.notes,
    }