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
    common_name: Optional[str] = None
    farm_type: str = "broiler"
    region: Optional[str] = None
    farm_manager: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    suburb: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = "Australia"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    time_zone: Optional[str] = "Australia/Sydney"
    total_bird_capacity: Optional[int] = None
    licensed_bird_capacity: Optional[int] = None
    water_source: Optional[str] = None
    water_storage_litres: Optional[int] = None
    power_supply: Optional[str] = None
    backup_generator: Optional[bool] = None
    generator_capacity_kva: Optional[float] = None
    feed_delivery_access: Optional[str] = None
    truck_restrictions: Optional[str] = None
    biosecurity_classification: Optional[str] = None
    shower_in_shower_out: Optional[bool] = None
    visitor_approval_required: Optional[bool] = None
    mortality_disposal_method: Optional[str] = None
    manure_disposal_method: Optional[str] = None
    environmental_licence_number: Optional[str] = None
    free_range_area_ha: Optional[float] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    active: bool = True
    notes: Optional[str] = None


class BroilerFarmPatch(BaseModel):
    farm_name: Optional[str] = None
    farm_code: Optional[str] = None
    common_name: Optional[str] = None
    farm_type: Optional[str] = None
    region: Optional[str] = None
    farm_manager: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    suburb: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    time_zone: Optional[str] = None
    total_bird_capacity: Optional[int] = None
    licensed_bird_capacity: Optional[int] = None
    water_source: Optional[str] = None
    water_storage_litres: Optional[int] = None
    power_supply: Optional[str] = None
    backup_generator: Optional[bool] = None
    generator_capacity_kva: Optional[float] = None
    feed_delivery_access: Optional[str] = None
    truck_restrictions: Optional[str] = None
    biosecurity_classification: Optional[str] = None
    shower_in_shower_out: Optional[bool] = None
    visitor_approval_required: Optional[bool] = None
    mortality_disposal_method: Optional[str] = None
    manure_disposal_method: Optional[str] = None
    environmental_licence_number: Optional[str] = None
    free_range_area_ha: Optional[float] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class BroilerFarmOut(BaseModel):
    id: int
    company_id: int
    farm_name: str
    farm_code: Optional[str] = None
    common_name: Optional[str] = None
    farm_type: str = "broiler"
    region: Optional[str] = None
    farm_manager: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    suburb: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = "Australia"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    time_zone: Optional[str] = "Australia/Sydney"
    total_bird_capacity: Optional[int] = None
    licensed_bird_capacity: Optional[int] = None
    water_source: Optional[str] = None
    water_storage_litres: Optional[int] = None
    power_supply: Optional[str] = None
    backup_generator: Optional[bool] = None
    generator_capacity_kva: Optional[float] = None
    feed_delivery_access: Optional[str] = None
    truck_restrictions: Optional[str] = None
    biosecurity_classification: Optional[str] = None
    shower_in_shower_out: Optional[bool] = None
    visitor_approval_required: Optional[bool] = None
    mortality_disposal_method: Optional[str] = None
    manure_disposal_method: Optional[str] = None
    environmental_licence_number: Optional[str] = None
    free_range_area_ha: Optional[float] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    active: bool = True
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BroilerShedCreate(BaseModel):
    company_id: int = 1
    farm_id: int
    shed_name: str
    shed_code: Optional[str] = None
    shed_type: str = "Broiler"
    housing_system: Optional[str] = None
    capacity_birds: Optional[int] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    floor_area_m2: float = 0
    number_of_levels: Optional[int] = None
    number_of_sections: Optional[int] = None
    ventilation_type: Optional[str] = None
    cooling_system: Optional[str] = None
    heating_system: Optional[str] = None
    lighting_system: Optional[str] = None
    water_system: Optional[str] = None
    feeder_system: Optional[str] = None
    nest_type: Optional[str] = None
    egg_collection_system: Optional[str] = None
    manure_system: Optional[str] = None
    year_commissioned: Optional[int] = None
    male_female_support: Optional[str] = None
    environmental_controller: Optional[str] = None
    controller_id: Optional[str] = None
    water_meter_id: Optional[str] = None
    power_meter_id: Optional[str] = None
    default_density_kg_m2: float = 38
    default_target_lw_kg: float = 2.4
    default_growout_days: int = 42
    active: bool = True
    notes: Optional[str] = None


class BroilerShedPatch(BaseModel):
    farm_id: Optional[int] = None
    shed_name: Optional[str] = None
    shed_code: Optional[str] = None
    shed_type: Optional[str] = None
    housing_system: Optional[str] = None
    capacity_birds: Optional[int] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    floor_area_m2: Optional[float] = None
    number_of_levels: Optional[int] = None
    number_of_sections: Optional[int] = None
    ventilation_type: Optional[str] = None
    cooling_system: Optional[str] = None
    heating_system: Optional[str] = None
    lighting_system: Optional[str] = None
    water_system: Optional[str] = None
    feeder_system: Optional[str] = None
    nest_type: Optional[str] = None
    egg_collection_system: Optional[str] = None
    manure_system: Optional[str] = None
    year_commissioned: Optional[int] = None
    male_female_support: Optional[str] = None
    environmental_controller: Optional[str] = None
    controller_id: Optional[str] = None
    water_meter_id: Optional[str] = None
    power_meter_id: Optional[str] = None
    default_density_kg_m2: Optional[float] = None
    default_target_lw_kg: Optional[float] = None
    default_growout_days: Optional[int] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class BroilerShedOut(BaseModel):
    id: int
    company_id: int
    farm_name: Optional[str] = None
    farm_id: int
    shed_name: str
    shed_code: Optional[str] = None
    shed_type: str = "Broiler"
    housing_system: Optional[str] = None
    capacity_birds: Optional[int] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    floor_area_m2: float = 0
    number_of_levels: Optional[int] = None
    number_of_sections: Optional[int] = None
    ventilation_type: Optional[str] = None
    cooling_system: Optional[str] = None
    heating_system: Optional[str] = None
    lighting_system: Optional[str] = None
    water_system: Optional[str] = None
    feeder_system: Optional[str] = None
    nest_type: Optional[str] = None
    egg_collection_system: Optional[str] = None
    manure_system: Optional[str] = None
    year_commissioned: Optional[int] = None
    male_female_support: Optional[str] = None
    environmental_controller: Optional[str] = None
    controller_id: Optional[str] = None
    water_meter_id: Optional[str] = None
    power_meter_id: Optional[str] = None
    default_density_kg_m2: float = 38
    default_target_lw_kg: float = 2.4
    default_growout_days: int = 42
    active: bool = True
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


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
    actual_transfer_date: Optional[date] = None
    birds_transferred: Optional[int] = None
    transfer_notes: Optional[str] = None
    transferred_by: Optional[str] = None
    transferred_at: Optional[datetime] = None
    commercial_layer_flock_id: Optional[int] = None

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


# ---------------------------------------------------------------------
# Breeder Rearing Flock Register
# ---------------------------------------------------------------------

class BreederRearingFlockCreate(BaseModel):
    company_id: int
    farm_id: int
    shed_id: int
    destination_farm_id: Optional[int] = None
    destination_shed_id: Optional[int] = None
    flock_code: str
    breed: Optional[str] = None
    hatch_date: Optional[date] = None
    placement_date: Optional[date] = None
    female_birds: Optional[int] = None
    male_birds: Optional[int] = None
    planned_transfer_date: Optional[date] = None
    status: str = "Draft"
    notes: Optional[str] = None

class BreederRearingFlockPatch(BaseModel):
    farm_id: Optional[int] = None
    shed_id: Optional[int] = None
    destination_farm_id: Optional[int] = None
    destination_shed_id: Optional[int] = None
    flock_code: Optional[str] = None
    breed: Optional[str] = None
    hatch_date: Optional[date] = None
    placement_date: Optional[date] = None
    female_birds: Optional[int] = None
    male_birds: Optional[int] = None
    planned_transfer_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class BreederRearingFlockOut(BaseModel):
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
    female_birds: Optional[int] = None
    male_birds: Optional[int] = None
    total_birds: Optional[int] = None
    male_ratio_pct: Optional[float] = None
    planned_transfer_date: Optional[date] = None
    actual_transfer_date: Optional[date] = None
    females_transferred: Optional[int] = None
    males_transferred: Optional[int] = None
    transfer_notes: Optional[str] = None
    transferred_by: Optional[str] = None
    transferred_at: Optional[datetime] = None
    production_flock_id: Optional[int] = None

    current_age_weeks: Optional[float] = None
    days_to_transfer: Optional[int] = None
    status: str
    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------
# Breeder Rearing Transfer / Breeder Production
# ---------------------------------------------------------------------

class BreederRearingTransferCreate(BaseModel):
    actual_transfer_date: date
    destination_farm_id: int
    destination_shed_id: int
    females_transferred: int
    males_transferred: int
    transfer_notes: Optional[str] = None


class BreederProductionFlockOut(BaseModel):
    id: int
    company_id: int
    source_rearing_flock_id: int

    farm_id: int
    shed_id: int
    farm_name: str
    shed_name: str

    flock_code: str
    breed: Optional[str] = None
    hatch_date: Optional[date] = None
    transfer_date: date

    opening_female_birds: int
    opening_male_birds: int
    total_opening_birds: int
    male_ratio_pct: Optional[float] = None

    status: str
    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BreederTransferResult(BaseModel):
    rearing_flock: BreederRearingFlockOut
    production_flock: BreederProductionFlockOut


# ---------------------------------------------------------------------
# Breeder Production Daily House Card
# ---------------------------------------------------------------------

class BreederProductionDailyPerformanceCreate(BaseModel):
    company_id: int
    flock_id: int
    entry_date: date
    age_days: Optional[int] = None

    opening_female_birds: Optional[int] = None
    female_mortality: int = 0
    female_culls: int = 0
    closing_female_birds: Optional[int] = None

    opening_male_birds: Optional[int] = None
    male_mortality: int = 0
    male_culls: int = 0
    closing_male_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    female_bodyweight_kg: Optional[float] = None
    male_bodyweight_kg: Optional[float] = None

    total_eggs: int = 0
    hatching_eggs: int = 0
    floor_eggs: int = 0
    rejects: int = 0

    production_standard_pct: Optional[float] = None
    notes: Optional[str] = None


class BreederProductionDailyPerformancePatch(BaseModel):
    entry_date: Optional[date] = None
    age_days: Optional[int] = None

    opening_female_birds: Optional[int] = None
    female_mortality: Optional[int] = None
    female_culls: Optional[int] = None
    closing_female_birds: Optional[int] = None

    opening_male_birds: Optional[int] = None
    male_mortality: Optional[int] = None
    male_culls: Optional[int] = None
    closing_male_birds: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    female_bodyweight_kg: Optional[float] = None
    male_bodyweight_kg: Optional[float] = None

    total_eggs: Optional[int] = None
    hatching_eggs: Optional[int] = None
    floor_eggs: Optional[int] = None
    rejects: Optional[int] = None

    production_standard_pct: Optional[float] = None
    notes: Optional[str] = None


class BreederProductionDailyPerformanceOut(BaseModel):
    id: int
    company_id: int
    flock_id: int

    farm_name: str
    shed_name: str
    flock_code: str
    breed: Optional[str] = None

    entry_date: date
    age_days: Optional[int] = None

    opening_female_birds: Optional[int] = None
    female_mortality: int = 0
    female_culls: int = 0
    closing_female_birds: Optional[int] = None

    opening_male_birds: Optional[int] = None
    male_mortality: int = 0
    male_culls: int = 0
    closing_male_birds: Optional[int] = None

    total_closing_birds: Optional[int] = None
    male_ratio_pct: Optional[float] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    feed_per_bird_g: Optional[float] = None

    female_bodyweight_kg: Optional[float] = None
    male_bodyweight_kg: Optional[float] = None

    total_eggs: int = 0
    hatching_eggs: int = 0
    floor_eggs: int = 0
    rejects: int = 0

    production_pct: Optional[float] = None
    production_standard_pct: Optional[float] = None
    production_variance_pct: Optional[float] = None
    hatching_egg_pct: Optional[float] = None
    floor_egg_pct: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------
# Commercial Layers
# ---------------------------------------------------------------------

class CommercialLayerFlockCreate(BaseModel):
    company_id: int
    farm_id: int
    shed_id: int

    flock_code: str
    breed: Optional[str] = None

    hatch_date: Optional[date] = None
    housed_date: Optional[date] = None
    birds_housed: Optional[int] = None
    planned_depletion_date: Optional[date] = None

    status: str = "Draft"
    notes: Optional[str] = None


class CommercialLayerFlockPatch(BaseModel):
    farm_id: Optional[int] = None
    shed_id: Optional[int] = None

    flock_code: Optional[str] = None
    breed: Optional[str] = None

    hatch_date: Optional[date] = None
    housed_date: Optional[date] = None
    birds_housed: Optional[int] = None
    planned_depletion_date: Optional[date] = None

    status: Optional[str] = None
    notes: Optional[str] = None


class CommercialLayerFlockOut(BaseModel):
    id: int
    source_rearing_flock_id: Optional[int] = None
    source_rearing_flock_code: Optional[str] = None

    company_id: int
    farm_id: int
    shed_id: int

    farm_name: str
    shed_name: str

    flock_code: str
    breed: Optional[str] = None

    hatch_date: Optional[date] = None
    housed_date: Optional[date] = None
    birds_housed: Optional[int] = None
    planned_depletion_date: Optional[date] = None

    current_age_weeks: Optional[float] = None
    current_birds: Optional[int] = None
    latest_production_pct: Optional[float] = None
    latest_feed_g_bird_day: Optional[float] = None
    cumulative_mortality_pct: Optional[float] = None
    production_status: str = "Not started"

    status: str
    notes: Optional[str] = None

    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CommercialLayerDailyPerformanceCreate(BaseModel):
    company_id: int
    flock_id: int
    entry_date: date
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality: int = 0
    culls: int = 0

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    bodyweight_kg: Optional[float] = None
    egg_weight_g: Optional[float] = None

    total_eggs: int = 0
    saleable_eggs: int = 0
    seconds: int = 0
    cracks: int = 0
    rejects: int = 0

    production_standard_pct: Optional[float] = None
    mortality_standard_pct: Optional[float] = None
    egg_weight_standard_g: Optional[float] = None
    feed_standard_g_bird_day: Optional[float] = None
    eggs_per_bird_standard: Optional[float] = None
    bodyweight_standard_g: Optional[float] = None

    notes: Optional[str] = None


class CommercialLayerDailyPerformancePatch(BaseModel):
    entry_date: Optional[date] = None
    age_days: Optional[int] = None

    opening_birds: Optional[int] = None

    mortality: Optional[int] = None
    culls: Optional[int] = None

    feed_kg: Optional[float] = None
    water_litres: Optional[float] = None
    bodyweight_kg: Optional[float] = None
    egg_weight_g: Optional[float] = None

    total_eggs: Optional[int] = None
    saleable_eggs: Optional[int] = None
    seconds: Optional[int] = None
    cracks: Optional[int] = None
    rejects: Optional[int] = None

    production_standard_pct: Optional[float] = None
    mortality_standard_pct: Optional[float] = None
    egg_weight_standard_g: Optional[float] = None
    feed_standard_g_bird_day: Optional[float] = None
    eggs_per_bird_standard: Optional[float] = None
    bodyweight_standard_g: Optional[float] = None

    notes: Optional[str] = None


class CommercialLayerPerformanceOut(BaseModel):
    id: int
    company_id: int
    flock_id: int

    farm_name: str
    shed_name: str
    flock_code: str
    breed: Optional[str] = None

    entry_date: date
    age_days: Optional[int] = None
    age_weeks: Optional[float] = None

    opening_birds: Optional[int] = None

    mortality: int = 0
    culls: int = 0

    mortality_birds: int = 0
    cull_birds: int = 0
    closing_birds: Optional[int] = None

    total_eggs: int = 0
    saleable_eggs: int = 0
    seconds: int = 0
    cracks: int = 0
    rejects: int = 0

    production_pct: Optional[float] = None
    cumulative_mortality_pct: Optional[float] = None
    egg_weight_g: Optional[float] = None
    feed_g_bird_day: Optional[float] = None
    eggs_per_bird_cumulative: Optional[float] = None
    bodyweight_g: Optional[float] = None

    saleable_pct: Optional[float] = None
    feed_per_dozen_kg: Optional[float] = None

    production_standard_pct: Optional[float] = None
    production_variance_pct: Optional[float] = None
    mortality_standard_pct: Optional[float] = None
    egg_weight_standard_g: Optional[float] = None
    feed_standard_g_bird_day: Optional[float] = None
    eggs_per_bird_standard: Optional[float] = None
    bodyweight_standard_g: Optional[float] = None

    notes: Optional[str] = None
    last_saved_by: Optional[str] = None
    last_saved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LayerRearingTransferCreate(BaseModel):
    actual_transfer_date: date
    destination_farm_id: int
    destination_shed_id: int
    birds_transferred: int
    transfer_notes: Optional[str] = None


class LayerRearingTransferResult(BaseModel):
    rearing_flock: LayerRearingFlockOut
    commercial_layer_flock: CommercialLayerFlockOut
