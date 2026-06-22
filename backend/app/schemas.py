from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


class BroilerDemandPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    farm_id: int
    shed_id: int
    farm_name: str
    shed_name: str
    cycle_code: Optional[str] = None
    placement_date: Optional[date] = None
    processing_date: Optional[date] = None

    floor_area_m2: float
    target_density_kg_m2: Optional[float] = None
    target_lw_kg: Optional[float] = None
    calculated_capacity_birds: Optional[int] = None

    planned_birds: Optional[int] = None
    growout_days: Optional[int] = None
    chick_allowance_pct: Optional[float] = None
    notes: Optional[str] = None

    planned_kg_m2: Optional[float] = None
    capacity_variance_birds: Optional[int] = None
    capacity_variance_pct: Optional[float] = None
    required_chicks: Optional[int] = None
    review_flag: str

    status: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None


class BroilerDemandPlanPatch(BaseModel):
    placement_date: Optional[date] = None
    planned_birds: Optional[int] = None
    target_density_kg_m2: Optional[float] = None
    target_lw_kg: Optional[float] = None
    growout_days: Optional[int] = None
    chick_allowance_pct: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    last_saved_by: Optional[str] = "JJ"


class BroilerDemandPlanCreate(BaseModel):
    company_id: int = 1
    farm_id: int
    shed_id: int
    cycle_code: Optional[str] = None
    placement_date: Optional[date] = None
    planned_birds: Optional[int] = None
    target_density_kg_m2: Optional[float] = None
    target_lw_kg: Optional[float] = None
    growout_days: Optional[int] = None
    chick_allowance_pct: Optional[float] = 0
    notes: Optional[str] = None
    status: Optional[str] = "Draft"
    last_saved_by: Optional[str] = "JJ"

class BroilerFarmCreate(BaseModel):
    company_id: int = 1
    farm_name: str
    farm_code: Optional[str] = None
    active: bool = True


class BroilerFarmPatch(BaseModel):
    farm_name: Optional[str] = None
    farm_code: Optional[str] = None
    active: Optional[bool] = None


class BroilerFarmOut(BaseModel):
    id: int
    company_id: int
    farm_name: str
    farm_code: Optional[str] = None
    active: bool

    class Config:
        from_attributes = True


class BroilerShedCreate(BaseModel):
    company_id: int = 1
    farm_id: int
    shed_name: str
    shed_code: Optional[str] = None
    floor_area_m2: float
    default_density_kg_m2: float = 38
    default_target_lw_kg: float = 2.4
    default_growout_days: int = 42
    active: bool = True


class BroilerShedPatch(BaseModel):
    farm_id: Optional[int] = None
    shed_name: Optional[str] = None
    shed_code: Optional[str] = None
    floor_area_m2: Optional[float] = None
    default_density_kg_m2: Optional[float] = None
    default_target_lw_kg: Optional[float] = None
    default_growout_days: Optional[int] = None
    active: Optional[bool] = None


class BroilerShedOut(BaseModel):
    id: int
    company_id: int
    farm_id: int
    farm_name: Optional[str] = None
    shed_name: str
    shed_code: Optional[str] = None
    floor_area_m2: float
    default_density_kg_m2: float
    default_target_lw_kg: float
    default_growout_days: int
    active: bool

    class Config:
        from_attributes = True
        
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class BroilerDailyPerformanceCreate(BaseModel):
    company_id: int = 1
    placement_plan_id: int

    entry_date: date
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None
    mortality_birds: int = 0
    cull_birds: int = 0
    closing_birds: Optional[int] = None

    feed_kg: float = 0
    water_litres: float = 0
    avg_weight_kg: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = "JJ"


class BroilerDailyPerformancePatch(BaseModel):
    entry_date: Optional[date] = None
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None
    mortality_birds: Optional[int] = None
    cull_birds: Optional[int] = None
    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = None


class BroilerDailyPerformanceOut(BaseModel):
    id: int
    company_id: int
    placement_plan_id: int

    farm_name: Optional[str] = None
    shed_name: Optional[str] = None
    cycle_code: Optional[str] = None

    entry_date: date
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None
    mortality_birds: int = 0
    cull_birds: int = 0
    closing_birds: Optional[int] = None

    feed_kg: float = 0
    water_litres: float = 0
    avg_weight_kg: Optional[float] = None

    daily_mortality_pct: Optional[float] = None
    cumulative_mortality_birds: Optional[int] = None
    cumulative_mortality_pct: Optional[float] = None

    feed_per_bird_g: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    class Config:
        from_attributes = True