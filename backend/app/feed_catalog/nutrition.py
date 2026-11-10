"""Immutable, effective-dated, company-scoped mill-formulated nutrition declarations.

Missing nutrient values are represented as None, never inferred from protein or
other ingredients. These are *declared formulation targets*, not lab verified.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import Column, Date, DateTime, ForeignKeyConstraint, Integer, JSON, String, UniqueConstraint, select
from sqlalchemy.orm import Session

NUTRIENTS = {
    "amen_mj_kg": (0, 25),
    "total_lysine_pct": (0, 5),
    "digestible_lysine_pct": (0, 5),
    "digestible_methionine_pct": (0, 5),
    "digestible_met_cys_pct": (0, 6),
    "digestible_threonine_pct": (0, 5),
    "digestible_tryptophan_pct": (0, 5),
    "crude_protein_pct": (0, 50),
    "calcium_pct": (0, 20),
    "available_phosphorus_pct": (0, 5),
    "sodium_pct": (0, 5),
}


def declare_nutrition_model(Base):
    class RationNutritionSpec(Base):
        __tablename__ = "feed_ration_nutrition_versions"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, nullable=False, index=True)
        ration_id = Column(String(64), nullable=False)
        version = Column(Integer, nullable=False)
        effective_from = Column(Date, nullable=False)
        source = Column(String(50), nullable=False)
        reference = Column(String(255), nullable=False, default="")
        values = Column(JSON, nullable=False)
        created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
        created_by = Column(String(255), nullable=False)
        __table_args__ = (
            ForeignKeyConstraint(["company_id", "ration_id"], ["feed_rations.company_id", "feed_rations.id"], name="fk_nutrient_ration_company"),
            UniqueConstraint("company_id", "ration_id", "version", name="uq_nutrient_ration_version"),
            UniqueConstraint("company_id", "ration_id", "effective_from", name="uq_nutrient_ration_date"),
        )
    return RationNutritionSpec


class NutritionSpecIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    effective_from: date
    source: str = Field(pattern=r"^(Mill formulated|Reference estimate)$")
    reference: str = Field(default="", max_length=255)
    values: dict[str, Decimal | None]

    @model_validator(mode="after")
    def validate_values(self):
        if not self.values or not any(value is not None for value in self.values.values()):
            raise ValueError("At least one nutrient value is required")
        for key, value in self.values.items():
            if key not in NUTRIENTS:
                raise ValueError(f"Unsupported nutrient: {key}")
            if value is not None:
                low, high = NUTRIENTS[key]
                if not value.is_finite() or not (Decimal(str(low)) < value <= Decimal(str(high))):
                    raise ValueError(f"Invalid {key}; expected positive value <= {high}")
        if (self.values.get("digestible_lysine_pct") is not None
                and self.values.get("total_lysine_pct") is not None
                and self.values["digestible_lysine_pct"] > self.values["total_lysine_pct"]):
            raise ValueError("Digestible lysine cannot exceed total lysine")
        return self


def nutrient_intake(values: dict, feed_g_bird_day: float) -> dict:
    """Preview only. Values belong to an explicitly selected ration specification."""
    amount = Decimal(str(feed_g_bird_day))
    if not amount.is_finite() or not 0 < amount <= 250:
        raise ValueError("Feed intake must be above 0 and at most 250 g/bird/day")
    def calc(key, multiplier):
        value = values.get(key)
        return round(float(amount * Decimal(str(value)) * multiplier), 2) if value is not None else None
    return {
        "kcal_bird_day": calc("amen_mj_kg", Decimal("0.239005736")),  # g/day * MJ/kg * 239.005736 / 1000
        "digestible_lysine_mg_bird_day": calc("digestible_lysine_pct", Decimal("10")),  # g/day * % /100 *1000
        "total_lysine_mg_bird_day": calc("total_lysine_pct", Decimal("10")),
        "digestible_met_cys_mg_bird_day": calc("digestible_met_cys_pct", Decimal("10")),
    }


def attach_nutrition_routes(router, get_db, get_current_user, require_feed_editor, company, models):
    _, _, Ration = models
    Spec = Ration.NutritionSpec

    def serial(item):
        return {"id": item.id, "ration_id": item.ration_id, "version": item.version,
                "effective_from": item.effective_from.isoformat(), "source": item.source,
                "reference": item.reference, "values": item.values,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "created_by": item.created_by}

    @router.get("/rations/{ration_id}/nutrition")
    def read_nutrition(ration_id: str, company_id: int | None = Query(None, ge=1),
                       db: Session = Depends(get_db), user=Depends(get_current_user)):
        cid = company(db, user, company_id)
        ration = db.execute(select(Ration).where(Ration.company_id == cid, Ration.id == ration_id)).scalar_one_or_none()
        if ration is None:
            raise HTTPException(404, "Ration not found")
        rows = db.execute(select(Spec).where(Spec.company_id == cid, Spec.ration_id == ration_id)
                          .order_by(Spec.effective_from.desc(), Spec.version.desc())).scalars().all()
        return {"ration_id": ration_id, "versions": [serial(row) for row in rows]}

    @router.post("/rations/{ration_id}/nutrition", status_code=201)
    def save_nutrition(ration_id: str, data: NutritionSpecIn,
                       company_id: int | None = Query(None, ge=1),
                       db: Session = Depends(get_db), user=Depends(get_current_user),
                       _editor=Depends(require_feed_editor)):
        cid = company(db, user, company_id)
        ration = db.execute(select(Ration).where(Ration.company_id == cid, Ration.id == ration_id)).scalar_one_or_none()
        if ration is None:
            raise HTTPException(404, "Ration not found")
        prior = db.execute(select(Spec).where(Spec.company_id == cid, Spec.ration_id == ration_id)
                           .order_by(Spec.version.desc())).scalars().all()
        if any(row.effective_from == data.effective_from for row in prior):
            raise HTTPException(409, "This effective date already has an immutable nutrient specification")
        # Require increasing dates so older versions cannot be entered retrospectively
        # without a formal backfill/reconciliation process.
        if prior and data.effective_from <= max(row.effective_from for row in prior):
            raise HTTPException(422, "New nutrient specification must have a later effective date")
        item = Spec(id=str(uuid4()), company_id=cid, ration_id=ration_id,
                    version=1 + max((row.version for row in prior), default=0),
                    effective_from=data.effective_from, source=data.source,
                    reference=data.reference.strip(),
                    values={key: float(value) if value is not None else None for key, value in data.values.items()},
                    created_by=str(getattr(user, "email", "unknown")))
        db.add(item)
        try:
            db.commit()
            db.refresh(item)
        except Exception:
            db.rollback()
            raise
        return serial(item)
