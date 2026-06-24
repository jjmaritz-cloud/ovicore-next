from datetime import date
from sqlalchemy.orm import Session
from .models import BroilerFarm, BroilerShed, BroilerPlacementPlan


def seed_demo_data(db: Session):
    existing = db.query(BroilerFarm).filter(BroilerFarm.company_id == 1).first()
    if existing:
        return

    farm1 = BroilerFarm(company_id=1, farm_name="Broiler Farm 1", farm_code="BF1")
    farm2 = BroilerFarm(company_id=1, farm_name="Broiler Farm 2", farm_code="BF2")
    db.add_all([farm1, farm2])
    db.flush()

    sheds = [
        BroilerShed(company_id=1, farm_id=farm1.id, shed_name="Shed 01", shed_code="S01", floor_area_m2=2000, default_density_kg_m2=38, default_target_lw_kg=2.40, default_growout_days=42),
        BroilerShed(company_id=1, farm_id=farm1.id, shed_name="Shed 02", shed_code="S02", floor_area_m2=2100, default_density_kg_m2=38, default_target_lw_kg=2.40, default_growout_days=42),
        BroilerShed(company_id=1, farm_id=farm1.id, shed_name="Shed 03", shed_code="S03", floor_area_m2=1850, default_density_kg_m2=38, default_target_lw_kg=2.45, default_growout_days=42),
        BroilerShed(company_id=1, farm_id=farm1.id, shed_name="Shed 04", shed_code="S04", floor_area_m2=2250, default_density_kg_m2=38, default_target_lw_kg=2.40, default_growout_days=42),
        BroilerShed(company_id=1, farm_id=farm2.id, shed_name="Shed 01", shed_code="S01", floor_area_m2=1950, default_density_kg_m2=38, default_target_lw_kg=2.40, default_growout_days=42),
        BroilerShed(company_id=1, farm_id=farm2.id, shed_name="Shed 02", shed_code="S02", floor_area_m2=2050, default_density_kg_m2=38, default_target_lw_kg=2.40, default_growout_days=42),
    ]
    db.add_all(sheds)
    db.flush()

    plans = [
        BroilerPlacementPlan(company_id=1, farm_id=farm1.id, shed_id=sheds[0].id, cycle_code="BR-2026-001", placement_date=date(2026, 6, 22), planned_birds=31500, target_density_kg_m2=38, target_lw_kg=2.40, growout_days=42, chick_allowance_pct=1.5, notes="First placement plan row", status="Draft", last_saved_by="Seed"),
        BroilerPlacementPlan(company_id=1, farm_id=farm1.id, shed_id=sheds[1].id, cycle_code="BR-2026-002", placement_date=date(2026, 6, 23), planned_birds=33000, target_density_kg_m2=38, target_lw_kg=2.40, growout_days=42, chick_allowance_pct=1.5, notes="", status="Draft", last_saved_by="Seed"),
        BroilerPlacementPlan(company_id=1, farm_id=farm1.id, shed_id=sheds[2].id, cycle_code="BR-2026-003", placement_date=date(2026, 6, 24), planned_birds=30000, target_density_kg_m2=38, target_lw_kg=2.45, growout_days=42, chick_allowance_pct=1.5, notes="Check density", status="Draft", last_saved_by="Seed"),
        BroilerPlacementPlan(company_id=1, farm_id=farm1.id, shed_id=sheds[3].id, cycle_code="BR-2026-004", placement_date=date(2026, 6, 25), planned_birds=35600, target_density_kg_m2=38, target_lw_kg=2.40, growout_days=42, chick_allowance_pct=1.5, notes="", status="Draft", last_saved_by="Seed"),
        BroilerPlacementPlan(company_id=1, farm_id=farm2.id, shed_id=sheds[4].id, cycle_code="BR-2026-005", placement_date=date(2026, 6, 29), planned_birds=30500, target_density_kg_m2=38, target_lw_kg=2.40, growout_days=42, chick_allowance_pct=1.5, notes="", status="Draft", last_saved_by="Seed"),
        BroilerPlacementPlan(company_id=1, farm_id=farm2.id, shed_id=sheds[5].id, cycle_code="BR-2026-006", placement_date=date(2026, 6, 30), planned_birds=33500, target_density_kg_m2=38, target_lw_kg=2.40, growout_days=42, chick_allowance_pct=1.5, notes="Slightly over capacity for review", status="Draft", last_saved_by="Seed"),
    ]
    db.add_all(plans)
    db.commit()
