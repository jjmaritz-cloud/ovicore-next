from datetime import timedelta
from decimal import Decimal
from math import ceil


def as_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def build_plan_response(plan):
    farm = plan.farm
    shed = plan.shed

    floor_area = as_float(shed.floor_area_m2)
    density = as_float(plan.target_density_kg_m2 or shed.default_density_kg_m2)
    target_lw = as_float(plan.target_lw_kg or shed.default_target_lw_kg)
    growout_days = plan.growout_days or shed.default_growout_days
    chick_allowance = as_float(plan.chick_allowance_pct or 0)
    planned_birds = plan.planned_birds

    processing_date = None
    if plan.placement_date and growout_days is not None:
        processing_date = plan.placement_date + timedelta(days=int(growout_days))

    calculated_capacity_birds = None
    if floor_area and density and target_lw:
        calculated_capacity_birds = int(floor_area * density / target_lw)

    planned_kg_m2 = None
    if planned_birds and target_lw and floor_area:
        planned_kg_m2 = round((planned_birds * target_lw) / floor_area, 2)

    capacity_variance_birds = None
    capacity_variance_pct = None
    if planned_birds is not None and calculated_capacity_birds:
        capacity_variance_birds = int(planned_birds - calculated_capacity_birds)
        capacity_variance_pct = round((capacity_variance_birds / calculated_capacity_birds) * 100, 2)

    required_chicks = None
    if planned_birds is not None:
        required_chicks = int(ceil(planned_birds * (1 + chick_allowance / 100)))

    review_flag = "Ready"
    if not plan.placement_date or planned_birds in (None, 0):
        review_flag = "Missing data"
    elif planned_kg_m2 is not None and density is not None and planned_kg_m2 > density:
        review_flag = "Review - over density"
    elif capacity_variance_birds is not None and capacity_variance_birds > 0:
        review_flag = "Review - over capacity"

    return {
        "id": plan.id,
        "company_id": plan.company_id,
        "farm_id": plan.farm_id,
        "shed_id": plan.shed_id,
        "farm_name": farm.farm_name,
        "shed_name": shed.shed_name,
        "cycle_code": plan.cycle_code,
        "placement_date": plan.placement_date,
        "processing_date": processing_date,
        "floor_area_m2": floor_area,
        "target_density_kg_m2": density,
        "target_lw_kg": target_lw,
        "calculated_capacity_birds": calculated_capacity_birds,
        "planned_birds": planned_birds,
        "growout_days": growout_days,
        "chick_allowance_pct": chick_allowance,
        "notes": plan.notes,
        "planned_kg_m2": planned_kg_m2,
        "capacity_variance_birds": capacity_variance_birds,
        "capacity_variance_pct": capacity_variance_pct,
        "required_chicks": required_chicks,
        "review_flag": review_flag,
        "status": plan.status,
        "last_saved_by": plan.last_saved_by,
        "last_saved_at": plan.last_saved_at,
    }
