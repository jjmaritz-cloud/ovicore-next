import os
from datetime import datetime
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from app.routers import broiler_processing
from app.routers import app_notes
from app.routers import broiler_supply
from app.routers import access
from app.routers import auth
from app.routers.auth import get_current_user
from app import models

from .db import Base, engine, SessionLocal, get_db
from .models import (
    Company,
    BroilerFarm,
    BroilerShed,
    BroilerPlacementPlan,
    BroilerDailyPerformance,
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
)
from .calculations import build_plan_response
from .seed import seed_demo_data

app = FastAPI(title="OviCore Broiler Module API", version="0.1.0")
app.include_router(broiler_processing.router)
app.include_router(app_notes.router)
app.include_router(broiler_supply.router)
app.include_router(access.router)
app.include_router(auth.router)

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
    payload: BroilerDemandPlanPatch,
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

    data = payload.model_dump(
        exclude_unset=True
    )

    for field, value in data.items():
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