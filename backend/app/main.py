import os
from datetime import date, datetime
from io import BytesIO
from fastapi import Body, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from openpyxl import load_workbook
from app.routers import broiler_processing
from app.routers import app_notes
from app.routers import broiler_supply
from app.routers import access
from app.routers import auth
from app.routers import standards
from app.routers.standards import PerformanceStandard
from app.routers.auth import get_current_user
from app import models

from .db import Base, engine, SessionLocal, get_db
from .models import (
    Company,
    BroilerFarm,
    BroilerShed,
    BroilerPlacementPlan,
    BroilerDailyPerformance,
    LayerRearingFlock,
)
from .schemas import (
    BroilerDemandPlanCreate,
    BroilerDemandPlanOut,
    BroilerDemandPlanPatch,
    BroilerFarmCreate,
    BroilerFarmPatch,
    BroilerFarmOut,
    BroilerShedCreate,
    BroilerShedPatch,
    BroilerShedOut,
    BroilerDailyPerformanceCreate,
    BroilerDailyPerformancePatch,
    BroilerDailyPerformanceOut,
    LayerRearingFlockCreate,
    LayerRearingFlockPatch,
    LayerRearingFlockOut,
)
from .calculations import build_plan_response
from .seed import seed_demo_data

app = FastAPI(title="OviCore Broiler Module API", version="0.1.0")
app.include_router(broiler_processing.router)
app.include_router(app_notes.router)
app.include_router(broiler_supply.router)
app.include_router(access.router)
app.include_router(auth.router)
app.include_router(standards.router)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

env_origins = os.getenv("CORS_ORIGINS")
if env_origins:
    origins.extend([origin.strip() for origin in env_origins.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def resolve_company_id(
    current_user: models.AppUser,
    requested_company_id: int | None = None,
) -> int:
    """
    Normal company users are always restricted to their own company.

    Global Admin may optionally supply a company ID when managing
    another company.
    """

    if current_user.is_global_admin:
        if requested_company_id is None:
            raise HTTPException(
                status_code=400,
                detail="company_id is required for Global Admin access",
            )

        return requested_company_id

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not assigned to a company",
        )

    return current_user.company_id


def require_farm_access(
    db: Session,
    current_user: models.AppUser,
    farm_id: int,
) -> BroilerFarm:
    farm = (
        db.query(BroilerFarm)
        .filter(BroilerFarm.id == farm_id)
        .first()
    )

    if not farm:
        raise HTTPException(
            status_code=404,
            detail="Broiler farm not found",
        )

    if current_user.is_global_admin:
        return farm

    if farm.company_id != current_user.company_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    if current_user.is_company_admin:
        return farm

    access = (
        db.query(models.UserFarmAccess)
        .filter(
            models.UserFarmAccess.user_id == current_user.id,
            models.UserFarmAccess.farm_id == farm_id,
        )
        .first()
    )

    if not access:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this farm",
        )

    return farm

def build_daily_performance_response(
    entry: BroilerDailyPerformance,
    cumulative_mortality_birds: int | None = None,
):
    plan = entry.placement_plan
    farm = plan.farm if plan else None
    shed = plan.shed if plan else None

    opening_birds = entry.opening_birds or 0
    mortality_birds = entry.mortality_birds or 0
    cull_birds = entry.cull_birds or 0
    closing_birds = entry.closing_birds or 0
    feed_kg = float(entry.feed_kg) if entry.feed_kg is not None else 0

    daily_mortality_pct = None
    if opening_birds > 0:
        daily_mortality_pct = (mortality_birds / opening_birds) * 100

    cumulative_mortality_pct = None
    if opening_birds > 0 and cumulative_mortality_birds is not None:
        cumulative_mortality_pct = (cumulative_mortality_birds / opening_birds) * 100

    feed_per_bird_g = None
    if closing_birds > 0 and feed_kg > 0:
        feed_per_bird_g = (feed_kg * 1000) / closing_birds

    return BroilerDailyPerformanceOut(
        id=entry.id,
        company_id=entry.company_id,
        placement_plan_id=entry.placement_plan_id,

        farm_name=farm.farm_name if farm else None,
        shed_name=shed.shed_name if shed else None,
        cycle_code=plan.cycle_code if plan else None,

        entry_date=entry.entry_date,
        age_days=entry.age_days,

        opening_birds=entry.opening_birds,

        mortality_front=entry.mortality_front or 0,
        mortality_middle=entry.mortality_middle or 0,
        mortality_back=entry.mortality_back or 0,
        mortality_other=entry.mortality_other or 0,
        mortality_birds=entry.mortality_birds or 0,

        cull_legs=entry.cull_legs or 0,
        cull_runts=entry.cull_runts or 0,
        cull_beak=entry.cull_beak or 0,
        cull_other=entry.cull_other or 0,
        cull_birds=entry.cull_birds or 0,

        closing_birds=entry.closing_birds,

        feed_kg=float(entry.feed_kg) if entry.feed_kg is not None else None,
        water_litres=float(entry.water_litres) if entry.water_litres is not None else None,
        avg_weight_kg=float(entry.avg_weight_kg) if entry.avg_weight_kg is not None else None,
        body_weight_kg=float(entry.avg_weight_kg) if entry.avg_weight_kg is not None else None,

        daily_mortality_pct=daily_mortality_pct,
        cumulative_mortality_birds=cumulative_mortality_birds,
        cumulative_mortality_pct=cumulative_mortality_pct,
        feed_per_bird_g=feed_per_bird_g,

        notes=entry.notes,
        last_saved_by=entry.last_saved_by,
        last_saved_at=entry.last_saved_at,
    )

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

    should_seed_demo_data = (
        os.getenv("SEED_DEMO_DATA", "false").strip().lower()
        in {"1", "true", "yes", "on"}
    )

    if should_seed_demo_data:
        db = SessionLocal()

        try:
            seed_demo_data(db)
        finally:
            db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "module": "broilers"}

@app.get(
    "/api/broilers/demand-plans",
    response_model=list[BroilerDemandPlanOut],
)
def list_demand_plans(
    company_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(BroilerPlacementPlan)
        .options(
            joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerPlacementPlan.company_id
            == resolved_company_id
        )
    )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            BroilerPlacementPlan.farm_id.in_(
                permitted_farm_ids
            )
        )

    plans = (
        query
        .order_by(
            BroilerPlacementPlan.placement_date.asc(),
            BroilerPlacementPlan.id.asc(),
        )
        .all()
    )

    return [
        build_plan_response(plan)
        for plan in plans
    ]


@app.patch(
    "/api/broilers/demand-plans/{plan_id}",
    response_model=BroilerDemandPlanOut,
)
def update_demand_plan(
    plan_id: int,
    payload: dict = Body(...),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(BroilerPlacementPlan)
        .options(
            joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerPlacementPlan.id == plan_id
        )
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Broiler demand plan not found",
        )

    require_farm_access(
        db,
        current_user,
        plan.farm_id,
    )

    if (
        not current_user.is_global_admin
        and plan.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    # Validate the standard demand-plan fields while retaining farm_id and
    # shed_id, which older BroilerDemandPlanPatch schemas may ignore.
    validated_payload = BroilerDemandPlanPatch.model_validate(payload)
    data = validated_payload.model_dump(exclude_unset=True)

    requested_farm_id = payload.get("farm_id", plan.farm_id)
    requested_shed_id = payload.get("shed_id", plan.shed_id)

    try:
        requested_farm_id = int(requested_farm_id)
        requested_shed_id = int(requested_shed_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="farm_id and shed_id must be valid integers",
        )

    target_farm = require_farm_access(
        db,
        current_user,
        requested_farm_id,
    )

    target_shed = (
        db.query(BroilerShed)
        .filter(
            BroilerShed.id == requested_shed_id,
            BroilerShed.active == True,
        )
        .first()
    )

    if not target_shed:
        raise HTTPException(
            status_code=404,
            detail="Broiler shed not found or inactive",
        )

    if (
        target_shed.farm_id != target_farm.id
        or target_shed.company_id != target_farm.company_id
        or target_farm.company_id != plan.company_id
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected shed does not belong to the selected farm "
                "and company."
            ),
        )

    plan.farm_id = target_farm.id
    plan.shed_id = target_shed.id

    for field, value in data.items():
        if field not in {"farm_id", "shed_id", "company_id"}:
            setattr(plan, field, value)

    plan.last_saved_by = current_user.full_name
    plan.last_saved_at = datetime.utcnow()

    db.commit()
    db.refresh(plan)

    return build_plan_response(plan)


@app.post(
    "/api/broilers/demand-plans",
    response_model=BroilerDemandPlanOut,
)
def create_demand_plan(
    payload: BroilerDemandPlanCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    farm = require_farm_access(
        db,
        current_user,
        payload.farm_id,
    )

    shed = (
        db.query(BroilerShed)
        .filter(
            BroilerShed.id == payload.shed_id
        )
        .first()
    )

    if not shed:
        raise HTTPException(
            status_code=404,
            detail="Broiler shed not found",
        )

    if (
        shed.farm_id != farm.id
        or shed.company_id != farm.company_id
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected shed does not belong "
                "to the selected farm."
            ),
        )

    plan = BroilerPlacementPlan(
        company_id=farm.company_id,
        farm_id=farm.id,
        shed_id=shed.id,
        cycle_code=payload.cycle_code,
        placement_date=payload.placement_date,
        planned_birds=payload.planned_birds,
        target_density_kg_m2=(
            payload.target_density_kg_m2
        ),
        target_lw_kg=payload.target_lw_kg,
        growout_days=payload.growout_days,
        chick_allowance_pct=(
            payload.chick_allowance_pct
        ),
        notes=payload.notes,
        status=payload.status,
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    plan = (
        db.query(BroilerPlacementPlan)
        .options(
            joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerPlacementPlan.id == plan.id,
            BroilerPlacementPlan.company_id
            == farm.company_id,
        )
        .first()
    )

    return build_plan_response(plan)


@app.delete("/api/broilers/demand-plans/{plan_id}")
def delete_demand_plan(
    plan_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    plan = (
        db.query(BroilerPlacementPlan)
        .filter(
            BroilerPlacementPlan.id == plan_id
        )
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Broiler demand plan not found",
        )

    require_farm_access(
        db,
        current_user,
        plan.farm_id,
    )

    linked_entries = (
        db.query(BroilerDailyPerformance)
        .filter(
            BroilerDailyPerformance.company_id
            == plan.company_id,
            BroilerDailyPerformance.placement_plan_id
            == plan.id,
        )
        .count()
    )

    if linked_entries > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete this plan because it has "
                "daily performance records."
            ),
        )

    db.delete(plan)
    db.commit()

    return {
        "deleted": True,
        "id": plan_id,
    }


@app.post(
    "/api/broilers/demand-plans/new-row",
    response_model=BroilerDemandPlanOut,
)
def create_broiler_demand_plan_new_row(
    company_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(BroilerShed)
        .join(
            BroilerFarm,
            BroilerFarm.id == BroilerShed.farm_id,
        )
        .filter(
            BroilerShed.active == True,
            BroilerShed.company_id
            == resolved_company_id,
            BroilerFarm.company_id
            == resolved_company_id,
        )
    )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            BroilerShed.farm_id.in_(
                permitted_farm_ids
            )
        )

    shed = (
        query
        .order_by(BroilerShed.id.asc())
        .first()
    )

    if not shed:
        raise HTTPException(
            status_code=400,
            detail=(
                "No active broiler sheds are available "
                "for this user and company."
            ),
        )

    farm = require_farm_access(
        db,
        current_user,
        shed.farm_id,
    )

    existing_count = (
        db.query(BroilerPlacementPlan)
        .filter(
            BroilerPlacementPlan.company_id
            == resolved_company_id
        )
        .count()
    )

    next_number = existing_count + 1

    plan = BroilerPlacementPlan(
        company_id=resolved_company_id,
        farm_id=farm.id,
        shed_id=shed.id,
        cycle_code=f"BR-NEW-{next_number:03d}",
        placement_date=None,
        planned_birds=None,
        target_density_kg_m2=(
            shed.default_density_kg_m2
        ),
        target_lw_kg=shed.default_target_lw_kg,
        growout_days=shed.default_growout_days,
        chick_allowance_pct=1.5,
        notes="",
        status="Draft",
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    plan = (
        db.query(BroilerPlacementPlan)
        .options(
            joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerPlacementPlan.id == plan.id,
            BroilerPlacementPlan.company_id
            == resolved_company_id,
        )
        .first()
    )

    return build_plan_response(plan)

@app.get(
    "/api/broilers/farms",
    response_model=list[BroilerFarmOut],
)
def list_broiler_farms(
    company_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(BroilerFarm)
        .filter(
            BroilerFarm.company_id == resolved_company_id
        )
    )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            BroilerFarm.id.in_(permitted_farm_ids)
        )

    return (
        query
        .order_by(BroilerFarm.farm_name.asc())
        .all()
    )


@app.post(
    "/api/broilers/farms",
    response_model=BroilerFarmOut,
)
def create_broiler_farm(
    payload: BroilerFarmCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    resolved_company_id = resolve_company_id(
        current_user,
        payload.company_id,
    )

    if not current_user.is_global_admin:
        resolved_company_id = current_user.company_id

    company = (
        db.query(Company)
        .filter(
            Company.id == resolved_company_id,
            Company.active == True,
        )
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found or inactive",
        )

    existing = (
        db.query(BroilerFarm)
        .filter(
            BroilerFarm.company_id
            == resolved_company_id,
            BroilerFarm.farm_name
            == payload.farm_name.strip(),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "A farm with this name already exists "
                "for the company."
            ),
        )

    farm = BroilerFarm(
        company_id=resolved_company_id,
        farm_name=payload.farm_name.strip(),
        farm_code=(
            payload.farm_code.strip()
            if payload.farm_code
            else None
        ),
        active=payload.active,
    )

    db.add(farm)
    db.commit()
    db.refresh(farm)

    return farm


@app.patch(
    "/api/broilers/farms/{farm_id}",
    response_model=BroilerFarmOut,
)
def update_broiler_farm(
    farm_id: int,
    payload: BroilerFarmPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    farm = require_farm_access(
        db,
        current_user,
        farm_id,
    )

    data = payload.model_dump(exclude_unset=True)

    if "farm_name" in data and data["farm_name"]:
        farm_name = data["farm_name"].strip()

        duplicate = (
            db.query(BroilerFarm)
            .filter(
                BroilerFarm.company_id
                == farm.company_id,
                BroilerFarm.farm_name
                == farm_name,
                BroilerFarm.id != farm.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Another farm with this name already "
                    "exists for the company."
                ),
            )

        data["farm_name"] = farm_name

    if "farm_code" in data and data["farm_code"]:
        data["farm_code"] = data["farm_code"].strip()

    for field, value in data.items():
        setattr(farm, field, value)

    db.commit()
    db.refresh(farm)

    return farm


@app.delete("/api/broilers/farms/{farm_id}")
def delete_broiler_farm(
    farm_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=403,
            detail="Global Admin access required",
        )

    farm = require_farm_access(
        db,
        current_user,
        farm_id,
    )

    linked_sheds = (
        db.query(BroilerShed)
        .filter(
            BroilerShed.farm_id == farm.id,
            BroilerShed.company_id == farm.company_id,
        )
        .count()
    )

    if linked_sheds > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete farm because it has linked "
                "sheds. Set the farm inactive instead."
            ),
        )

    db.delete(farm)
    db.commit()

    return {
        "deleted": True,
        "id": farm_id,
    }

@app.get(
    "/api/broilers/sheds",
    response_model=list[BroilerShedOut],
)
def list_broiler_sheds(
    company_id: int | None = None,
    farm_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(
            BroilerShed,
            BroilerFarm.farm_name,
        )
        .join(
            BroilerFarm,
            BroilerFarm.id == BroilerShed.farm_id,
        )
        .filter(
            BroilerShed.company_id
            == resolved_company_id,
            BroilerFarm.company_id
            == resolved_company_id,
        )
    )

    if farm_id is not None:
        require_farm_access(
            db,
            current_user,
            farm_id,
        )

        query = query.filter(
            BroilerShed.farm_id == farm_id
        )

    elif not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            BroilerShed.farm_id.in_(permitted_farm_ids)
        )

    sheds = (
        query
        .order_by(
            BroilerFarm.farm_name.asc(),
            BroilerShed.shed_name.asc(),
        )
        .all()
    )

    return [
        BroilerShedOut(
            id=shed.id,
            company_id=shed.company_id,
            farm_id=shed.farm_id,
            farm_name=farm_name,
            shed_name=shed.shed_name,
            shed_code=shed.shed_code,
            floor_area_m2=float(shed.floor_area_m2),
            default_density_kg_m2=float(
                shed.default_density_kg_m2
            ),
            default_target_lw_kg=float(
                shed.default_target_lw_kg
            ),
            default_growout_days=shed.default_growout_days,
            active=shed.active,
        )
        for shed, farm_name in sheds
    ]


@app.post(
    "/api/broilers/sheds",
    response_model=BroilerShedOut,
)
def create_broiler_shed(
    payload: BroilerShedCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    farm = require_farm_access(
        db,
        current_user,
        payload.farm_id,
    )

    if (
        current_user.is_global_admin
        and payload.company_id != farm.company_id
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected company does not match "
                "the farm company."
            ),
        )

    existing = (
        db.query(BroilerShed)
        .filter(
            BroilerShed.company_id == farm.company_id,
            BroilerShed.farm_id == farm.id,
            BroilerShed.shed_name
            == payload.shed_name.strip(),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "A shed with this name already exists "
                "on the selected farm."
            ),
        )

    shed = BroilerShed(
        company_id=farm.company_id,
        farm_id=farm.id,
        shed_name=payload.shed_name.strip(),
        shed_code=(
            payload.shed_code.strip()
            if payload.shed_code
            else None
        ),
        floor_area_m2=payload.floor_area_m2,
        default_density_kg_m2=(
            payload.default_density_kg_m2
        ),
        default_target_lw_kg=(
            payload.default_target_lw_kg
        ),
        default_growout_days=(
            payload.default_growout_days
        ),
        active=payload.active,
    )

    db.add(shed)
    db.commit()
    db.refresh(shed)

    return BroilerShedOut(
        id=shed.id,
        company_id=shed.company_id,
        farm_id=shed.farm_id,
        farm_name=farm.farm_name,
        shed_name=shed.shed_name,
        shed_code=shed.shed_code,
        floor_area_m2=float(shed.floor_area_m2),
        default_density_kg_m2=float(
            shed.default_density_kg_m2
        ),
        default_target_lw_kg=float(
            shed.default_target_lw_kg
        ),
        default_growout_days=shed.default_growout_days,
        active=shed.active,
    )


@app.patch(
    "/api/broilers/sheds/{shed_id}",
    response_model=BroilerShedOut,
)
def update_broiler_shed(
    shed_id: int,
    payload: BroilerShedPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    shed = (
        db.query(BroilerShed)
        .filter(BroilerShed.id == shed_id)
        .first()
    )

    if not shed:
        raise HTTPException(
            status_code=404,
            detail="Broiler shed not found",
        )

    require_farm_access(
        db,
        current_user,
        shed.farm_id,
    )

    data = payload.model_dump(exclude_unset=True)

    if "farm_id" in data:
        target_farm = require_farm_access(
            db,
            current_user,
            data["farm_id"],
        )

        if target_farm.company_id != shed.company_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A shed cannot be moved to a farm "
                    "belonging to another company."
                ),
            )

    target_farm_id = data.get(
        "farm_id",
        shed.farm_id,
    )

    if "shed_name" in data and data["shed_name"]:
        shed_name = data["shed_name"].strip()

        duplicate = (
            db.query(BroilerShed)
            .filter(
                BroilerShed.company_id
                == shed.company_id,
                BroilerShed.farm_id
                == target_farm_id,
                BroilerShed.shed_name
                == shed_name,
                BroilerShed.id != shed.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Another shed with this name already "
                    "exists on the selected farm."
                ),
            )

        data["shed_name"] = shed_name

    if "shed_code" in data and data["shed_code"]:
        data["shed_code"] = data["shed_code"].strip()

    for field, value in data.items():
        setattr(shed, field, value)

    db.commit()
    db.refresh(shed)

    farm = require_farm_access(
        db,
        current_user,
        shed.farm_id,
    )

    return BroilerShedOut(
        id=shed.id,
        company_id=shed.company_id,
        farm_id=shed.farm_id,
        farm_name=farm.farm_name,
        shed_name=shed.shed_name,
        shed_code=shed.shed_code,
        floor_area_m2=float(shed.floor_area_m2),
        default_density_kg_m2=float(
            shed.default_density_kg_m2
        ),
        default_target_lw_kg=float(
            shed.default_target_lw_kg
        ),
        default_growout_days=shed.default_growout_days,
        active=shed.active,
    )


@app.delete("/api/broilers/sheds/{shed_id}")
def delete_broiler_shed(
    shed_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=403,
            detail="Global Admin access required",
        )

    shed = (
        db.query(BroilerShed)
        .filter(BroilerShed.id == shed_id)
        .first()
    )

    if not shed:
        raise HTTPException(
            status_code=404,
            detail="Broiler shed not found",
        )

    require_farm_access(
        db,
        current_user,
        shed.farm_id,
    )

    linked_plans = (
        db.query(BroilerPlacementPlan)
        .filter(
            BroilerPlacementPlan.shed_id == shed.id,
            BroilerPlacementPlan.company_id
            == shed.company_id,
        )
        .count()
    )

    if linked_plans > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot delete shed because it has linked "
                "placement plans. Set the shed inactive instead."
            ),
        )

    db.delete(shed)
    db.commit()

    return {
        "deleted": True,
        "id": shed_id,
    }

def recalculate_daily_performance_entry(entry: BroilerDailyPerformance):
    mortality_total = (
        int(entry.mortality_front or 0)
        + int(entry.mortality_middle or 0)
        + int(entry.mortality_back or 0)
        + int(entry.mortality_other or 0)
    )

    cull_total = (
        int(entry.cull_legs or 0)
        + int(entry.cull_runts or 0)
        + int(entry.cull_beak or 0)
        + int(entry.cull_other or 0)
    )

    entry.mortality_birds = mortality_total
    entry.cull_birds = cull_total

    if entry.opening_birds is not None:
        entry.closing_birds = (
            int(entry.opening_birds or 0)
            - mortality_total
            - cull_total
        )
    else:
        entry.closing_birds = None

    return entry
    
@app.get(
    "/api/broilers/performance",
    response_model=list[BroilerDailyPerformanceOut],
)
def list_broiler_performance(
    company_id: int | None = None,
    placement_plan_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(
                BroilerDailyPerformance.placement_plan
            ).joinedload(BroilerPlacementPlan.farm),
            joinedload(
                BroilerDailyPerformance.placement_plan
            ).joinedload(BroilerPlacementPlan.shed),
        )
        .join(
            BroilerPlacementPlan,
            BroilerPlacementPlan.id
            == BroilerDailyPerformance.placement_plan_id,
        )
        .filter(
            BroilerDailyPerformance.company_id
            == resolved_company_id,
            BroilerPlacementPlan.company_id
            == resolved_company_id,
        )
    )

    if placement_plan_id is not None:
        plan = (
            db.query(BroilerPlacementPlan)
            .filter(
                BroilerPlacementPlan.id
                == placement_plan_id,
                BroilerPlacementPlan.company_id
                == resolved_company_id,
            )
            .first()
        )

        if not plan:
            raise HTTPException(
                status_code=404,
                detail="Broiler placement plan not found",
            )

        require_farm_access(
            db,
            current_user,
            plan.farm_id,
        )

        query = query.filter(
            BroilerDailyPerformance.placement_plan_id
            == placement_plan_id
        )

    elif not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            BroilerPlacementPlan.farm_id.in_(
                permitted_farm_ids
            )
        )

    entries = (
        query
        .order_by(
            BroilerDailyPerformance.placement_plan_id.asc(),
            BroilerDailyPerformance.entry_date.asc(),
            BroilerDailyPerformance.id.asc(),
        )
        .all()
    )

    cumulative_by_plan: dict[int, int] = {}
    output = []

    for entry in entries:
        plan_id = entry.placement_plan_id

        cumulative_by_plan.setdefault(
            plan_id,
            0,
        )

        cumulative_by_plan[plan_id] += int(
            entry.mortality_birds or 0
        )

        output.append(
            build_daily_performance_response(
                entry,
                cumulative_mortality_birds=(
                    cumulative_by_plan[plan_id]
                ),
            )
        )

    return output


@app.post(
    "/api/broilers/performance",
    response_model=BroilerDailyPerformanceOut,
)
def create_broiler_performance(
    payload: BroilerDailyPerformanceCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(BroilerPlacementPlan)
        .options(
            joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerPlacementPlan.id
            == payload.placement_plan_id
        )
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Broiler placement plan not found",
        )

    require_farm_access(
        db,
        current_user,
        plan.farm_id,
    )

    if (
        not current_user.is_global_admin
        and plan.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    existing = (
        db.query(BroilerDailyPerformance)
        .filter(
            BroilerDailyPerformance.company_id
            == plan.company_id,
            BroilerDailyPerformance.placement_plan_id
            == plan.id,
            BroilerDailyPerformance.entry_date
            == payload.entry_date,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "A performance entry already exists "
                "for this cycle and date."
            ),
        )

    data = payload.model_dump()

    data["company_id"] = plan.company_id

    if "body_weight_kg" in data:
        data["avg_weight_kg"] = data.pop(
            "body_weight_kg"
        )

    entry = BroilerDailyPerformance(**data)

    recalculate_daily_performance_entry(entry)

    entry.last_saved_by = current_user.full_name
    entry.last_saved_at = datetime.utcnow()

    db.add(entry)
    db.commit()
    db.refresh(entry)

    entry = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(
                BroilerDailyPerformance.placement_plan
            ).joinedload(BroilerPlacementPlan.farm),
            joinedload(
                BroilerDailyPerformance.placement_plan
            ).joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerDailyPerformance.id == entry.id,
            BroilerDailyPerformance.company_id
            == plan.company_id,
        )
        .first()
    )

    return build_daily_performance_response(
        entry,
        cumulative_mortality_birds=(
            entry.mortality_birds or 0
        ),
    )


@app.patch(
    "/api/broilers/performance/{entry_id}",
    response_model=BroilerDailyPerformanceOut,
)
def update_broiler_performance(
    entry_id: int,
    payload: BroilerDailyPerformancePatch,
    expected_last_saved_at: str | None = Header(
        default=None,
        alias="X-OviCore-Expected-Last-Saved-At",
    ),
    mobile_sync: str | None = Header(
        default=None,
        alias="X-OviCore-Mobile-Sync",
    ),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(
                BroilerDailyPerformance.placement_plan
            ).joinedload(BroilerPlacementPlan.farm),
            joinedload(
                BroilerDailyPerformance.placement_plan
            ).joinedload(BroilerPlacementPlan.shed),
        )
        .filter(
            BroilerDailyPerformance.id == entry_id
        )
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Broiler performance entry not found",
        )

    plan = entry.placement_plan

    if not plan:
        raise HTTPException(
            status_code=400,
            detail="Performance entry has no valid placement plan",
        )

    require_farm_access(
        db,
        current_user,
        plan.farm_id,
    )

    if (
        not current_user.is_global_admin
        and entry.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    if expected_last_saved_at is not None:
        actual_last_saved_at = (
            entry.last_saved_at.isoformat()
            if entry.last_saved_at is not None
            else ""
        )

        expected_normalised = (
            expected_last_saved_at
            .strip()
            .replace("Z", "+00:00")
        )

        actual_normalised = (
            actual_last_saved_at
            .strip()
            .replace("Z", "+00:00")
        )

        try:
            expected_dt = datetime.fromisoformat(
                expected_normalised
            )
            actual_dt = datetime.fromisoformat(
                actual_normalised
            )
            same_version = (
                expected_dt.replace(tzinfo=None)
                == actual_dt.replace(tzinfo=None)
            )
        except ValueError:
            same_version = (
                expected_normalised
                == actual_normalised
            )

        if not same_version:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This performance entry changed in "
                    "OviCore after it was loaded on mobile. "
                    "Review the sync conflict before updating."
                ),
            )

    data = payload.model_dump(
        exclude_unset=True
    )

    if (
        mobile_sync is not None
        and mobile_sync.strip().lower()
        in {"1", "true", "yes", "on"}
    ):
        data = {
            field: value
            for field, value in data.items()
            if value is not None
        }

    if "body_weight_kg" in data:
        data["avg_weight_kg"] = data.pop(
            "body_weight_kg"
        )

    if (
        mobile_sync is not None
        and mobile_sync.strip().lower()
        in {"1", "true", "yes", "on"}
    ):
        protected_fields = []

        for field, incoming_value in data.items():
            if field in {
                "placement_plan_id",
                "entry_date",
                "age_days",
                "mortality_birds",
                "cull_birds",
                "closing_birds",
                "last_saved_by",
            }:
                continue

            existing_value = getattr(
                entry,
                field,
                None,
            )

            if (
                existing_value is None
                or incoming_value is None
            ):
                continue

            try:
                values_are_equal = (
                    float(existing_value)
                    == float(incoming_value)
                )
            except (TypeError, ValueError):
                values_are_equal = (
                    str(existing_value).strip()
                    == str(incoming_value).strip()
                )

            if not values_are_equal:
                protected_fields.append(field)

        if protected_fields:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Mobile sync cannot overwrite existing "
                    "OviCore values. Protected fields: "
                    + ", ".join(protected_fields)
                ),
            )

    if "entry_date" in data:
        duplicate = (
            db.query(BroilerDailyPerformance)
            .filter(
                BroilerDailyPerformance.company_id
                == entry.company_id,
                BroilerDailyPerformance.placement_plan_id
                == entry.placement_plan_id,
                BroilerDailyPerformance.entry_date
                == data["entry_date"],
                BroilerDailyPerformance.id != entry.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A performance entry already exists "
                    "for this cycle and date."
                ),
            )

    for field, value in data.items():
        setattr(entry, field, value)

    recalculate_daily_performance_entry(entry)

    entry.last_saved_by = current_user.full_name
    entry.last_saved_at = datetime.utcnow()

    db.commit()
    db.refresh(entry)

    cumulative_mortality = (
        db.query(BroilerDailyPerformance)
        .filter(
            BroilerDailyPerformance.company_id
            == entry.company_id,
            BroilerDailyPerformance.placement_plan_id
            == entry.placement_plan_id,
            BroilerDailyPerformance.entry_date
            <= entry.entry_date,
        )
        .with_entities(
            BroilerDailyPerformance.mortality_birds
        )
        .all()
    )

    cumulative_mortality_birds = sum(
        int(row[0] or 0)
        for row in cumulative_mortality
    )

    return build_daily_performance_response(
        entry,
        cumulative_mortality_birds=(
            cumulative_mortality_birds
        ),
    )


@app.delete("/api/broilers/performance/{entry_id}")
def delete_broiler_performance(
    entry_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(
                BroilerDailyPerformance.placement_plan
            )
        )
        .filter(
            BroilerDailyPerformance.id == entry_id
        )
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Broiler performance entry not found",
        )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    plan = entry.placement_plan

    if not plan:
        raise HTTPException(
            status_code=400,
            detail="Performance entry has no valid placement plan",
        )

    require_farm_access(
        db,
        current_user,
        plan.farm_id,
    )

    db.delete(entry)
    db.commit()

    return {
        "deleted": True,
        "id": entry_id,
    }


@app.post(
    "/api/broilers/performance/recalculate-cycle/{placement_plan_id}"
)
def recalculate_broiler_performance_cycle(
    placement_plan_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(BroilerPlacementPlan)
        .filter(
            BroilerPlacementPlan.id
            == placement_plan_id
        )
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Broiler placement plan not found",
        )

    require_farm_access(
        db,
        current_user,
        plan.farm_id,
    )

    entries = (
        db.query(BroilerDailyPerformance)
        .filter(
            BroilerDailyPerformance.company_id
            == plan.company_id,
            BroilerDailyPerformance.placement_plan_id
            == placement_plan_id,
        )
        .order_by(
            BroilerDailyPerformance.entry_date.asc(),
            BroilerDailyPerformance.age_days.asc(),
            BroilerDailyPerformance.id.asc(),
        )
        .all()
    )

    if not entries:
        raise HTTPException(
            status_code=404,
            detail=(
                "No performance entries found "
                "for this cycle."
            ),
        )

    previous_closing_birds = None

    for index, entry in enumerate(entries):
        if (
            index > 0
            and previous_closing_birds is not None
        ):
            entry.opening_birds = (
                previous_closing_birds
            )

        recalculate_daily_performance_entry(entry)

        previous_closing_birds = entry.closing_birds
        entry.last_saved_at = datetime.utcnow()
        entry.last_saved_by = current_user.full_name

    db.commit()

    return {
        "ok": True,
        "placement_plan_id": placement_plan_id,
        "rows_recalculated": len(entries),
    }


def _import_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _import_bool(value, default: bool = True) -> bool:
    if value is None or _import_text(value) == "":
        return default
    return _import_text(value).lower() in {
        "1", "true", "yes", "y", "on", "active"
    }


def _import_int(
    value,
    field_name: str,
    row_number: int,
    errors: list[str],
) -> int | None:
    if value is None or _import_text(value) == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        errors.append(
            f"Row {row_number}: {field_name} must be a whole number."
        )
        return None


def _import_float(
    value,
    field_name: str,
    row_number: int,
    errors: list[str],
) -> float | None:
    if value is None or _import_text(value) == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        errors.append(
            f"Row {row_number}: {field_name} must be numeric."
        )
        return None


def _import_date(
    value,
    field_name: str,
    row_number: int,
    errors: list[str],
) -> date | None:
    if value is None or _import_text(value) == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _import_text(value)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    errors.append(
        f"Row {row_number}: {field_name} must be a valid date, "
        "preferably yyyy-mm-dd."
    )
    return None


def _sheet_records(
    workbook,
    sheet_name: str,
    required_headers: set[str] | None = None,
) -> list[tuple[int, dict[str, object]]]:
    if sheet_name not in workbook.sheetnames:
        return []

    sheet = workbook[sheet_name]
    header_row: int | None = None
    headers: list[str] = []
    records: list[tuple[int, dict[str, object]]] = []
    required = required_headers or set()

    for row_number, cells in enumerate(sheet.iter_rows(), start=1):
        values = [cell.value for cell in cells]

        if header_row is None:
            if row_number > 20:
                return []

            normalised = [
                _import_text(value).rstrip(" *").strip()
                for value in values
            ]
            present = {value for value in normalised if value}

            if (
                (required and required.issubset(present))
                or (
                    not required
                    and any(
                        _import_text(value).endswith("*")
                        for value in values
                    )
                )
            ):
                header_row = row_number
                headers = normalised
            continue

        if not any(
            value is not None and _import_text(value) != ""
            for value in values
        ):
            continue

        record = {
            headers[index]: (
                values[index] if index < len(values) else None
            )
            for index in range(len(headers))
            if headers[index]
        }
        records.append((row_number, record))

    return records


@app.post("/api/admin/data-import")
async def import_master_data(
    company_id: int = Form(...),
    commit: bool = Form(False),
    allow_updates: bool = Form(False),
    workbook: UploadFile = File(...),
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=403,
            detail="Global Admin access required",
        )

    company = (
        db.query(Company)
        .filter(
            Company.id == company_id,
            Company.active == True,
        )
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Selected company was not found or is inactive.",
        )

    filename = workbook.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Upload an .xlsx OviCore import workbook.",
        )

    try:
        content = await workbook.read()
        excel = load_workbook(
            filename=BytesIO(content),
            data_only=True,
            read_only=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read workbook: {exc}",
        )

    farm_rows = _sheet_records(
        excel,
        "Farms",
        {"Farm Code", "Farm Name", "Active"},
    )
    shed_rows = _sheet_records(
        excel,
        "Sheds",
        {"Farm Code", "Shed Code", "Shed Name"},
    )
    flock_rows = _sheet_records(
        excel,
        "Flocks",
        {"Farm Code", "Shed Code", "Flock Code"},
    )
    standard_rows = _sheet_records(
        excel,
        "Breed Standard",
        {"Standard Code", "Breed", "Age Day", "Bodyweight g"},
    )
    performance_rows = _sheet_records(
        excel,
        "Daily Performance",
        {"Farm Code", "Shed Code", "Flock Code", "Entry Date"},
    )

    errors: list[str] = []
    warnings: list[str] = []
    actions = {
        "farms": {"create": 0, "update": 0, "unchanged": 0},
        "sheds": {"create": 0, "update": 0, "unchanged": 0},
        "flocks": {"create": 0, "update": 0, "unchanged": 0},
        "standards": {"create": 0, "update": 0, "unchanged": 0},
        "performance": {"create": 0, "update": 0, "unchanged": 0},
    }

    if not farm_rows:
        errors.append(
            "The Farms sheet is missing or contains no data rows."
        )
    if not shed_rows:
        errors.append(
            "The Sheds sheet is missing or contains no data rows."
        )
    if not flock_rows:
        errors.append(
            "The Flocks sheet is missing or contains no data rows."
        )
    if not standard_rows:
        warnings.append(
            "The Breed Standard sheet is missing or contains no data rows."
        )
    if not performance_rows:
        warnings.append(
            "The Daily Performance sheet is missing or contains no data rows."
        )

    existing_farms = (
        db.query(BroilerFarm)
        .filter(BroilerFarm.company_id == company_id)
        .all()
    )
    farm_by_code = {
        _import_text(farm.farm_code).lower(): farm
        for farm in existing_farms
        if _import_text(farm.farm_code)
    }

    workbook_farm_codes: set[str] = set()
    parsed_farms: list[dict[str, object]] = []

    for row_number, row in farm_rows:
        farm_code = _import_text(row.get("Farm Code"))
        farm_name = _import_text(row.get("Farm Name"))

        if not farm_code:
            errors.append(
                f"Farms row {row_number}: Farm Code is required."
            )
            continue
        if not farm_name:
            errors.append(
                f"Farms row {row_number}: Farm Name is required."
            )
            continue

        code_key = farm_code.lower()
        if code_key in workbook_farm_codes:
            errors.append(
                f"Farms row {row_number}: duplicate Farm Code "
                f"'{farm_code}'."
            )
            continue
        workbook_farm_codes.add(code_key)

        active = _import_bool(row.get("Active"), True)
        existing = farm_by_code.get(code_key)

        if existing is None:
            actions["farms"]["create"] += 1
        else:
            changed = (
                existing.farm_name != farm_name
                or bool(existing.active) != active
            )
            if changed and allow_updates:
                actions["farms"]["update"] += 1
            elif changed:
                actions["farms"]["unchanged"] += 1
                warnings.append(
                    f"Farms row {row_number}: '{farm_code}' exists "
                    "and differs; enable Allow updates to change it."
                )
            else:
                actions["farms"]["unchanged"] += 1

        parsed_farms.append({
            "row": row_number,
            "farm_code": farm_code,
            "farm_name": farm_name,
            "active": active,
            "existing": existing,
        })

    existing_sheds = (
        db.query(BroilerShed)
        .filter(BroilerShed.company_id == company_id)
        .all()
    )
    farm_code_by_id = {
        farm.id: _import_text(farm.farm_code).lower()
        for farm in existing_farms
    }
    shed_by_key = {
        (
            farm_code_by_id.get(shed.farm_id, ""),
            _import_text(shed.shed_code).lower(),
        ): shed
        for shed in existing_sheds
        if _import_text(shed.shed_code)
    }

    workbook_shed_keys: set[tuple[str, str]] = set()
    parsed_sheds: list[dict[str, object]] = []

    for row_number, row in shed_rows:
        farm_code = _import_text(row.get("Farm Code"))
        shed_code = _import_text(row.get("Shed Code"))
        shed_name = _import_text(row.get("Shed Name"))

        if not farm_code or not shed_code or not shed_name:
            errors.append(
                f"Sheds row {row_number}: Farm Code, Shed Code and "
                "Shed Name are required."
            )
            continue

        composite_key = (farm_code.lower(), shed_code.lower())

        if (
            composite_key[0] not in workbook_farm_codes
            and composite_key[0] not in farm_by_code
        ):
            errors.append(
                f"Sheds row {row_number}: Farm Code "
                f"'{farm_code}' was not found."
            )
            continue

        if composite_key in workbook_shed_keys:
            errors.append(
                f"Sheds row {row_number}: duplicate Shed Code "
                f"'{shed_code}' for Farm Code '{farm_code}'."
            )
            continue
        workbook_shed_keys.add(composite_key)

        floor_area = _import_float(
            row.get("Floor Area m²"),
            "Floor Area m²",
            row_number,
            errors,
        )
        active = _import_bool(row.get("Active"), True)
        existing = shed_by_key.get(composite_key)

        if existing is None:
            actions["sheds"]["create"] += 1
        else:
            changed = (
                existing.shed_name != shed_name
                or bool(existing.active) != active
                or (
                    floor_area is not None
                    and float(existing.floor_area_m2 or 0) != floor_area
                )
            )
            if changed and allow_updates:
                actions["sheds"]["update"] += 1
            elif changed:
                actions["sheds"]["unchanged"] += 1
                warnings.append(
                    f"Sheds row {row_number}: "
                    f"'{farm_code}/{shed_code}' exists and differs; "
                    "enable Allow updates to change it."
                )
            else:
                actions["sheds"]["unchanged"] += 1

        parsed_sheds.append({
            "row": row_number,
            "farm_code": farm_code,
            "shed_code": shed_code,
            "shed_name": shed_name,
            "floor_area_m2": floor_area or 1.0,
            "active": active,
            "existing": existing,
        })

    existing_plans = (
        db.query(BroilerPlacementPlan)
        .filter(BroilerPlacementPlan.company_id == company_id)
        .all()
    )
    plan_by_code = {
        _import_text(plan.cycle_code).lower(): plan
        for plan in existing_plans
        if _import_text(plan.cycle_code)
    }

    workbook_flock_codes: set[str] = set()
    parsed_flocks: list[dict[str, object]] = []

    for row_number, row in flock_rows:
        farm_code = _import_text(row.get("Farm Code"))
        shed_code = _import_text(row.get("Shed Code"))
        flock_code = _import_text(row.get("Flock Code"))
        module = _import_text(row.get("Module"))

        if not farm_code or not shed_code or not flock_code:
            errors.append(
                f"Flocks row {row_number}: Farm Code, Shed Code and "
                "Flock Code are required."
            )
            continue

        if module and module.lower() != "broilers":
            warnings.append(
                f"Flocks row {row_number}: module '{module}' was "
                "skipped; this importer currently creates broiler "
                "flocks only."
            )
            continue

        shed_lookup_key = (farm_code.lower(), shed_code.lower())
        if (
            shed_lookup_key not in workbook_shed_keys
            and shed_lookup_key not in shed_by_key
        ):
            errors.append(
                f"Flocks row {row_number}: shed "
                f"'{farm_code}/{shed_code}' was not found."
            )
            continue

        code_key = flock_code.lower()
        if code_key in workbook_flock_codes:
            errors.append(
                f"Flocks row {row_number}: duplicate Flock Code "
                f"'{flock_code}'."
            )
            continue
        workbook_flock_codes.add(code_key)

        placement_date = _import_date(
            row.get("Placement Date"),
            "Placement Date",
            row_number,
            errors,
        )
        placed_birds = _import_int(
            row.get("Placed Birds"),
            "Placed Birds",
            row_number,
            errors,
        )
        if placement_date is None or placed_birds is None:
            continue
        if placed_birds <= 0:
            errors.append(
                f"Flocks row {row_number}: Placed Birds must be "
                "greater than zero."
            )
            continue

        planned_end = _import_date(
            row.get("Planned Processing/Transfer Date"),
            "Planned Processing/Transfer Date",
            row_number,
            errors,
        )
        growout_days = (
            max(1, (planned_end - placement_date).days)
            if planned_end
            else 42
        )
        status = _import_text(row.get("Status")) or "Active"
        notes = _import_text(row.get("Notes"))
        existing = plan_by_code.get(code_key)

        if existing is None:
            actions["flocks"]["create"] += 1
        else:
            changed = (
                existing.placement_date != placement_date
                or int(existing.planned_birds or 0) != placed_birds
                or _import_text(existing.status) != status
                or _import_text(existing.notes) != notes
            )
            if changed and allow_updates:
                actions["flocks"]["update"] += 1
            elif changed:
                actions["flocks"]["unchanged"] += 1
                warnings.append(
                    f"Flocks row {row_number}: '{flock_code}' exists "
                    "and differs; enable Allow updates to change it."
                )
            else:
                actions["flocks"]["unchanged"] += 1

        parsed_flocks.append({
            "row": row_number,
            "farm_code": farm_code,
            "shed_code": shed_code,
            "flock_code": flock_code,
            "breed": _import_text(row.get("Breed")) or None,
            "placement_date": placement_date,
            "placed_birds": placed_birds,
            "growout_days": growout_days,
            "status": status,
            "notes": notes,
            "existing": existing,
        })

    parsed_standards: list[dict[str, object]] = []
    standard_codes: set[str] = set()

    for row_number, row in standard_rows:
        standard_code = (
            _import_text(row.get("Standard Code"))
            .upper()
            .replace(" ", "_")
        )
        breed = _import_text(row.get("Breed"))
        age_day = _import_int(
            row.get("Age Day"),
            "Age Day",
            row_number,
            errors,
        )
        bodyweight_g = _import_float(
            row.get("Bodyweight g"),
            "Bodyweight g",
            row_number,
            errors,
        )
        daily_feed = _import_float(
            row.get("Daily Feed g/bird"),
            "Daily Feed g/bird",
            row_number,
            errors,
        )
        livability = _import_float(
            row.get("Target Livability %"),
            "Target Livability %",
            row_number,
            errors,
        )

        if not standard_code or not breed:
            errors.append(
                f"Breed Standard row {row_number}: Standard Code "
                "and Breed are required."
            )
            continue
        if age_day is None or bodyweight_g is None:
            continue

        standard_codes.add(standard_code)
        parsed_standards.append({
            "row": row_number,
            "standard_code": standard_code,
            "standard_name": f"{breed} Broiler Standard",
            "breed": breed,
            "age_day": age_day,
            "body_weight_g": bodyweight_g,
            "feed_avg_g_bird_day": daily_feed,
            "liveability_pct": livability,
        })

    if len(standard_codes) > 1:
        errors.append(
            "The Breed Standard sheet must contain only one "
            "Standard Code per workbook."
        )

    existing_standard_rows: list[PerformanceStandard] = []
    active_standard_code = (
        next(iter(standard_codes)) if standard_codes else None
    )

    if active_standard_code:
        existing_standard_rows = (
            db.query(PerformanceStandard)
            .filter(
                PerformanceStandard.standard_code
                == active_standard_code,
                PerformanceStandard.standard_type == "Breed",
                PerformanceStandard.company_id.is_(None),
            )
            .all()
        )

        if not existing_standard_rows:
            actions["standards"]["create"] = len(parsed_standards)
        elif allow_updates:
            actions["standards"]["update"] = len(parsed_standards)
        else:
            actions["standards"]["unchanged"] = len(
                existing_standard_rows
            )
            warnings.append(
                f"Breed standard '{active_standard_code}' already "
                "exists. Enable Allow updates to replace it."
            )

    existing_performance = (
        db.query(BroilerDailyPerformance)
        .filter(BroilerDailyPerformance.company_id == company_id)
        .all()
    )
    perf_by_key = {
        (entry.placement_plan_id, entry.entry_date): entry
        for entry in existing_performance
    }
    parsed_performance: list[dict[str, object]] = []
    workbook_perf_keys: set[tuple[str, date]] = set()

    for row_number, row in performance_rows:
        flock_code = _import_text(row.get("Flock Code"))
        entry_date = _import_date(
            row.get("Entry Date"),
            "Entry Date",
            row_number,
            errors,
        )

        if not flock_code or entry_date is None:
            errors.append(
                f"Daily Performance row {row_number}: Flock Code "
                "and Entry Date are required."
            )
            continue

        code_key = flock_code.lower()
        if (
            code_key not in workbook_flock_codes
            and code_key not in plan_by_code
        ):
            errors.append(
                f"Daily Performance row {row_number}: Flock Code "
                f"'{flock_code}' was not found."
            )
            continue

        workbook_key = (code_key, entry_date)
        if workbook_key in workbook_perf_keys:
            errors.append(
                f"Daily Performance row {row_number}: duplicate "
                f"entry for '{flock_code}' on {entry_date}."
            )
            continue
        workbook_perf_keys.add(workbook_key)

        age_days = _import_int(
            row.get("Age Days"),
            "Age Days",
            row_number,
            errors,
        )
        opening = _import_int(
            row.get("Opening Birds"),
            "Opening Birds",
            row_number,
            errors,
        )
        mortality = _import_int(
            row.get("Mortality Birds"),
            "Mortality Birds",
            row_number,
            errors,
        ) or 0
        culls = _import_int(
            row.get("Cull Birds"),
            "Cull Birds",
            row_number,
            errors,
        ) or 0
        closing = _import_int(
            row.get("Closing Birds"),
            "Closing Birds",
            row_number,
            errors,
        )
        feed_kg = _import_float(
            row.get("Feed kg"),
            "Feed kg",
            row_number,
            errors,
        )
        water_l = _import_float(
            row.get("Water L"),
            "Water L",
            row_number,
            errors,
        )
        bodyweight = _import_float(
            row.get("Bodyweight kg"),
            "Bodyweight kg",
            row_number,
            errors,
        )
        notes = _import_text(row.get("Comments"))

        existing_plan = plan_by_code.get(code_key)
        existing_entry = (
            perf_by_key.get((existing_plan.id, entry_date))
            if existing_plan
            else None
        )

        if existing_entry is None:
            actions["performance"]["create"] += 1
        else:
            changed = (
                int(existing_entry.opening_birds or 0)
                != int(opening or 0)
                or int(existing_entry.mortality_birds or 0)
                != mortality
                or int(existing_entry.cull_birds or 0) != culls
                or float(existing_entry.feed_kg or 0)
                != float(feed_kg or 0)
                or float(existing_entry.water_litres or 0)
                != float(water_l or 0)
                or float(existing_entry.avg_weight_kg or 0)
                != float(bodyweight or 0)
            )
            if changed and allow_updates:
                actions["performance"]["update"] += 1
            else:
                actions["performance"]["unchanged"] += 1

        parsed_performance.append({
            "row": row_number,
            "flock_code": flock_code,
            "entry_date": entry_date,
            "age_days": age_days,
            "opening_birds": opening,
            "mortality_birds": mortality,
            "cull_birds": culls,
            "closing_birds": closing,
            "feed_kg": feed_kg,
            "water_litres": water_l,
            "avg_weight_kg": bodyweight,
            "notes": notes,
            "existing": existing_entry,
        })

    result = {
        "company": {
            "id": company.id,
            "name": (
                getattr(company, "company_name", None)
                or getattr(company, "name", None)
                or f"Company {company.id}"
            ),
        },
        "filename": filename,
        "mode": "commit" if commit else "preview",
        "allow_updates": allow_updates,
        "actions": actions,
        "errors": errors,
        "warnings": warnings,
        "committed": False,
    }

    if errors or not commit:
        return result

    try:
        farm_objects: dict[str, BroilerFarm] = dict(farm_by_code)

        for item in parsed_farms:
            existing = item["existing"]
            if existing is None:
                existing = BroilerFarm(
                    company_id=company_id,
                    farm_code=item["farm_code"],
                    farm_name=item["farm_name"],
                    active=item["active"],
                )
                db.add(existing)
                db.flush()
            elif allow_updates:
                existing.farm_name = item["farm_name"]
                existing.active = item["active"]

            farm_objects[str(item["farm_code"]).lower()] = existing

        shed_objects: dict[
            tuple[str, str],
            BroilerShed,
        ] = dict(shed_by_key)

        for item in parsed_sheds:
            farm = farm_objects[str(item["farm_code"]).lower()]
            key = (
                str(item["farm_code"]).lower(),
                str(item["shed_code"]).lower(),
            )
            existing = item["existing"]

            if existing is None:
                existing = BroilerShed(
                    company_id=company_id,
                    farm_id=farm.id,
                    shed_code=item["shed_code"],
                    shed_name=item["shed_name"],
                    floor_area_m2=item["floor_area_m2"],
                    default_density_kg_m2=32.0,
                    default_target_lw_kg=2.5,
                    default_growout_days=42,
                    active=item["active"],
                )
                db.add(existing)
                db.flush()
            elif allow_updates:
                existing.farm_id = farm.id
                existing.shed_name = item["shed_name"]
                existing.floor_area_m2 = item["floor_area_m2"]
                existing.active = item["active"]

            shed_objects[key] = existing

        plan_objects: dict[str, BroilerPlacementPlan] = dict(
            plan_by_code
        )

        for item in parsed_flocks:
            key = (
                str(item["farm_code"]).lower(),
                str(item["shed_code"]).lower(),
            )
            farm = farm_objects[str(item["farm_code"]).lower()]
            shed = shed_objects[key]
            existing = item["existing"]

            if existing is None:
                existing = BroilerPlacementPlan(
                    company_id=company_id,
                    farm_id=farm.id,
                    shed_id=shed.id,
                    cycle_code=item["flock_code"],
                    placement_date=item["placement_date"],
                    planned_birds=item["placed_birds"],
                    target_density_kg_m2=(
                        shed.default_density_kg_m2
                    ),
                    target_lw_kg=shed.default_target_lw_kg,
                    growout_days=item["growout_days"],
                    chick_allowance_pct=1.5,
                    notes=item["notes"],
                    status=item["status"],
                    last_saved_by=current_user.full_name,
                    last_saved_at=datetime.utcnow(),
                )
                db.add(existing)
                db.flush()
            elif allow_updates:
                existing.farm_id = farm.id
                existing.shed_id = shed.id
                existing.placement_date = item["placement_date"]
                existing.planned_birds = item["placed_birds"]
                existing.growout_days = item["growout_days"]
                existing.notes = item["notes"]
                existing.status = item["status"]
                existing.last_saved_by = current_user.full_name
                existing.last_saved_at = datetime.utcnow()

            plan_objects[
                str(item["flock_code"]).lower()
            ] = existing

        if parsed_standards and (
            not existing_standard_rows or allow_updates
        ):
            if existing_standard_rows:
                (
                    db.query(PerformanceStandard)
                    .filter(
                        PerformanceStandard.standard_code
                        == active_standard_code,
                        PerformanceStandard.standard_type == "Breed",
                        PerformanceStandard.company_id.is_(None),
                    )
                    .delete(synchronize_session=False)
                )

            now = datetime.utcnow()
            for item in parsed_standards:
                db.add(
                    PerformanceStandard(
                        company_id=None,
                        standard_code=item["standard_code"],
                        standard_name=item["standard_name"],
                        standard_type="Breed",
                        module="Broilers",
                        species="Chicken",
                        breed=item["breed"],
                        phase="Growout",
                        age_day=item["age_day"],
                        age_week=None,
                        body_weight_g=item["body_weight_g"],
                        feed_avg_g_bird_day=(
                            item["feed_avg_g_bird_day"]
                        ),
                        liveability_pct=item["liveability_pct"],
                        source_file=filename,
                        active=True,
                        created_at=now,
                        updated_at=now,
                        imported_by=current_user.full_name,
                    )
                )

        for item in parsed_performance:
            plan = plan_objects[
                str(item["flock_code"]).lower()
            ]
            existing = item["existing"]

            if existing is None:
                existing = BroilerDailyPerformance(
                    company_id=company_id,
                    placement_plan_id=plan.id,
                    entry_date=item["entry_date"],
                )
                db.add(existing)
            elif not allow_updates:
                continue

            existing.age_days = item["age_days"]
            existing.opening_birds = item["opening_birds"]
            existing.mortality_front = 0
            existing.mortality_middle = 0
            existing.mortality_back = 0
            existing.mortality_other = item["mortality_birds"]
            existing.cull_legs = 0
            existing.cull_runts = 0
            existing.cull_beak = 0
            existing.cull_other = item["cull_birds"]
            existing.closing_birds = item["closing_birds"]
            existing.feed_kg = item["feed_kg"]
            existing.water_litres = item["water_litres"]
            existing.avg_weight_kg = item["avg_weight_kg"]
            existing.notes = item["notes"]
            existing.last_saved_by = current_user.full_name
            existing.last_saved_at = datetime.utcnow()
            recalculate_daily_performance_entry(existing)

        db.commit()
        result["committed"] = True
        return result

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Import failed and was rolled back: {exc}",
        )


# ---------------------------------------------------------------------
# Layer Rearing Flock Register
# ---------------------------------------------------------------------

def build_layer_rearing_flock_response(
    flock: LayerRearingFlock,
) -> LayerRearingFlockOut:
    today = date.today()

    current_age_weeks = None
    if flock.hatch_date:
        current_age_weeks = round(
            (today - flock.hatch_date).days / 7,
            2,
        )
    elif flock.placement_date:
        current_age_weeks = round(
            (today - flock.placement_date).days / 7,
            2,
        )

    days_to_transfer = None
    if flock.planned_transfer_date:
        days_to_transfer = (
            flock.planned_transfer_date - today
        ).days

    transfer_readiness = "Not assessed"

    if (
        flock.status
        and flock.status.lower()
        in {"transferred", "closed"}
    ):
        transfer_readiness = "Transferred"
    elif (
        flock.planned_transfer_date
        and days_to_transfer is not None
        and days_to_transfer <= 14
    ):
        transfer_readiness = "Review Required"
    elif (
        flock.birds_placed
        and flock.birds_placed > 0
        and flock.destination_farm_id
        and flock.destination_shed_id
        and flock.planned_transfer_date
    ):
        transfer_readiness = "Ready"

    return LayerRearingFlockOut(
        id=flock.id,
        company_id=flock.company_id,

        farm_id=flock.farm_id,
        shed_id=flock.shed_id,
        farm_name=(
            flock.farm.farm_name
            if flock.farm
            else ""
        ),
        shed_name=(
            flock.shed.shed_name
            if flock.shed
            else ""
        ),

        destination_farm_id=flock.destination_farm_id,
        destination_shed_id=flock.destination_shed_id,
        destination_farm_name=(
            flock.destination_farm.farm_name
            if flock.destination_farm
            else None
        ),
        destination_shed_name=(
            flock.destination_shed.shed_name
            if flock.destination_shed
            else None
        ),

        flock_code=flock.flock_code,
        breed=flock.breed,

        hatch_date=flock.hatch_date,
        placement_date=flock.placement_date,
        birds_placed=flock.birds_placed,

        planned_transfer_date=flock.planned_transfer_date,

        current_age_weeks=current_age_weeks,
        days_to_transfer=days_to_transfer,
        current_birds=flock.birds_placed,
        cumulative_mortality_pct=None,
        bodyweight_variance_pct=None,
        transfer_readiness=transfer_readiness,

        status=flock.status,
        notes=flock.notes,

        last_saved_by=flock.last_saved_by,
        last_saved_at=flock.last_saved_at,
    )


def validate_layer_rearing_locations(
    db: Session,
    current_user: models.AppUser,
    company_id: int,
    farm_id: int,
    shed_id: int,
    destination_farm_id: int | None = None,
    destination_shed_id: int | None = None,
):
    farm = require_farm_access(
        db,
        current_user,
        farm_id,
    )

    if farm.company_id != company_id:
        raise HTTPException(
            status_code=400,
            detail="The selected farm does not belong to the selected company.",
        )

    shed = (
        db.query(BroilerShed)
        .filter(
            BroilerShed.id == shed_id,
            BroilerShed.company_id == company_id,
            BroilerShed.farm_id == farm_id,
            BroilerShed.active == True,
        )
        .first()
    )

    if not shed:
        raise HTTPException(
            status_code=400,
            detail="The selected rearing shed is invalid or inactive.",
        )

    destination_farm = None
    destination_shed = None

    if destination_farm_id is not None:
        destination_farm = require_farm_access(
            db,
            current_user,
            destination_farm_id,
        )

        if destination_farm.company_id != company_id:
            raise HTTPException(
                status_code=400,
                detail="The destination farm belongs to another company.",
            )

    if destination_shed_id is not None:
        if destination_farm_id is None:
            raise HTTPException(
                status_code=400,
                detail="Select a destination farm before a destination shed.",
            )

        destination_shed = (
            db.query(BroilerShed)
            .filter(
                BroilerShed.id == destination_shed_id,
                BroilerShed.company_id == company_id,
                BroilerShed.farm_id == destination_farm_id,
                BroilerShed.active == True,
            )
            .first()
        )

        if not destination_shed:
            raise HTTPException(
                status_code=400,
                detail="The selected destination shed is invalid or inactive.",
            )

    return farm, shed, destination_farm, destination_shed


@app.get(
    "/api/layers/rearing/flocks",
    response_model=list[LayerRearingFlockOut],
)
def list_layer_rearing_flocks(
    company_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(LayerRearingFlock)
        .options(
            joinedload(LayerRearingFlock.farm),
            joinedload(LayerRearingFlock.shed),
            joinedload(LayerRearingFlock.destination_farm),
            joinedload(LayerRearingFlock.destination_shed),
        )
        .filter(
            LayerRearingFlock.company_id
            == resolved_company_id
        )
    )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            LayerRearingFlock.farm_id.in_(
                permitted_farm_ids
            )
        )

    flocks = (
        query
        .order_by(
            LayerRearingFlock.placement_date.asc(),
            LayerRearingFlock.id.asc(),
        )
        .all()
    )

    return [
        build_layer_rearing_flock_response(flock)
        for flock in flocks
    ]


@app.post(
    "/api/layers/rearing/flocks",
    response_model=LayerRearingFlockOut,
)
def create_layer_rearing_flock(
    payload: LayerRearingFlockCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        payload.company_id,
    )

    validate_layer_rearing_locations(
        db,
        current_user,
        resolved_company_id,
        payload.farm_id,
        payload.shed_id,
        payload.destination_farm_id,
        payload.destination_shed_id,
    )

    duplicate = (
        db.query(LayerRearingFlock)
        .filter(
            LayerRearingFlock.company_id
            == resolved_company_id,
            LayerRearingFlock.flock_code
            == payload.flock_code.strip(),
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="A layer rearing flock with this code already exists.",
        )

    flock = LayerRearingFlock(
        company_id=resolved_company_id,
        farm_id=payload.farm_id,
        shed_id=payload.shed_id,
        destination_farm_id=payload.destination_farm_id,
        destination_shed_id=payload.destination_shed_id,
        flock_code=payload.flock_code.strip(),
        breed=payload.breed.strip() if payload.breed else None,
        hatch_date=payload.hatch_date,
        placement_date=payload.placement_date,
        birds_placed=payload.birds_placed,
        planned_transfer_date=payload.planned_transfer_date,
        status=payload.status,
        notes=payload.notes,
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    db.add(flock)
    db.commit()
    db.refresh(flock)

    flock = (
        db.query(LayerRearingFlock)
        .options(
            joinedload(LayerRearingFlock.farm),
            joinedload(LayerRearingFlock.shed),
            joinedload(LayerRearingFlock.destination_farm),
            joinedload(LayerRearingFlock.destination_shed),
        )
        .filter(
            LayerRearingFlock.id == flock.id
        )
        .first()
    )

    return build_layer_rearing_flock_response(flock)


@app.post(
    "/api/layers/rearing/flocks/new-row",
    response_model=LayerRearingFlockOut,
)
def create_layer_rearing_flock_new_row(
    company_id: int | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_company_id = resolve_company_id(
        current_user,
        company_id,
    )

    query = (
        db.query(BroilerShed)
        .join(
            BroilerFarm,
            BroilerFarm.id == BroilerShed.farm_id,
        )
        .filter(
            BroilerShed.active == True,
            BroilerShed.company_id == resolved_company_id,
            BroilerFarm.company_id == resolved_company_id,
        )
    )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            BroilerShed.farm_id.in_(permitted_farm_ids)
        )

    shed = query.order_by(BroilerShed.id.asc()).first()

    if not shed:
        raise HTTPException(
            status_code=400,
            detail="No active sheds are available for this company and user.",
        )

    existing_count = (
        db.query(LayerRearingFlock)
        .filter(
            LayerRearingFlock.company_id
            == resolved_company_id
        )
        .count()
    )

    flock = LayerRearingFlock(
        company_id=resolved_company_id,
        farm_id=shed.farm_id,
        shed_id=shed.id,
        flock_code=f"LR-NEW-{existing_count + 1:03d}",
        status="Draft",
        notes="",
        last_saved_by=current_user.full_name,
        last_saved_at=datetime.utcnow(),
    )

    db.add(flock)
    db.commit()
    db.refresh(flock)

    flock = (
        db.query(LayerRearingFlock)
        .options(
            joinedload(LayerRearingFlock.farm),
            joinedload(LayerRearingFlock.shed),
            joinedload(LayerRearingFlock.destination_farm),
            joinedload(LayerRearingFlock.destination_shed),
        )
        .filter(
            LayerRearingFlock.id == flock.id
        )
        .first()
    )

    return build_layer_rearing_flock_response(flock)


@app.patch(
    "/api/layers/rearing/flocks/{flock_id}",
    response_model=LayerRearingFlockOut,
)
def update_layer_rearing_flock(
    flock_id: int,
    payload: LayerRearingFlockPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flock = (
        db.query(LayerRearingFlock)
        .options(
            joinedload(LayerRearingFlock.farm),
            joinedload(LayerRearingFlock.shed),
            joinedload(LayerRearingFlock.destination_farm),
            joinedload(LayerRearingFlock.destination_shed),
        )
        .filter(
            LayerRearingFlock.id == flock_id
        )
        .first()
    )

    if not flock:
        raise HTTPException(
            status_code=404,
            detail="Layer rearing flock not found.",
        )

    require_farm_access(
        db,
        current_user,
        flock.farm_id,
    )

    if (
        not current_user.is_global_admin
        and flock.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company.",
        )

    data = payload.model_dump(exclude_unset=True)

    target_farm_id = data.get("farm_id", flock.farm_id)
    target_shed_id = data.get("shed_id", flock.shed_id)
    target_destination_farm_id = data.get(
        "destination_farm_id",
        flock.destination_farm_id,
    )
    target_destination_shed_id = data.get(
        "destination_shed_id",
        flock.destination_shed_id,
    )

    validate_layer_rearing_locations(
        db,
        current_user,
        flock.company_id,
        target_farm_id,
        target_shed_id,
        target_destination_farm_id,
        target_destination_shed_id,
    )

    if "flock_code" in data and data["flock_code"]:
        flock_code = data["flock_code"].strip()

        duplicate = (
            db.query(LayerRearingFlock)
            .filter(
                LayerRearingFlock.company_id
                == flock.company_id,
                LayerRearingFlock.flock_code
                == flock_code,
                LayerRearingFlock.id != flock.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Another layer rearing flock already uses this code.",
            )

        data["flock_code"] = flock_code

    if "breed" in data and data["breed"]:
        data["breed"] = data["breed"].strip()

    for field, value in data.items():
        setattr(flock, field, value)

    flock.last_saved_by = current_user.full_name
    flock.last_saved_at = datetime.utcnow()

    db.commit()
    db.refresh(flock)

    flock = (
        db.query(LayerRearingFlock)
        .options(
            joinedload(LayerRearingFlock.farm),
            joinedload(LayerRearingFlock.shed),
            joinedload(LayerRearingFlock.destination_farm),
            joinedload(LayerRearingFlock.destination_shed),
        )
        .filter(
            LayerRearingFlock.id == flock.id
        )
        .first()
    )

    return build_layer_rearing_flock_response(flock)


@app.delete("/api/layers/rearing/flocks/{flock_id}")
def delete_layer_rearing_flock(
    flock_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    flock = (
        db.query(LayerRearingFlock)
        .filter(
            LayerRearingFlock.id == flock_id
        )
        .first()
    )

    if not flock:
        raise HTTPException(
            status_code=404,
            detail="Layer rearing flock not found.",
        )

    require_farm_access(
        db,
        current_user,
        flock.farm_id,
    )

    db.delete(flock)
    db.commit()

    return {
        "deleted": True,
        "id": flock_id,
    }
