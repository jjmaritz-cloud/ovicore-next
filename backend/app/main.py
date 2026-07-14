import os
from datetime import datetime
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from app.routers import broiler_processing
from app.routers import app_notes
from app.routers import broiler_supply
from app.routers import access
from app.routers import auth

from .db import Base, engine, SessionLocal, get_db
from .models import (
    Company,
    BroilerFarm,
    BroilerShed,
    BroilerPlacementPlan,
    BroilerDailyPerformance,
)
from .schemas import (
    CompanyCreate,
    CompanyPatch,
    CompanyOut,
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

# ---------------------------------------------------------------------
# Companies - Global Admin Master Data
# ---------------------------------------------------------------------


@app.get("/api/admin/companies", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    companies = (
        db.query(Company)
        .order_by(Company.company_name.asc())
        .all()
    )

    return companies


@app.post("/api/admin/companies", response_model=CompanyOut)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Company)
        .filter(Company.company_name == payload.company_name)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="A company with this name already exists.",
        )

    company = Company(
        company_name=payload.company_name,
        trading_name=payload.trading_name,
        active=payload.active,
        enable_broilers=payload.enable_broilers,
        enable_breeders=payload.enable_breeders,
        enable_layers=payload.enable_layers,
        enable_hatchery=payload.enable_hatchery,
        enable_processing=payload.enable_processing,
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    return company


@app.patch("/api/admin/companies/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int,
    payload: CompanyPatch,
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    data = payload.model_dump(exclude_unset=True)

    if "company_name" in data and data["company_name"]:
        duplicate = (
            db.query(Company)
            .filter(
                Company.company_name == data["company_name"],
                Company.id != company_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Another company with this name already exists.",
            )

    for field, value in data.items():
        setattr(company, field, value)

    db.commit()
    db.refresh(company)

    return company


@app.delete("/api/admin/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    linked_farms = (
        db.query(BroilerFarm)
        .filter(BroilerFarm.company_id == company_id)
        .count()
    )

    if linked_farms > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete company because it has linked farms. Set the company inactive instead.",
        )

    db.delete(company)
    db.commit()

    return {"deleted": True, "id": company_id}

@app.get("/api/broilers/demand-plans", response_model=list[BroilerDemandPlanOut])
def list_demand_plans(company_id: int = 1, db: Session = Depends(get_db)):
    plans = (
        db.query(BroilerPlacementPlan)
        .options(joinedload(BroilerPlacementPlan.farm), joinedload(BroilerPlacementPlan.shed))
        .filter(BroilerPlacementPlan.company_id == company_id)
        .order_by(BroilerPlacementPlan.placement_date.asc(), BroilerPlacementPlan.id.asc())
        .all()
    )
    return [build_plan_response(plan) for plan in plans]


@app.patch("/api/broilers/demand-plans/{plan_id}", response_model=BroilerDemandPlanOut)
def update_demand_plan(plan_id: int, payload: BroilerDemandPlanPatch, db: Session = Depends(get_db)):
    plan = (
        db.query(BroilerPlacementPlan)
        .options(joinedload(BroilerPlacementPlan.farm), joinedload(BroilerPlacementPlan.shed))
        .filter(BroilerPlacementPlan.id == plan_id)
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Broiler demand plan not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(plan, field, value)
    plan.last_saved_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return build_plan_response(plan)


@app.post("/api/broilers/demand-plans", response_model=BroilerDemandPlanOut)
def create_demand_plan(payload: BroilerDemandPlanCreate, db: Session = Depends(get_db)):
    shed = db.query(BroilerShed).filter(BroilerShed.id == payload.shed_id).first()
    farm = db.query(BroilerFarm).filter(BroilerFarm.id == payload.farm_id).first()
    if not farm or not shed:
        raise HTTPException(status_code=400, detail="Valid farm_id and shed_id are required")

    plan = BroilerPlacementPlan(**payload.model_dump())
    plan.last_saved_at = datetime.utcnow()
    db.add(plan)
    db.commit()
    db.refresh(plan)
    plan = (
        db.query(BroilerPlacementPlan)
        .options(joinedload(BroilerPlacementPlan.farm), joinedload(BroilerPlacementPlan.shed))
        .filter(BroilerPlacementPlan.id == plan.id)
        .first()
    )
    return build_plan_response(plan)


@app.delete("/api/broilers/demand-plans/{plan_id}")
def delete_demand_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(BroilerPlacementPlan).filter(BroilerPlacementPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Broiler demand plan not found")
    db.delete(plan)
    db.commit()
    return {"deleted": True, "id": plan_id}

@app.post("/api/broilers/demand-plans/new-row", response_model=BroilerDemandPlanOut)
def create_broiler_demand_plan_new_row(db: Session = Depends(get_db)):
    """
    Create a blank/default broiler placement plan row.
    This endpoint is used by the frontend 'New placement row' button.
    It does not require a request body.
    """

    shed = (
        db.query(BroilerShed)
        .filter(BroilerShed.active == True)
        .order_by(BroilerShed.id.asc())
        .first()
    )

    if shed is None:
        raise HTTPException(
            status_code=400,
            detail="No active broiler sheds available. Create a broiler shed first.",
        )

    farm = (
        db.query(BroilerFarm)
        .filter(BroilerFarm.id == shed.farm_id)
        .first()
    )

    if farm is None:
        raise HTTPException(
            status_code=400,
            detail="Default broiler shed does not have a valid farm.",
        )

    existing_count = db.query(BroilerPlacementPlan).count()
    next_number = existing_count + 1

    plan = BroilerPlacementPlan(
        company_id=shed.company_id,
        farm_id=shed.farm_id,
        shed_id=shed.id,
        cycle_code=f"BR-NEW-{next_number:03d}",
        placement_date=None,
        planned_birds=None,
        target_density_kg_m2=shed.default_density_kg_m2,
        target_lw_kg=shed.default_target_lw_kg,
        growout_days=shed.default_growout_days,
        chick_allowance_pct=1.5,
        notes="",
        status="Draft",
        last_saved_by="JJ",
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
        .filter(BroilerPlacementPlan.id == plan.id)
        .first()
    )

    return build_plan_response(plan)

@app.get("/api/broilers/farms", response_model=list[BroilerFarmOut])
def list_broiler_farms(company_id: int = 1, db: Session = Depends(get_db)):
    farms = (
        db.query(BroilerFarm)
        .filter(BroilerFarm.company_id == company_id)
        .order_by(BroilerFarm.farm_name.asc())
        .all()
    )

    return farms


@app.post("/api/broilers/farms", response_model=BroilerFarmOut)
def create_broiler_farm(payload: BroilerFarmCreate, db: Session = Depends(get_db)):
    farm = BroilerFarm(
        company_id=payload.company_id,
        farm_name=payload.farm_name,
        farm_code=payload.farm_code,
        active=payload.active,
    )

    db.add(farm)
    db.commit()
    db.refresh(farm)

    return farm


@app.patch("/api/broilers/farms/{farm_id}", response_model=BroilerFarmOut)
def update_broiler_farm(
    farm_id: int,
    payload: BroilerFarmPatch,
    db: Session = Depends(get_db),
):
    farm = db.query(BroilerFarm).filter(BroilerFarm.id == farm_id).first()

    if not farm:
        raise HTTPException(status_code=404, detail="Broiler farm not found")

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(farm, field, value)

    db.commit()
    db.refresh(farm)

    return farm


@app.delete("/api/broilers/farms/{farm_id}")
def delete_broiler_farm(farm_id: int, db: Session = Depends(get_db)):
    farm = db.query(BroilerFarm).filter(BroilerFarm.id == farm_id).first()

    if not farm:
        raise HTTPException(status_code=404, detail="Broiler farm not found")

    linked_sheds = db.query(BroilerShed).filter(BroilerShed.farm_id == farm_id).count()

    if linked_sheds > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete farm because it has linked sheds. Set the farm inactive instead.",
        )

    db.delete(farm)
    db.commit()

    return {"deleted": True, "id": farm_id}


@app.get("/api/broilers/sheds", response_model=list[BroilerShedOut])
def list_broiler_sheds(company_id: int = 1, db: Session = Depends(get_db)):
    sheds = (
        db.query(BroilerShed, BroilerFarm.farm_name)
        .join(BroilerFarm, BroilerFarm.id == BroilerShed.farm_id)
        .filter(BroilerShed.company_id == company_id)
        .order_by(BroilerFarm.farm_name.asc(), BroilerShed.shed_name.asc())
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
            default_density_kg_m2=float(shed.default_density_kg_m2),
            default_target_lw_kg=float(shed.default_target_lw_kg),
            default_growout_days=shed.default_growout_days,
            active=shed.active,
        )
        for shed, farm_name in sheds
    ]


@app.post("/api/broilers/sheds", response_model=BroilerShedOut)
def create_broiler_shed(payload: BroilerShedCreate, db: Session = Depends(get_db)):
    farm = db.query(BroilerFarm).filter(BroilerFarm.id == payload.farm_id).first()

    if not farm:
        raise HTTPException(status_code=404, detail="Broiler farm not found")

    shed = BroilerShed(
        company_id=payload.company_id,
        farm_id=payload.farm_id,
        shed_name=payload.shed_name,
        shed_code=payload.shed_code,
        floor_area_m2=payload.floor_area_m2,
        default_density_kg_m2=payload.default_density_kg_m2,
        default_target_lw_kg=payload.default_target_lw_kg,
        default_growout_days=payload.default_growout_days,
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
        default_density_kg_m2=float(shed.default_density_kg_m2),
        default_target_lw_kg=float(shed.default_target_lw_kg),
        default_growout_days=shed.default_growout_days,
        active=shed.active,
    )


@app.patch("/api/broilers/sheds/{shed_id}", response_model=BroilerShedOut)
def update_broiler_shed(
    shed_id: int,
    payload: BroilerShedPatch,
    db: Session = Depends(get_db),
):
    shed = db.query(BroilerShed).filter(BroilerShed.id == shed_id).first()

    if not shed:
        raise HTTPException(status_code=404, detail="Broiler shed not found")

    data = payload.model_dump(exclude_unset=True)

    if "farm_id" in data:
        farm_check = db.query(BroilerFarm).filter(BroilerFarm.id == data["farm_id"]).first()
        if not farm_check:
            raise HTTPException(status_code=404, detail="Broiler farm not found")

    for field, value in data.items():
        setattr(shed, field, value)

    db.commit()
    db.refresh(shed)

    farm = db.query(BroilerFarm).filter(BroilerFarm.id == shed.farm_id).first()

    return BroilerShedOut(
        id=shed.id,
        company_id=shed.company_id,
        farm_id=shed.farm_id,
        farm_name=farm.farm_name if farm else None,
        shed_name=shed.shed_name,
        shed_code=shed.shed_code,
        floor_area_m2=float(shed.floor_area_m2),
        default_density_kg_m2=float(shed.default_density_kg_m2),
        default_target_lw_kg=float(shed.default_target_lw_kg),
        default_growout_days=shed.default_growout_days,
        active=shed.active,
    )


@app.delete("/api/broilers/sheds/{shed_id}")
def delete_broiler_shed(shed_id: int, db: Session = Depends(get_db)):
    shed = db.query(BroilerShed).filter(BroilerShed.id == shed_id).first()

    if not shed:
        raise HTTPException(status_code=404, detail="Broiler shed not found")

    linked_plans = (
        db.query(BroilerPlacementPlan)
        .filter(BroilerPlacementPlan.shed_id == shed_id)
        .count()
    )

    if linked_plans > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete shed because it has linked placement plans. Set the shed inactive instead.",
        )

    db.delete(shed)
    db.commit()

    return {"deleted": True, "id": shed_id}

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
    
@app.get("/api/broilers/performance", response_model=list[BroilerDailyPerformanceOut])
def list_broiler_performance(
    company_id: int = 1,
    placement_plan_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(BroilerDailyPerformance.placement_plan).joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerDailyPerformance.placement_plan).joinedload(BroilerPlacementPlan.shed),
        )
        .filter(BroilerDailyPerformance.company_id == company_id)
    )

    if placement_plan_id is not None:
        query = query.filter(BroilerDailyPerformance.placement_plan_id == placement_plan_id)

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
        cumulative_by_plan.setdefault(plan_id, 0)
        cumulative_by_plan[plan_id] += int(entry.mortality_birds or 0)

        output.append(
            build_daily_performance_response(
                entry,
                cumulative_mortality_birds=cumulative_by_plan[plan_id],
            )
        )

    return output


@app.post("/api/broilers/performance", response_model=BroilerDailyPerformanceOut)
def create_broiler_performance(
    payload: BroilerDailyPerformanceCreate,
    db: Session = Depends(get_db),
):
    plan = (
        db.query(BroilerPlacementPlan)
        .options(joinedload(BroilerPlacementPlan.farm), joinedload(BroilerPlacementPlan.shed))
        .filter(BroilerPlacementPlan.id == payload.placement_plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(status_code=404, detail="Broiler placement plan not found")

    existing = (
        db.query(BroilerDailyPerformance)
        .filter(
            BroilerDailyPerformance.placement_plan_id == payload.placement_plan_id,
            BroilerDailyPerformance.entry_date == payload.entry_date,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="A performance entry already exists for this cycle and date.",
        )

    data = payload.model_dump()

    if "body_weight_kg" in data:
        data["avg_weight_kg"] = data.pop("body_weight_kg")

    entry = BroilerDailyPerformance(**data)

    recalculate_daily_performance_entry(entry)

    entry.last_saved_at = datetime.utcnow()

    db.add(entry)
    db.commit()
    db.refresh(entry)

    entry = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(BroilerDailyPerformance.placement_plan).joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerDailyPerformance.placement_plan).joinedload(BroilerPlacementPlan.shed),
        )
        .filter(BroilerDailyPerformance.id == entry.id)
        .first()
    )

    return build_daily_performance_response(entry, cumulative_mortality_birds=entry.mortality_birds or 0)


@app.patch("/api/broilers/performance/{entry_id}", response_model=BroilerDailyPerformanceOut)
def update_broiler_performance(
    entry_id: int,
    payload: BroilerDailyPerformancePatch,
    db: Session = Depends(get_db),
):
    entry = (
        db.query(BroilerDailyPerformance)
        .options(
            joinedload(BroilerDailyPerformance.placement_plan).joinedload(BroilerPlacementPlan.farm),
            joinedload(BroilerDailyPerformance.placement_plan).joinedload(BroilerPlacementPlan.shed),
        )
        .filter(BroilerDailyPerformance.id == entry_id)
        .first()
    )

    if not entry:
        raise HTTPException(status_code=404, detail="Broiler performance entry not found")

    data = payload.model_dump(exclude_unset=True)

    if "body_weight_kg" in data:
        data["avg_weight_kg"] = data.pop("body_weight_kg")

    for field, value in data.items():
        setattr(entry, field, value)

    recalculate_daily_performance_entry(entry)

    entry.last_saved_at = datetime.utcnow()

    db.commit()
    db.refresh(entry)

    cumulative_mortality = (
        db.query(BroilerDailyPerformance)
        .filter(
            BroilerDailyPerformance.placement_plan_id == entry.placement_plan_id,
            BroilerDailyPerformance.entry_date <= entry.entry_date,
        )
        .with_entities(BroilerDailyPerformance.mortality_birds)
        .all()
    )

    cumulative_mortality_birds = sum(int(row[0] or 0) for row in cumulative_mortality)

    return build_daily_performance_response(
        entry,
        cumulative_mortality_birds=cumulative_mortality_birds,
    )


@app.delete("/api/broilers/performance/{entry_id}")
def delete_broiler_performance(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(BroilerDailyPerformance).filter(BroilerDailyPerformance.id == entry_id).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Broiler performance entry not found")

    db.delete(entry)
    db.commit()

    return {"deleted": True, "id": entry_id}
    
@app.post("/api/broilers/performance/recalculate-cycle/{placement_plan_id}")
def recalculate_broiler_performance_cycle(
    placement_plan_id: int,
    db: Session = Depends(get_db),
):
    entries = (
        db.query(BroilerDailyPerformance)
        .filter(BroilerDailyPerformance.placement_plan_id == placement_plan_id)
        .order_by(BroilerDailyPerformance.entry_date.asc(), BroilerDailyPerformance.age_days.asc(), BroilerDailyPerformance.id.asc())
        .all()
    )

    if not entries:
        raise HTTPException(status_code=404, detail="No performance entries found for this cycle.")

    previous_closing_birds = None

    for index, entry in enumerate(entries):
        if index > 0 and previous_closing_birds is not None:
            entry.opening_birds = previous_closing_birds

        recalculate_daily_performance_entry(entry)

        previous_closing_birds = entry.closing_birds
        entry.last_saved_at = datetime.utcnow()
        entry.last_saved_by = "System Recalc"

    db.commit()

    return {
        "ok": True,
        "placement_plan_id": placement_plan_id,
        "rows_recalculated": len(entries),
    }