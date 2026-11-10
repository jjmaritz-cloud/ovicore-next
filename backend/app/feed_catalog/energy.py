"""Snapshot-based energy estimates and dated flock ration assignments.

The existing ingredient form stores Energy in MJ/kg. Converted kcal/kg is an
estimated poultry AMEn only if the entered values are confirmed as AMEn, as-fed.
No default energy values are assumed.
"""
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Date, DateTime, Numeric, JSON, ForeignKey, UniqueConstraint, select
from sqlalchemy.orm import Session


def declare_energy_model(Base):
    class FlockRationEnergyAssignment(Base):
        __tablename__ = "feed_flock_ration_energy_assignments"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
        flock_id = Column(Integer, nullable=False, index=True)
        ration_id = Column(String(64), nullable=False)
        effective_from = Column(Date, nullable=False)
        mill_id = Column(String(64), nullable=False)
        ration_code = Column(String(32), nullable=False)
        ration_name = Column(String(255), nullable=False)
        amen_kcal_kg = Column(Numeric(12, 4), nullable=False)
        ingredient_snapshot = Column(JSON, nullable=False)
        source = Column(String(60), nullable=False, default="OviCore estimated AMEn")
        created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
        created_by = Column(String(255), nullable=False)
        __table_args__ = (UniqueConstraint("company_id", "flock_id", "effective_from", name="uq_feed_energy_flock_date"),)
    return FlockRationEnergyAssignment


# The existing Diet Ingredients form labels its stored `energy` value "Energy (MJ/kg)".
# This conversion is exact: 1 kcal = 4.184 kJ, so 1 MJ = 1000/4.184 kcal.
# It is the nutritionist/user's responsibility to confirm that the entered
# energy is poultry AMEn on an as-fed basis (not GE, DE, or dry-matter ME).
KCAL_PER_MJ = Decimal(1000) / Decimal("4.184")


def parse_amen(value):
    """Convert the Ingredient Register's numeric MJ/kg energy into kcal/kg.

    Missing, explicitly suffixed, negative, and implausible MJ/kg values are
    rejected. Explicit unit strings are rejected because the existing UI only
    accepts numeric MJ/kg and silently guessing units would be unsafe.
    A zero is valid for non-energy ingredients such as limestone.
    """
    if isinstance(value, bool) or value is None:
        return None
    try:
        num = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    if not num.is_finite() or num < 0 or num > 40:
        return None
    return num * KCAL_PER_MJ


def estimate_ration_amen(ration, ingredient_by_id, *, allow_draft_preview=False):
    if ration.status != "Approved" and not (allow_draft_preview and ration.status == "Draft"):
        raise ValueError("Ration must be Approved")
    lines = ration.lines or []
    if not lines or abs(sum(float(line.get("percent", 0)) for line in lines) - 100) > 0.001:
        raise ValueError("Ration inclusions must total 100%")
    total = Decimal(0)
    snapshot = []
    seen = set()
    for line in lines:
        ingredient_id = line.get("ingredientId")
        if ingredient_id in seen:
            raise ValueError("Duplicate ingredient inclusion")
        seen.add(ingredient_id)
        ingredient = ingredient_by_id.get(ingredient_id)
        if ingredient is None or ingredient.company_id != ration.company_id:
            raise ValueError("Ingredient is not in this company")
        inclusion = Decimal(str(line["percent"]))
        if not inclusion.is_finite() or inclusion <= 0:
            raise ValueError("Invalid ingredient inclusion")
        amen = parse_amen(ingredient.energy)
        if amen is None:
            raise ValueError(f"Energy (MJ/kg) missing or invalid for {ingredient.code} ({ingredient.name})")
        total += inclusion * amen / Decimal(100)
        snapshot.append({"ingredientId": ingredient.id, "code": ingredient.code,
                         "name": ingredient.name, "inclusionPct": float(inclusion),
                         "energyMjKgAsFed": float(Decimal(str(ingredient.energy).strip())),
                         "estimatedAmenKcalKgAsFed": float(amen),
                         "amenKcalKgAsFed": float(amen)})
    if total <= 0 or total > 10000:
        raise ValueError("Calculated ration AMEn outside plausible range")
    return round(float(total), 4), snapshot


class AssignmentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flock_id: int = Field(gt=0)
    ration_id: str = Field(min_length=1, max_length=64)
    effective_from: date
    confirmed_actual_change: bool = False


def make_energy_router(get_db, get_current_user, resolve_company_id, has_farm_access,
                       layer_models, feed_models, assignment_model):
    Flock = layer_models
    Ingredient, Ration = feed_models
    Assignment = assignment_model
    router = APIRouter(prefix="/api/feed-operations/energy", tags=["Feed Energy"])

    def check_flock(db, user, company_id, flock_id):
        cid = resolve_company_id(user, company_id)
        flock = db.execute(select(Flock).where(Flock.company_id == cid, Flock.id == flock_id)).scalar_one_or_none()
        if not flock:
            raise HTTPException(404, "Flock not found in selected company")
        if not has_farm_access(db, user, flock.farm_id):
            raise HTTPException(403, "No access to flock farm")
        return cid, flock

    def result(item):
        return {"id": item.id, "flock_id": item.flock_id, "ration_id": item.ration_id,
                "effective_from": item.effective_from.isoformat(), "mill_id": item.mill_id,
                "ration_code": item.ration_code, "ration_name": item.ration_name,
                "amen_kcal_kg": float(item.amen_kcal_kg), "source": item.source,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "created_by": item.created_by}

    def choose_energy(db, cid, ration, ingredients, effective_from):
        """Prefer an explicitly mill-formulated, dated AMEn specification.

        An AMEn value in a generic reference-estimate nutrition version does not
        outrank the ingredient calculation. There is no retrospective editing of
        saved flock assignments; their source and numeric snapshot are immutable.
        """
        Spec = getattr(Ration, "NutritionSpec", None)
        if Spec is not None:
            versions = db.execute(select(Spec).where(
                Spec.company_id == cid, Spec.ration_id == ration.id,
                Spec.effective_from <= effective_from,
                Spec.source == "Mill formulated",
            ).order_by(Spec.effective_from.desc(), Spec.version.desc())).scalars()
            for spec in versions:
                raw = (spec.values or {}).get("amen_mj_kg")
                mj = parse_amen(raw) if raw is not None else None
                if mj is not None and mj > 0:
                    # Store both the mill declaration and its version reference.
                    snapshot = [{"nutritionSpecId": spec.id, "version": spec.version,
                        "effectiveFrom": spec.effective_from.isoformat(),
                        "reference": spec.reference, "millFormulatedAmenMjKgAsFed": float(raw)}]
                    return round(float(mj), 4), snapshot, "Mill formulated AMEn"
        kcal, snapshot = estimate_ration_amen(ration, ingredients)
        return kcal, snapshot, "OviCore estimated AMEn"

    @router.get("/rations")
    def ration_estimates(company_id: int | None = Query(default=None),
                         db: Session = Depends(get_db), user=Depends(get_current_user)):
        cid = resolve_company_id(user, company_id)
        ingredients = {i.id: i for i in db.execute(select(Ingredient).where(Ingredient.company_id == cid)).scalars()}
        response = []
        for ration in db.execute(select(Ration).where(Ration.company_id == cid, Ration.status.in_(["Draft", "Approved"]))).scalars():
            try:
                value, _ = estimate_ration_amen(ration, ingredients, allow_draft_preview=True)
                error = None
            except ValueError as ex:
                value, error = None, str(ex)
            response.append({"id": ration.id, "code": ration.code, "name": ration.name,
                             "mill_id": ration.mill_id, "status": ration.status,
                             "amen_kcal_kg": value, "amen_mj_kg": round(value / float(KCAL_PER_MJ), 4) if value is not None else None,
                             "source": "OviCore estimated AMEn", "error": error})
        return response

    @router.get("/assignments")
    def list_assignments(flock_id: int = Query(gt=0), company_id: int | None = None,
                         db: Session = Depends(get_db), user=Depends(get_current_user)):
        cid, _ = check_flock(db, user, company_id, flock_id)
        assignments = db.execute(select(Assignment).where(Assignment.company_id == cid,
            Assignment.flock_id == flock_id).order_by(Assignment.effective_from)).scalars()
        return [result(a) for a in assignments]

    @router.post("/assignments", status_code=201)
    def assign_ration(body: AssignmentIn, company_id: int | None = None,
                      db: Session = Depends(get_db), user=Depends(get_current_user)):
        cid, flock = check_flock(db, user, company_id, body.flock_id)
        if not (user.is_global_admin or user.is_company_admin):
            raise HTTPException(403, "Company Admin or Global Admin required to confirm ration history")
        if not body.confirmed_actual_change:
            raise HTTPException(422, "Confirm that this ration was actually fed from the entered date")
        ration = db.execute(select(Ration).where(Ration.id == body.ration_id,
            Ration.company_id == cid, Ration.status == "Approved")).scalar_one_or_none()
        if ration is None:
            raise HTTPException(404, "Approved ration not found")
        existing = db.execute(select(Assignment.id).where(Assignment.company_id == cid,
            Assignment.flock_id == flock.id, Assignment.effective_from == body.effective_from)).first()
        if existing:
            raise HTTPException(409, "An assignment already exists on this date; immutable records cannot be overwritten")
        ingredients = {i.id: i for i in db.execute(select(Ingredient).where(Ingredient.company_id == cid)).scalars()}
        try:
            amen, snapshot, source = choose_energy(db, cid, ration, ingredients, body.effective_from)
        except ValueError as ex:
            raise HTTPException(422, str(ex)) from ex
        item = Assignment(id=str(uuid4()), company_id=cid, flock_id=flock.id,
            ration_id=ration.id, effective_from=body.effective_from,
            mill_id=ration.mill_id, ration_code=ration.code, ration_name=ration.name,
            amen_kcal_kg=amen, ingredient_snapshot=snapshot, source=source,
            created_by=str(getattr(user, "email", "unknown")))
        db.add(item)
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
        db.refresh(item)
        return result(item)

    return router
