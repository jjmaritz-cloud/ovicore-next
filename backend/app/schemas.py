from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BroilerProcessingBase(BaseModel):
    company_id: int = 1
    broiler_cycle_id: int

    processing_date: Optional[date] = None
    processor: Optional[str] = None
    plant_location: Optional[str] = None

    planned_birds: Optional[int] = None
    actual_birds_processed: Optional[int] = None

    average_live_weight_kg: Optional[float] = None
    total_live_weight_kg: Optional[float] = None

    average_dressed_weight_kg: Optional[float] = None
    total_dressed_weight_kg: Optional[float] = None

    processing_yield_pct: Optional[float] = None

    condemned_birds: Optional[int] = None
    condemnation_pct: Optional[float] = None

    mortality_to_processing: Optional[int] = None

    grade_a_pct: Optional[float] = None
    grade_b_pct: Optional[float] = None

    downgrade_reason: Optional[str] = None
    status: Optional[str] = "Draft"
    notes: Optional[str] = None


class BroilerProcessingCreate(BroilerProcessingBase):
    pass


class BroilerProcessingUpdate(BaseModel):
    processing_date: Optional[date] = None
    processor: Optional[str] = None
    plant_location: Optional[str] = None

    planned_birds: Optional[int] = None
    actual_birds_processed: Optional[int] = None

    average_live_weight_kg: Optional[float] = None
    total_live_weight_kg: Optional[float] = None

    average_dressed_weight_kg: Optional[float] = None
    total_dressed_weight_kg: Optional[float] = None

    processing_yield_pct: Optional[float] = None

    condemned_birds: Optional[int] = None
    condemnation_pct: Optional[float] = None

    mortality_to_processing: Optional[int] = None

    grade_a_pct: Optional[float] = None
    grade_b_pct: Optional[float] = None

    downgrade_reason: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BroilerProcessingOut(BroilerProcessingBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value

# ---------------------------------------------------------------------
# Company / User / Farm Access Foundation
# ---------------------------------------------------------------------


class CompanyCreate(BaseModel):
    company_name: str
    trading_name: Optional[str] = None
    active: bool = True

    # Module enablement controlled by Global Admin / OviCore Admin
    enable_broilers: bool = True
    enable_breeders: bool = False
    enable_layers: bool = False
    enable_hatchery: bool = False
    enable_processing: bool = False


class CompanyPatch(BaseModel):
    company_name: Optional[str] = None
    trading_name: Optional[str] = None
    active: Optional[bool] = None

    # Module enablement controlled by Global Admin / OviCore Admin
    enable_broilers: Optional[bool] = None
    enable_breeders: Optional[bool] = None
    enable_layers: Optional[bool] = None
    enable_hatchery: Optional[bool] = None
    enable_processing: Optional[bool] = None


class CompanyOut(BaseModel):
    id: int
    company_name: str
    trading_name: Optional[str] = None
    active: bool

    enable_broilers: bool = True
    enable_breeders: bool = False
    enable_layers: bool = False
    enable_hatchery: bool = False
    enable_processing: bool = False

    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AppUserCreate(BaseModel):
    company_id: Optional[int] = None

    full_name: str
    email: str

    # Used when Global Admin or Company Admin creates a user.
    temporary_password: str

    is_global_admin: bool = False
    is_company_admin: bool = False

    active: bool = True
    must_change_password: bool = True


class AppUserPatch(BaseModel):
    company_id: Optional[int] = None

    full_name: Optional[str] = None
    email: Optional[str] = None

    is_global_admin: Optional[bool] = None
    is_company_admin: Optional[bool] = None

    active: Optional[bool] = None
    must_change_password: Optional[bool] = None

    # Optional admin password reset.
    temporary_password: Optional[str] = None

class AppUserPasswordReset(BaseModel):
    temporary_password: str
    must_change_password: bool = True

class AppUserOut(BaseModel):
    id: int
    company_id: Optional[int] = None

    full_name: str
    email: str

    is_global_admin: bool
    is_company_admin: bool

    active: bool
    must_change_password: bool

    last_login_at: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserModuleAccessReplace(BaseModel):
    modules: list[str]


class UserModuleAccessOut(BaseModel):
    id: int
    user_id: int
    module: str
    active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserFarmAccessCreate(BaseModel):
    user_id: int
    farm_id: int


class UserFarmAccessOut(BaseModel):
    id: int
    user_id: int
    farm_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FlockCreate(BaseModel):
    company_id: int = 1
    farm_id: int
    shed_id: Optional[int] = None
    flock_code: str
    module: str = "broilers"
    placement_date: Optional[date] = None


class FlockPatch(BaseModel):
    flock_code: Optional[str] = None
    module: Optional[str] = None
    status: Optional[str] = None
    placement_date: Optional[date] = None
    close_date: Optional[date] = None


class FlockClose(BaseModel):
    close_date: date


class FlockOut(BaseModel):
    id: int
    company_id: int
    farm_id: int
    shed_id: Optional[int] = None
    flock_code: str
    module: str
    status: str
    placement_date: Optional[date] = None
    close_date: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

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
    farm_type: str = "broiler"
    active: bool = True


class BroilerFarmPatch(BaseModel):
    farm_name: Optional[str] = None
    farm_code: Optional[str] = None
    farm_type: Optional[str] = None
    active: Optional[bool] = None


class BroilerFarmOut(BaseModel):
    id: int
    company_id: int
    farm_name: str
    farm_code: Optional[str] = None
    farm_type: str = "broiler"
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
        

class BroilerDailyPerformanceCreate(BaseModel):
    company_id: int = 1
    placement_plan_id: int

    entry_date: date
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality_front: Optional[int] = 0
    mortality_middle: Optional[int] = 0
    mortality_back: Optional[int] = 0
    mortality_other: Optional[int] = 0
    mortality_birds: Optional[int] = 0

    cull_legs: Optional[int] = 0
    cull_runts: Optional[int] = 0
    cull_beak: Optional[int] = 0
    cull_other: Optional[int] = 0
    cull_birds: Optional[int] = 0

    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None
    body_weight_kg: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = "JJ"


class BroilerDailyPerformancePatch(BaseModel):
    entry_date: Optional[date] = None
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality_front: Optional[int] = None
    mortality_middle: Optional[int] = None
    mortality_back: Optional[int] = None
    mortality_other: Optional[int] = None
    mortality_birds: Optional[int] = None

    cull_legs: Optional[int] = None
    cull_runts: Optional[int] = None
    cull_beak: Optional[int] = None
    cull_other: Optional[int] = None
    cull_birds: Optional[int] = None

    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None
    body_weight_kg: Optional[float] = None

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

    mortality_front: Optional[int] = 0
    mortality_middle: Optional[int] = 0
    mortality_back: Optional[int] = 0
    mortality_other: Optional[int] = 0
    mortality_birds: Optional[int] = 0

    cull_legs: Optional[int] = 0
    cull_runts: Optional[int] = 0
    cull_beak: Optional[int] = 0
    cull_other: Optional[int] = 0
    cull_birds: Optional[int] = 0

    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None
    body_weight_kg: Optional[float] = None

    daily_mortality_pct: Optional[float] = None
    cumulative_mortality_birds: Optional[int] = None
    cumulative_mortality_pct: Optional[float] = None

    feed_per_bird_g: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AppNoteBase(BaseModel):
    module: str = "broilers"
    page: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    status: str = "Todo"
    source: Optional[str] = None
    category: Optional[str] = "Feature"
    is_done: bool = False


class AppNoteCreate(AppNoteBase):
    pass


class AppNoteUpdate(BaseModel):
    module: Optional[str] = None
    page: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    category: Optional[str] = None
    is_done: Optional[bool] = None


class AppNoteOut(AppNoteBase):
    id: int
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        
class AppNoteCommentBase(BaseModel):
    note_id: int
    author: str = "JJ"
    comment: str


class AppNoteCommentCreate(AppNoteCommentBase):
    pass


class AppNoteCommentOut(AppNoteCommentBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ---------------------------------------------------------------------
# Layer Rearing Flock Register
# ---------------------------------------------------------------------

class LayerRearingFlockCreate(BaseModel):
    company_id: int
    farm_id: int
    shed_id: int

    destination_farm_id: Optional[int] = None
    destination_shed_id: Optional[int] = None

    flock_code: str
    breed: Optional[str] = None

    hatch_date: Optional[date] = None
    placement_date: Optional[date] = None
    birds_placed: Optional[int] = None

    planned_transfer_date: Optional[date] = None

    status: str = "Draft"
    notes: Optional[str] = None


class LayerRearingFlockPatch(BaseModel):
    farm_id: Optional[int] = None
    shed_id: Optional[int] = None

    destination_farm_id: Optional[int] = None
    destination_shed_id: Optional[int] = None

    flock_code: Optional[str] = None
    breed: Optional[str] = None

    hatch_date: Optional[date] = None
    placement_date: Optional[date] = None
    birds_placed: Optional[int] = None

    planned_transfer_date: Optional[date] = None

    status: Optional[str] = None
    notes: Optional[str] = None


class LayerRearingFlockOut(BaseModel):
    id: int
    company_id: int

    farm_id: int
    shed_id: int
    farm_name: str
    shed_name: str

    destination_farm_id: Optional[int] = None
    destination_shed_id: Optional[int] = None
    destination_farm_name: Optional[str] = None
    destination_shed_name: Optional[str] = None

    flock_code: str
    breed: Optional[str] = None

    hatch_date: Optional[date] = None
    placement_date: Optional[date] = None
    birds_placed: Optional[int] = None

    planned_transfer_date: Optional[date] = None

    current_age_weeks: Optional[float] = None
    days_to_transfer: Optional[int] = None
    current_birds: Optional[int] = None
    cumulative_mortality_pct: Optional[float] = None
    bodyweight_variance_pct: Optional[float] = None
    transfer_readiness: str = "Not assessed"

    status: str
    notes: Optional[str] = None

    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------
# Commercial Rearing Daily House Card
# ---------------------------------------------------------------------

class LayerRearingDailyPerformanceCreate(BaseModel):
    company_id: int
    flock_id: int
    entry_date: date
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality_front: Optional[int] = 0
    mortality_middle: Optional[int] = 0
    mortality_back: Optional[int] = 0
    mortality_other: Optional[int] = 0
    mortality_birds: Optional[int] = 0

    cull_legs: Optional[int] = 0
    cull_runts: Optional[int] = 0
    cull_beak: Optional[int] = 0
    cull_other: Optional[int] = 0
    cull_birds: Optional[int] = 0

    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None
    body_weight_kg: Optional[float] = None

    notes: Optional[str] = None


class LayerRearingDailyPerformancePatch(BaseModel):
    entry_date: Optional[date] = None
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality_front: Optional[int] = None
    mortality_middle: Optional[int] = None
    mortality_back: Optional[int] = None
    mortality_other: Optional[int] = None
    mortality_birds: Optional[int] = None

    cull_legs: Optional[int] = None
    cull_runts: Optional[int] = None
    cull_beak: Optional[int] = None
    cull_other: Optional[int] = None
    cull_birds: Optional[int] = None

    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None
    body_weight_kg: Optional[float] = None

    notes: Optional[str] = None


class LayerRearingDailyPerformanceOut(BaseModel):
    id: int
    company_id: int
    flock_id: int

    farm_name: Optional[str] = None
    shed_name: Optional[str] = None
    flock_code: Optional[str] = None
    breed: Optional[str] = None

    entry_date: date
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality_front: int = 0
    mortality_middle: int = 0
    mortality_back: int = 0
    mortality_other: int = 0
    mortality_birds: int = 0

    cull_legs: int = 0
    cull_runts: int = 0
    cull_beak: int = 0
    cull_other: int = 0
    cull_birds: int = 0

    closing_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    avg_weight_kg: Optional[float] = None
    body_weight_kg: Optional[float] = None

    daily_mortality_pct: Optional[float] = None
    cumulative_mortality_birds: Optional[int] = None
    cumulative_mortality_pct: Optional[float] = None
    feed_per_bird_g: Optional[float] = None
    average_daily_gain_g: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
