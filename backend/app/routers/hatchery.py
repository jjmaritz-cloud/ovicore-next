from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import models
from app.db import get_db
from app.routers.auth import get_current_user
from app.schemas import (
    HatcheryEggReceiptCreate,
    HatcheryEggReceiptOut,
    HatcheryEggReceiptPatch,
    HatcherySetterBatchCreate,
    HatcherySetterBatchOut,
    HatcherySetterBatchPatch,
    HatcheryHatchResultCreate,
    HatcheryHatchResultOut,
    HatcheryHatchResultPatch,
    HatcheryChickAvailabilityCreate,
    HatcheryChickAvailabilityOut,
    HatcheryChickAvailabilityPatch,
)


router = APIRouter(
    prefix="/api/hatchery",
    tags=["Hatchery"],
)


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
        and requested_company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this company",
        )

    return current_user.company_id


def user_has_farm_access(
    db: Session,
    current_user: models.AppUser,
    farm_id: int,
) -> bool:
    if current_user.is_global_admin or current_user.is_company_admin:
        return True

    return (
        db.query(models.UserFarmAccess.id)
        .filter(
            models.UserFarmAccess.user_id == current_user.id,
            models.UserFarmAccess.farm_id == farm_id,
        )
        .first()
        is not None
    )


def get_production_flock(
    db: Session,
    current_user: models.AppUser,
    flock_id: int,
) -> models.BreederProductionFlock:
    flock = (
        db.query(models.BreederProductionFlock)
        .options(
            joinedload(models.BreederProductionFlock.farm),
            joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.BreederProductionFlock.id == flock_id)
        .first()
    )

    if flock is None:
        raise HTTPException(
            status_code=404,
            detail="Breeder Production flock not found",
        )

    if (
        not current_user.is_global_admin
        and flock.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    if not user_has_farm_access(db, current_user, flock.farm_id):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this Breeder Production farm",
        )

    return flock


def hatching_eggs_produced_to_date(
    db: Session,
    flock_id: int,
    through_date: date,
) -> int:
    value = (
        db.query(func.coalesce(func.sum(models.BreederProductionDailyPerformance.hatching_eggs), 0))
        .filter(
            models.BreederProductionDailyPerformance.flock_id == flock_id,
            models.BreederProductionDailyPerformance.entry_date <= through_date,
        )
        .scalar()
    )
    return int(value or 0)


def eggs_received_to_date(
    db: Session,
    flock_id: int,
    through_date: date,
    exclude_receipt_id: Optional[int] = None,
) -> int:
    query = db.query(
        func.coalesce(func.sum(models.HatcheryEggReceipt.total_eggs_received), 0)
    ).filter(
        models.HatcheryEggReceipt.breeder_production_flock_id == flock_id,
        models.HatcheryEggReceipt.receipt_date <= through_date,
    )

    if exclude_receipt_id is not None:
        query = query.filter(models.HatcheryEggReceipt.id != exclude_receipt_id)

    return int(query.scalar() or 0)


def allocated_eggs(
    db: Session,
    receipt_id: int,
    exclude_batch_id: Optional[int] = None,
) -> int:
    query = db.query(
        func.coalesce(func.sum(models.HatcherySetterBatch.eggs_set), 0)
    ).filter(models.HatcherySetterBatch.egg_receipt_id == receipt_id)

    if exclude_batch_id is not None:
        query = query.filter(models.HatcherySetterBatch.id != exclude_batch_id)

    return int(query.scalar() or 0)


def recalculate_receipt(receipt: models.HatcheryEggReceipt) -> None:
    total = int(receipt.total_eggs_received or 0)
    floor = int(receipt.floor_eggs or 0)
    cracked = int(receipt.cracked_eggs or 0)
    dirty = int(receipt.dirty_eggs or 0)

    for label, value in {
        "Total eggs received": total,
        "Floor eggs": floor,
        "Cracked eggs": cracked,
        "Dirty eggs": dirty,
    }.items():
        if value < 0:
            raise HTTPException(
                status_code=400,
                detail=f"{label} cannot be negative",
            )

    rejected = floor + cracked + dirty

    if rejected > total:
        raise HTTPException(
            status_code=400,
            detail="Floor, cracked and dirty eggs cannot exceed total eggs received",
        )

    receipt.rejected_eggs = rejected
    receipt.settable_eggs = total - rejected

    reject_pct = (rejected / total) * 100 if total > 0 else 0
    receipt.status = (
        "Ready"
        if reject_pct <= 3
        else "Review"
        if reject_pct <= 5
        else "Hold"
    )


def calculate_expected_chicks(
    eggs_set: int,
    fertility_pct: Optional[float],
    hatchability_pct: Optional[float],
) -> Optional[int]:
    if fertility_pct is None or hatchability_pct is None:
        return None

    if not 0 <= fertility_pct <= 100:
        raise HTTPException(
            status_code=400,
            detail="Expected fertility % must be between 0 and 100",
        )

    if not 0 <= hatchability_pct <= 100:
        raise HTTPException(
            status_code=400,
            detail="Expected hatchability % must be between 0 and 100",
        )

    return round(
        eggs_set
        * (fertility_pct / 100)
        * (hatchability_pct / 100)
    )


def build_receipt_response(
    db: Session,
    receipt: models.HatcheryEggReceipt,
) -> HatcheryEggReceiptOut:
    flock = receipt.breeder_production_flock
    produced = hatching_eggs_produced_to_date(
        db,
        receipt.breeder_production_flock_id,
        receipt.receipt_date,
    )
    received = eggs_received_to_date(
        db,
        receipt.breeder_production_flock_id,
        receipt.receipt_date,
    )
    allocated = allocated_eggs(db, receipt.id)

    reject_pct = (
        round((int(receipt.rejected_eggs or 0) / int(receipt.total_eggs_received or 0)) * 100, 3)
        if int(receipt.total_eggs_received or 0) > 0
        else None
    )

    age_days = (
        (receipt.receipt_date - flock.hatch_date).days
        if flock and flock.hatch_date is not None
        else None
    )

    return HatcheryEggReceiptOut(
        id=receipt.id,
        company_id=receipt.company_id,
        breeder_production_flock_id=receipt.breeder_production_flock_id,
        breeder_flock_code=flock.flock_code if flock else "",
        breeder_farm_name=(flock.farm.farm_name if flock and flock.farm else ""),
        breeder_shed_name=(flock.shed.shed_name if flock and flock.shed else ""),
        breed=flock.breed if flock else None,
        flock_age_days=age_days,
        receipt_date=receipt.receipt_date,
        total_eggs_received=int(receipt.total_eggs_received or 0),
        floor_eggs=int(receipt.floor_eggs or 0),
        cracked_eggs=int(receipt.cracked_eggs or 0),
        dirty_eggs=int(receipt.dirty_eggs or 0),
        rejected_eggs=int(receipt.rejected_eggs or 0),
        settable_eggs=int(receipt.settable_eggs or 0),
        reject_pct=reject_pct,
        avg_egg_weight_g=(float(receipt.avg_egg_weight_g) if receipt.avg_egg_weight_g is not None else None),
        storage_room=receipt.storage_room,
        status=receipt.status,
        notes=receipt.notes,
        hatching_eggs_produced_to_date=produced,
        eggs_received_to_date=received,
        unreceived_hatching_eggs=max(0, produced - received),
        eggs_allocated_to_setters=allocated,
        unallocated_settable_eggs=max(0, int(receipt.settable_eggs or 0) - allocated),
        last_saved_by=receipt.last_saved_by,
        last_saved_at=receipt.last_saved_at,
    )


def get_receipt(
    db: Session,
    current_user: models.AppUser,
    receipt_id: int,
) -> models.HatcheryEggReceipt:
    receipt = (
        db.query(models.HatcheryEggReceipt)
        .options(
            joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcheryEggReceipt.id == receipt_id)
        .first()
    )

    if receipt is None:
        raise HTTPException(status_code=404, detail="Hatchery egg receipt not found")

    get_production_flock(
        db,
        current_user,
        receipt.breeder_production_flock_id,
    )

    return receipt


def build_setter_response(
    db: Session,
    batch: models.HatcherySetterBatch,
) -> HatcherySetterBatchOut:
    receipt = batch.egg_receipt
    flock = receipt.breeder_production_flock if receipt else None
    allocated = allocated_eggs(db, batch.egg_receipt_id)

    return HatcherySetterBatchOut(
        id=batch.id,
        company_id=batch.company_id,
        egg_receipt_id=batch.egg_receipt_id,
        breeder_production_flock_id=(receipt.breeder_production_flock_id if receipt else 0),
        breeder_flock_code=flock.flock_code if flock else "",
        breeder_farm_name=(flock.farm.farm_name if flock and flock.farm else ""),
        breeder_shed_name=(flock.shed.shed_name if flock and flock.shed else ""),
        set_date=batch.set_date,
        setter_name=batch.setter_name,
        eggs_set=int(batch.eggs_set or 0),
        expected_fertility_pct=(float(batch.expected_fertility_pct) if batch.expected_fertility_pct is not None else None),
        expected_hatchability_pct=(float(batch.expected_hatchability_pct) if batch.expected_hatchability_pct is not None else None),
        expected_chicks=batch.expected_chicks,
        hatch_date=batch.hatch_date,
        status=batch.status,
        notes=batch.notes,
        receipt_settable_eggs=int(receipt.settable_eggs or 0) if receipt else 0,
        eggs_allocated_from_receipt=allocated,
        eggs_remaining_on_receipt=max(0, int(receipt.settable_eggs or 0) - allocated) if receipt else 0,
        last_saved_by=batch.last_saved_by,
        last_saved_at=batch.last_saved_at,
    )


@router.get(
    "/egg-receipts",
    response_model=list[HatcheryEggReceiptOut],
)
def list_egg_receipts(
    company_id: Optional[int] = Query(default=None),
    breeder_production_flock_id: Optional[int] = Query(default=None),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(current_user, company_id)

    query = (
        db.query(models.HatcheryEggReceipt)
        .options(
            joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcheryEggReceipt.company_id == resolved_company_id)
    )

    if breeder_production_flock_id is not None:
        get_production_flock(db, current_user, breeder_production_flock_id)
        query = query.filter(
            models.HatcheryEggReceipt.breeder_production_flock_id
            == breeder_production_flock_id
        )
    elif not (current_user.is_global_admin or current_user.is_company_admin):
        permitted = db.query(models.UserFarmAccess.farm_id).filter(
            models.UserFarmAccess.user_id == current_user.id
        )
        query = query.join(models.BreederProductionFlock).filter(
            models.BreederProductionFlock.farm_id.in_(permitted)
        )

    rows = query.order_by(
        models.HatcheryEggReceipt.receipt_date.desc(),
        models.HatcheryEggReceipt.id.desc(),
    ).all()

    return [build_receipt_response(db, row) for row in rows]


@router.post(
    "/egg-receipts",
    response_model=HatcheryEggReceiptOut,
)
def create_egg_receipt(
    payload: HatcheryEggReceiptCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flock = get_production_flock(
        db,
        current_user,
        payload.breeder_production_flock_id,
    )

    resolved_company_id = resolve_company_id(current_user, payload.company_id)
    if resolved_company_id != flock.company_id:
        raise HTTPException(
            status_code=400,
            detail="The selected company does not match the Breeder Production flock",
        )

    produced = hatching_eggs_produced_to_date(
        db,
        flock.id,
        payload.receipt_date,
    )
    previously_received = eggs_received_to_date(
        db,
        flock.id,
        payload.receipt_date,
    )
    available = max(0, produced - previously_received)

    if payload.total_eggs_received > available:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Eggs received cannot exceed the unreconciled hatching-egg "
                f"position of {available:,} for this flock as at "
                f"{payload.receipt_date.isoformat()}."
            ),
        )

    receipt = models.HatcheryEggReceipt(
        company_id=flock.company_id,
        breeder_production_flock_id=flock.id,
        receipt_date=payload.receipt_date,
        total_eggs_received=payload.total_eggs_received,
        floor_eggs=payload.floor_eggs,
        cracked_eggs=payload.cracked_eggs,
        dirty_eggs=payload.dirty_eggs,
        avg_egg_weight_g=payload.avg_egg_weight_g,
        storage_room=(payload.storage_room.strip() if payload.storage_room else None),
        notes=(payload.notes.strip() if payload.notes else ""),
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )
    recalculate_receipt(receipt)

    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return build_receipt_response(
        db,
        get_receipt(db, current_user, receipt.id),
    )


@router.patch(
    "/egg-receipts/{receipt_id}",
    response_model=HatcheryEggReceiptOut,
)
def update_egg_receipt(
    receipt_id: int,
    payload: HatcheryEggReceiptPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receipt = get_receipt(db, current_user, receipt_id)
    data = payload.model_dump(exclude_unset=True)

    for field in (
        "total_eggs_received",
        "floor_eggs",
        "cracked_eggs",
        "dirty_eggs",
    ):
        if field in data and data[field] is not None and data[field] < 0:
            raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').title()} cannot be negative")

    for field in ("storage_room", "notes"):
        if field in data:
            data[field] = data[field].strip() if data[field] else ("" if field == "notes" else None)

    target_date = data.get("receipt_date", receipt.receipt_date)
    target_total = int(data.get("total_eggs_received", receipt.total_eggs_received) or 0)
    produced = hatching_eggs_produced_to_date(
        db,
        receipt.breeder_production_flock_id,
        target_date,
    )
    other_received = eggs_received_to_date(
        db,
        receipt.breeder_production_flock_id,
        target_date,
        exclude_receipt_id=receipt.id,
    )
    available_for_this_receipt = max(0, produced - other_received)

    if target_total > available_for_this_receipt:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Eggs received cannot exceed the unreconciled hatching-egg "
                f"position of {available_for_this_receipt:,} for this flock."
            ),
        )

    for field, value in data.items():
        setattr(receipt, field, value)

    recalculate_receipt(receipt)

    already_allocated = allocated_eggs(db, receipt.id)
    if already_allocated > int(receipt.settable_eggs or 0):
        raise HTTPException(
            status_code=409,
            detail=(
                "This change would reduce settable eggs below the number "
                "already allocated to setters. Adjust the setter program first."
            ),
        )

    receipt.last_saved_by = current_user.full_name
    receipt.last_saved_at = datetime.utcnow()
    db.commit()

    return build_receipt_response(
        db,
        get_receipt(db, current_user, receipt.id),
    )


@router.get(
    "/setter-batches",
    response_model=list[HatcherySetterBatchOut],
)
def list_setter_batches(
    company_id: Optional[int] = Query(default=None),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(current_user, company_id)

    query = (
        db.query(models.HatcherySetterBatch)
        .options(
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcherySetterBatch.company_id == resolved_company_id)
    )

    if not (current_user.is_global_admin or current_user.is_company_admin):
        permitted = db.query(models.UserFarmAccess.farm_id).filter(
            models.UserFarmAccess.user_id == current_user.id
        )
        query = (
            query.join(models.HatcheryEggReceipt)
            .join(models.BreederProductionFlock)
            .filter(models.BreederProductionFlock.farm_id.in_(permitted))
        )

    rows = query.order_by(
        models.HatcherySetterBatch.set_date.asc(),
        models.HatcherySetterBatch.id.asc(),
    ).all()

    return [build_setter_response(db, row) for row in rows]


@router.post(
    "/setter-batches",
    response_model=HatcherySetterBatchOut,
)
def create_setter_batch(
    payload: HatcherySetterBatchCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receipt = get_receipt(db, current_user, payload.egg_receipt_id)
    resolved_company_id = resolve_company_id(current_user, payload.company_id)

    if resolved_company_id != receipt.company_id:
        raise HTTPException(
            status_code=400,
            detail="The selected company does not match the egg receipt",
        )

    if payload.eggs_set <= 0:
        raise HTTPException(status_code=400, detail="Eggs set must be greater than zero")

    already_allocated = allocated_eggs(db, receipt.id)
    available = max(0, int(receipt.settable_eggs or 0) - already_allocated)

    if payload.eggs_set > available:
        raise HTTPException(
            status_code=400,
            detail=f"Eggs set cannot exceed the {available:,} unallocated settable eggs on this receipt",
        )

    expected_chicks = calculate_expected_chicks(
        payload.eggs_set,
        payload.expected_fertility_pct,
        payload.expected_hatchability_pct,
    )

    batch = models.HatcherySetterBatch(
        company_id=receipt.company_id,
        egg_receipt_id=receipt.id,
        set_date=payload.set_date,
        setter_name=payload.setter_name.strip(),
        eggs_set=payload.eggs_set,
        expected_fertility_pct=payload.expected_fertility_pct,
        expected_hatchability_pct=payload.expected_hatchability_pct,
        expected_chicks=expected_chicks,
        hatch_date=payload.set_date + timedelta(days=21),
        status="Planned",
        notes=(payload.notes.strip() if payload.notes else ""),
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    if not batch.setter_name:
        raise HTTPException(status_code=400, detail="Setter name is required")

    db.add(batch)
    db.commit()
    db.refresh(batch)

    batch = (
        db.query(models.HatcherySetterBatch)
        .options(
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcherySetterBatch.id == batch.id)
        .first()
    )

    return build_setter_response(db, batch)


@router.patch(
    "/setter-batches/{batch_id}",
    response_model=HatcherySetterBatchOut,
)
def update_setter_batch(
    batch_id: int,
    payload: HatcherySetterBatchPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch = (
        db.query(models.HatcherySetterBatch)
        .options(
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcherySetterBatch.id == batch_id)
        .first()
    )

    if batch is None:
        raise HTTPException(status_code=404, detail="Setter batch not found")

    receipt = get_receipt(db, current_user, batch.egg_receipt_id)
    data = payload.model_dump(exclude_unset=True)

    target_eggs = int(data.get("eggs_set", batch.eggs_set) or 0)
    if target_eggs <= 0:
        raise HTTPException(status_code=400, detail="Eggs set must be greater than zero")

    allocated_elsewhere = allocated_eggs(
        db,
        receipt.id,
        exclude_batch_id=batch.id,
    )
    available_for_this_batch = max(0, int(receipt.settable_eggs or 0) - allocated_elsewhere)

    if target_eggs > available_for_this_batch:
        raise HTTPException(
            status_code=400,
            detail=f"Eggs set cannot exceed the {available_for_this_batch:,} eggs available to this batch",
        )

    if "setter_name" in data:
        data["setter_name"] = (data["setter_name"] or "").strip()
        if not data["setter_name"]:
            raise HTTPException(status_code=400, detail="Setter name is required")

    if "notes" in data:
        data["notes"] = data["notes"].strip() if data["notes"] else ""

    for field, value in data.items():
        setattr(batch, field, value)

    batch.eggs_set = target_eggs
    if "set_date" in data:
        batch.hatch_date = batch.set_date + timedelta(days=21)

    batch.expected_chicks = calculate_expected_chicks(
        batch.eggs_set,
        float(batch.expected_fertility_pct) if batch.expected_fertility_pct is not None else None,
        float(batch.expected_hatchability_pct) if batch.expected_hatchability_pct is not None else None,
    )
    batch.last_saved_by = current_user.full_name
    batch.last_saved_at = datetime.utcnow()

    db.commit()

    return build_setter_response(db, batch)


def get_setter_batch(
    db: Session,
    current_user: models.AppUser,
    batch_id: int,
) -> models.HatcherySetterBatch:
    batch = (
        db.query(models.HatcherySetterBatch)
        .options(
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcherySetterBatch.id == batch_id)
        .first()
    )

    if batch is None:
        raise HTTPException(status_code=404, detail="Setter batch not found")

    receipt = batch.egg_receipt
    flock = receipt.breeder_production_flock if receipt else None

    if flock is None:
        raise HTTPException(
            status_code=409,
            detail="Setter batch is not linked to a valid Breeder Production flock",
        )

    if (
        not current_user.is_global_admin
        and batch.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    if not user_has_farm_access(db, current_user, flock.farm_id):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this Breeder Production farm",
        )

    return batch


def week_ending_sunday(value: date) -> date:
    return value + timedelta(days=(6 - value.weekday()) % 7)


def broiler_demand_for_week(
    db: Session,
    company_id: int,
    week_ending: date,
) -> int:
    week_start = week_ending - timedelta(days=6)

    rows = (
        db.query(models.BroilerPlacementPlan)
        .filter(
            models.BroilerPlacementPlan.company_id == company_id,
            models.BroilerPlacementPlan.placement_date >= week_start,
            models.BroilerPlacementPlan.placement_date <= week_ending,
        )
        .all()
    )

    total = 0

    for row in rows:
        planned = int(row.planned_birds or 0)
        allowance = float(row.chick_allowance_pct or 0)
        total += round(planned * (1 + allowance / 100))

    return total


def build_hatch_result_response(
    row: models.HatcheryHatchResult,
) -> HatcheryHatchResultOut:
    batch = row.setter_batch
    receipt = batch.egg_receipt if batch else None
    flock = receipt.breeder_production_flock if receipt else None

    eggs_set = int(batch.eggs_set or 0) if batch else 0
    expected_chicks = int(batch.expected_chicks or 0) if batch else 0

    clear_eggs = int(row.clear_eggs or 0)
    dead_in_shell = int(row.dead_in_shell or 0)
    cull_chicks = int(row.cull_chicks or 0)
    saleable_chicks = int(row.saleable_chicks or 0)

    fertile_eggs = max(0, eggs_set - clear_eggs)

    fertility_pct = (
        round((fertile_eggs / eggs_set) * 100, 3)
        if eggs_set > 0
        else None
    )

    actual_hatch_pct = (
        round((saleable_chicks / eggs_set) * 100, 3)
        if eggs_set > 0
        else None
    )

    hatch_of_fertile_pct = (
        round((saleable_chicks / fertile_eggs) * 100, 3)
        if fertile_eggs > 0
        else None
    )

    cull_pct = (
        round((cull_chicks / (saleable_chicks + cull_chicks)) * 100, 3)
        if saleable_chicks + cull_chicks > 0
        else None
    )

    unexplained = eggs_set - (
        clear_eggs + dead_in_shell + cull_chicks + saleable_chicks
    )

    chick_variance = saleable_chicks - expected_chicks

    expected_hatchability = (
        float(batch.expected_hatchability_pct)
        if batch and batch.expected_hatchability_pct is not None
        else None
    )

    if unexplained != 0:
        status_value = "Reconcile"
    elif expected_chicks > 0 and chick_variance <= -max(
        500,
        round(expected_chicks * 0.03),
    ):
        status_value = "Short Supply"
    elif (
        expected_hatchability is not None
        and hatch_of_fertile_pct is not None
        and hatch_of_fertile_pct < expected_hatchability - 2
    ):
        status_value = "Hatch Review"
    elif cull_pct is not None and cull_pct > 2:
        status_value = "Quality Review"
    else:
        status_value = "On Track"

    return HatcheryHatchResultOut(
        id=row.id,
        company_id=row.company_id,
        setter_batch_id=row.setter_batch_id,
        egg_receipt_id=batch.egg_receipt_id if batch else 0,
        breeder_production_flock_id=(
            receipt.breeder_production_flock_id if receipt else 0
        ),
        set_date=batch.set_date if batch else row.hatch_date,
        hatch_date=row.hatch_date,
        setter_name=batch.setter_name if batch else "",
        breeder_flock_code=flock.flock_code if flock else "",
        breeder_farm_name=(
            flock.farm.farm_name if flock and flock.farm else ""
        ),
        breeder_shed_name=(
            flock.shed.shed_name if flock and flock.shed else ""
        ),
        eggs_set=eggs_set,
        expected_chicks=expected_chicks,
        expected_fertility_pct=(
            float(batch.expected_fertility_pct)
            if batch and batch.expected_fertility_pct is not None
            else None
        ),
        expected_hatchability_pct=expected_hatchability,
        clear_eggs=clear_eggs,
        dead_in_shell=dead_in_shell,
        cull_chicks=cull_chicks,
        saleable_chicks=saleable_chicks,
        fertile_eggs=fertile_eggs,
        fertility_pct=fertility_pct,
        actual_hatch_pct=actual_hatch_pct,
        hatch_of_fertile_pct=hatch_of_fertile_pct,
        chick_variance=chick_variance,
        cull_pct=cull_pct,
        unexplained_egg_balance=unexplained,
        status=status_value,
        notes=row.notes,
        last_saved_by=row.last_saved_by,
        last_saved_at=row.last_saved_at,
    )


def get_hatch_result(
    db: Session,
    current_user: models.AppUser,
    result_id: int,
) -> models.HatcheryHatchResult:
    row = (
        db.query(models.HatcheryHatchResult)
        .options(
            joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcheryHatchResult.id == result_id)
        .first()
    )

    if row is None:
        raise HTTPException(status_code=404, detail="Hatch result not found")

    get_setter_batch(db, current_user, row.setter_batch_id)

    return row


@router.get(
    "/hatch-results",
    response_model=list[HatcheryHatchResultOut],
)
def list_hatch_results(
    company_id: Optional[int] = Query(default=None),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(current_user, company_id)

    rows = (
        db.query(models.HatcheryHatchResult)
        .options(
            joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcheryHatchResult.company_id == resolved_company_id)
        .order_by(
            models.HatcheryHatchResult.hatch_date.desc(),
            models.HatcheryHatchResult.id.desc(),
        )
        .all()
    )

    return [build_hatch_result_response(row) for row in rows]


@router.post(
    "/hatch-results",
    response_model=HatcheryHatchResultOut,
)
def create_hatch_result(
    payload: HatcheryHatchResultCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch = get_setter_batch(db, current_user, payload.setter_batch_id)
    resolved_company_id = resolve_company_id(current_user, payload.company_id)

    if batch.company_id != resolved_company_id:
        raise HTTPException(
            status_code=400,
            detail="The selected company does not match the Setter batch",
        )

    existing = (
        db.query(models.HatcheryHatchResult)
        .filter(models.HatcheryHatchResult.setter_batch_id == batch.id)
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="A Hatch Result already exists for this Setter batch",
        )

    values = {
        "Clear eggs": payload.clear_eggs,
        "Dead in shell": payload.dead_in_shell,
        "Cull chicks": payload.cull_chicks,
        "Saleable chicks": payload.saleable_chicks,
    }

    for label, value in values.items():
        if value < 0:
            raise HTTPException(
                status_code=400,
                detail=f"{label} cannot be negative",
            )

    if sum(values.values()) != int(batch.eggs_set or 0):
        raise HTTPException(
            status_code=400,
            detail=(
                "Clear eggs + dead in shell + cull chicks + saleable chicks "
                f"must equal Eggs Set ({int(batch.eggs_set or 0):,})."
            ),
        )

    row = models.HatcheryHatchResult(
        company_id=batch.company_id,
        setter_batch_id=batch.id,
        hatch_date=payload.hatch_date or batch.hatch_date,
        clear_eggs=payload.clear_eggs,
        dead_in_shell=payload.dead_in_shell,
        cull_chicks=payload.cull_chicks,
        saleable_chicks=payload.saleable_chicks,
        status="On Track",
        notes=(payload.notes.strip() if payload.notes else ""),
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    db.add(row)
    batch.status = "Hatched"
    batch.last_saved_by = current_user.full_name
    batch.last_saved_at = datetime.utcnow()
    db.commit()
    db.refresh(row)

    return build_hatch_result_response(
        get_hatch_result(db, current_user, row.id)
    )


@router.patch(
    "/hatch-results/{result_id}",
    response_model=HatcheryHatchResultOut,
)
def update_hatch_result(
    result_id: int,
    payload: HatcheryHatchResultPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = get_hatch_result(db, current_user, result_id)
    batch = row.setter_batch
    data = payload.model_dump(exclude_unset=True)

    for field in (
        "clear_eggs",
        "dead_in_shell",
        "cull_chicks",
        "saleable_chicks",
    ):
        if field in data and data[field] is not None and data[field] < 0:
            raise HTTPException(
                status_code=400,
                detail=f"{field.replace('_', ' ').title()} cannot be negative",
            )

    if "notes" in data:
        data["notes"] = data["notes"].strip() if data["notes"] else ""

    for field, value in data.items():
        setattr(row, field, value)

    total = (
        int(row.clear_eggs or 0)
        + int(row.dead_in_shell or 0)
        + int(row.cull_chicks or 0)
        + int(row.saleable_chicks or 0)
    )

    if total != int(batch.eggs_set or 0):
        raise HTTPException(
            status_code=400,
            detail=(
                "Clear eggs + dead in shell + cull chicks + saleable chicks "
                f"must equal Eggs Set ({int(batch.eggs_set or 0):,})."
            ),
        )

    row.last_saved_by = current_user.full_name
    row.last_saved_at = datetime.utcnow()
    db.commit()

    return build_hatch_result_response(
        get_hatch_result(db, current_user, row.id)
    )


def build_chick_availability_response(
    db: Session,
    row: models.HatcheryChickAvailability,
) -> HatcheryChickAvailabilityOut:
    hatch = row.hatch_result
    batch = hatch.setter_batch if hatch else None
    receipt = batch.egg_receipt if batch else None
    flock = receipt.breeder_production_flock if receipt else None

    saleable = int(hatch.saleable_chicks or 0) if hatch else 0
    held = int(row.held_chicks or 0)
    rejected = int(row.rejected_chicks or 0)
    adjustment = int(row.manual_adjustment or 0)

    available = max(0, saleable - held - rejected + adjustment)

    week_ending = week_ending_sunday(hatch.hatch_date)
    demand = broiler_demand_for_week(db, row.company_id, week_ending)
    balance = available - demand

    expected_hatchability = (
        float(batch.expected_hatchability_pct)
        if batch and batch.expected_hatchability_pct is not None
        else None
    )

    actual_hatch_pct = (
        round((saleable / int(batch.eggs_set or 0)) * 100, 3)
        if batch and int(batch.eggs_set or 0) > 0
        else None
    )

    status_value = (
        "Shortfall"
        if balance < 0
        else "Tight"
        if demand > 0 and balance <= max(1000, round(demand * 0.03))
        else "Covered"
    )

    return HatcheryChickAvailabilityOut(
        id=row.id,
        company_id=row.company_id,
        hatch_result_id=row.hatch_result_id,
        setter_batch_id=batch.id if batch else 0,
        hatch_date=hatch.hatch_date,
        week_ending=week_ending,
        setter_name=batch.setter_name if batch else "",
        breeder_flock_code=flock.flock_code if flock else "",
        breeder_farm_name=(
            flock.farm.farm_name if flock and flock.farm else ""
        ),
        breeder_shed_name=(
            flock.shed.shed_name if flock and flock.shed else ""
        ),
        eggs_set=int(batch.eggs_set or 0) if batch else 0,
        expected_chicks=int(batch.expected_chicks or 0) if batch else 0,
        actual_saleable_chicks=saleable,
        held_chicks=held,
        rejected_chicks=rejected,
        manual_adjustment=adjustment,
        available_chicks=available,
        broiler_demand=demand,
        balance_to_demand=balance,
        actual_hatch_pct=actual_hatch_pct,
        expected_hatchability_pct=expected_hatchability,
        status=status_value,
        notes=row.notes,
        last_saved_by=row.last_saved_by,
        last_saved_at=row.last_saved_at,
    )


@router.get(
    "/chick-availability",
    response_model=list[HatcheryChickAvailabilityOut],
)
def list_chick_availability(
    company_id: Optional[int] = Query(default=None),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(current_user, company_id)

    rows = (
        db.query(models.HatcheryChickAvailability)
        .options(
            joinedload(models.HatcheryChickAvailability.hatch_result)
            .joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcheryChickAvailability.hatch_result)
            .joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcheryChickAvailability.company_id == resolved_company_id)
        .order_by(models.HatcheryChickAvailability.id.desc())
        .all()
    )

    return [build_chick_availability_response(db, row) for row in rows]


@router.post(
    "/chick-availability",
    response_model=HatcheryChickAvailabilityOut,
)
def create_chick_availability(
    payload: HatcheryChickAvailabilityCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    hatch = get_hatch_result(db, current_user, payload.hatch_result_id)
    resolved_company_id = resolve_company_id(current_user, payload.company_id)

    if hatch.company_id != resolved_company_id:
        raise HTTPException(
            status_code=400,
            detail="The selected company does not match the Hatch Result",
        )

    existing = (
        db.query(models.HatcheryChickAvailability)
        .filter(models.HatcheryChickAvailability.hatch_result_id == hatch.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Chick Availability already exists for this Hatch Result",
        )

    held = int(payload.held_chicks or 0)
    rejected = int(payload.rejected_chicks or 0)
    adjustment = int(payload.manual_adjustment or 0)

    if held < 0 or rejected < 0:
        raise HTTPException(
            status_code=400,
            detail="Held and rejected chicks cannot be negative",
        )

    if held + rejected > int(hatch.saleable_chicks or 0) + max(0, adjustment):
        raise HTTPException(
            status_code=400,
            detail="Held and rejected chicks cannot exceed available saleable chick output",
        )

    row = models.HatcheryChickAvailability(
        company_id=hatch.company_id,
        hatch_result_id=hatch.id,
        held_chicks=held,
        rejected_chicks=rejected,
        manual_adjustment=adjustment,
        status="Available",
        notes=(payload.notes.strip() if payload.notes else ""),
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return build_chick_availability_response(db, row)


@router.patch(
    "/chick-availability/{availability_id}",
    response_model=HatcheryChickAvailabilityOut,
)
def update_chick_availability(
    availability_id: int,
    payload: HatcheryChickAvailabilityPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(models.HatcheryChickAvailability)
        .options(
            joinedload(models.HatcheryChickAvailability.hatch_result)
            .joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.farm),
            joinedload(models.HatcheryChickAvailability.hatch_result)
            .joinedload(models.HatcheryHatchResult.setter_batch)
            .joinedload(models.HatcherySetterBatch.egg_receipt)
            .joinedload(models.HatcheryEggReceipt.breeder_production_flock)
            .joinedload(models.BreederProductionFlock.shed),
        )
        .filter(models.HatcheryChickAvailability.id == availability_id)
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Chick Availability record not found",
        )

    get_hatch_result(db, current_user, row.hatch_result_id)
    data = payload.model_dump(exclude_unset=True)

    for field in ("held_chicks", "rejected_chicks"):
        if field in data and data[field] is not None and data[field] < 0:
            raise HTTPException(
                status_code=400,
                detail=f"{field.replace('_', ' ').title()} cannot be negative",
            )

    if "notes" in data:
        data["notes"] = data["notes"].strip() if data["notes"] else ""

    for field, value in data.items():
        setattr(row, field, value)

    hatch = row.hatch_result

    if (
        int(row.held_chicks or 0) + int(row.rejected_chicks or 0)
        > int(hatch.saleable_chicks or 0)
        + max(0, int(row.manual_adjustment or 0))
    ):
        raise HTTPException(
            status_code=400,
            detail="Held and rejected chicks cannot exceed available saleable chick output",
        )

    row.last_saved_by = current_user.full_name
    row.last_saved_at = datetime.utcnow()
    db.commit()

    return build_chick_availability_response(db, row)
