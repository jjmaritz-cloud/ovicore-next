from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship
from .db import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, unique=True, index=True)
    trading_name = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=False, default=True)

    # Module enablement controlled by Global Admin / OviCore Admin
    enable_broilers = Column(Boolean, nullable=False, default=True)
    enable_breeders = Column(Boolean, nullable=False, default=False)
    enable_layers = Column(Boolean, nullable=False, default=False)
    enable_hatchery = Column(Boolean, nullable=False, default=False)
    enable_processing = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, server_default=func.now())

    users = relationship("AppUser", back_populates="company")
    broiler_farms = relationship("BroilerFarm", back_populates="company")


class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=True,
        index=True,
    )

    full_name = Column(String(255), nullable=False)

    email = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    # Login and password security
    password_hash = Column(String(255), nullable=True)

    must_change_password = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    password_changed_at = Column(
        DateTime,
        nullable=True,
    )

    last_login_at = Column(
        DateTime,
        nullable=True,
    )

    # Access roles
    is_global_admin = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_company_admin = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship(
        "Company",
        back_populates="users",
    )

    farm_access = relationship(
        "UserFarmAccess",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    module_access = relationship(
        "UserModuleAccess",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserModuleAccess(Base):
    __tablename__ = "user_module_access"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("app_users.id"),
        nullable=False,
        index=True,
    )
    module = Column(String(50), nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("AppUser", back_populates="module_access")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "module",
            name="uq_user_module_access",
        ),
    )


class UserFarmAccess(Base):
    __tablename__ = "user_farm_access"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False, index=True)

    created_at = Column(DateTime, server_default=func.now())

    user = relationship("AppUser", back_populates="farm_access")
    farm = relationship("BroilerFarm", back_populates="user_access")

    __table_args__ = (
        UniqueConstraint("user_id", "farm_id", name="uq_user_farm_access"),
    )

class BroilerFarm(Base):
    __tablename__ = "broiler_farms"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    farm_name = Column(Text, nullable=False)
    farm_code = Column(Text)
    common_name = Column(Text)
    farm_type = Column(
        String(50),
        nullable=False,
        default="broiler",
        server_default="broiler",
        index=True,
    )
    region = Column(Text)
    farm_manager = Column(Text)
    address_line_1 = Column(Text)
    address_line_2 = Column(Text)
    suburb = Column(Text)
    state = Column(String(80))
    postcode = Column(String(20))
    country = Column(String(80), default="Australia")
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    time_zone = Column(String(100), default="Australia/Sydney")
    total_bird_capacity = Column(Integer)
    licensed_bird_capacity = Column(Integer)
    water_source = Column(Text)
    water_storage_litres = Column(Integer)
    power_supply = Column(Text)
    backup_generator = Column(Boolean)
    generator_capacity_kva = Column(Numeric(10, 2))
    feed_delivery_access = Column(Text)
    truck_restrictions = Column(Text)
    biosecurity_classification = Column(String(80))
    shower_in_shower_out = Column(Boolean)
    visitor_approval_required = Column(Boolean)
    mortality_disposal_method = Column(Text)
    manure_disposal_method = Column(Text)
    environmental_licence_number = Column(Text)
    free_range_area_ha = Column(Numeric(10, 2))
    emergency_contact = Column(Text)
    emergency_phone = Column(Text)
    notes = Column(Text)

    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    company = relationship("Company", back_populates="broiler_farms")
    sheds = relationship("BroilerShed", back_populates="farm")
    user_access = relationship(
        "UserFarmAccess",
        back_populates="farm",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("company_id", "farm_name", name="uq_company_broiler_farm_name"),
        UniqueConstraint("company_id", "farm_code", name="uq_company_broiler_farm_code"),
    )


class BroilerShed(Base):
    __tablename__ = "broiler_sheds"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False, index=True)

    shed_name = Column(Text, nullable=False)
    shed_code = Column(Text)
    shed_type = Column(String(80), nullable=False, default="Broiler")
    housing_system = Column(String(80))
    capacity_birds = Column(Integer)
    length_m = Column(Numeric(10, 2))
    width_m = Column(Numeric(10, 2))
    floor_area_m2 = Column(Numeric(10, 2), nullable=False)
    number_of_levels = Column(Integer)
    number_of_sections = Column(Integer)
    ventilation_type = Column(Text)
    cooling_system = Column(Text)
    heating_system = Column(Text)
    lighting_system = Column(Text)
    water_system = Column(Text)
    feeder_system = Column(Text)
    nest_type = Column(Text)
    egg_collection_system = Column(Text)
    manure_system = Column(Text)
    year_commissioned = Column(Integer)
    male_female_support = Column(String(80))
    environmental_controller = Column(Text)
    controller_id = Column(Text)
    water_meter_id = Column(Text)
    power_meter_id = Column(Text)
    notes = Column(Text)

    # Existing broiler planning defaults remain supported.
    default_density_kg_m2 = Column(Numeric(6, 2), nullable=False, default=38.00)
    default_target_lw_kg = Column(Numeric(6, 2), nullable=False, default=2.40)
    default_growout_days = Column(Integer, nullable=False, default=42)

    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    farm = relationship("BroilerFarm", back_populates="sheds")
    plans = relationship("BroilerPlacementPlan", back_populates="shed")

    __table_args__ = (
        UniqueConstraint("farm_id", "shed_code", name="uq_farm_shed_code"),
    )


from sqlalchemy import Column, Integer, String, Float, Date, Text, ForeignKey
from sqlalchemy.orm import relationship

# Existing imports above should already include Base

class Flock(Base):
    __tablename__ = "flocks"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False, index=True)
    shed_id = Column(Integer, ForeignKey("broiler_sheds.id"), nullable=True, index=True)

    flock_code = Column(String(120), nullable=False)
    module = Column(String(50), nullable=False, default="broilers")

    status = Column(String(40), nullable=False, default="Open")

    placement_date = Column(Date, nullable=True)
    close_date = Column(Date, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    farm = relationship("BroilerFarm")
    shed = relationship("BroilerShed")

    __table_args__ = (
        UniqueConstraint("company_id", "flock_code", name="uq_company_flock_code"),
    )

class BroilerProcessing(Base):
    __tablename__ = "broiler_processing"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    broiler_cycle_id = Column(Integer, nullable=False)

    processing_date = Column(Date, nullable=True)
    processor = Column(String, nullable=True)
    plant_location = Column(String, nullable=True)

    planned_birds = Column(Integer, nullable=True)
    actual_birds_processed = Column(Integer, nullable=True)

    average_live_weight_kg = Column(Float, nullable=True)
    total_live_weight_kg = Column(Float, nullable=True)

    average_dressed_weight_kg = Column(Float, nullable=True)
    total_dressed_weight_kg = Column(Float, nullable=True)

    processing_yield_pct = Column(Float, nullable=True)

    condemned_birds = Column(Integer, nullable=True)
    condemnation_pct = Column(Float, nullable=True)

    mortality_to_processing = Column(Integer, nullable=True)

    grade_a_pct = Column(Float, nullable=True)
    grade_b_pct = Column(Float, nullable=True)

    downgrade_reason = Column(String, nullable=True)
    status = Column(String, default="Draft")
    notes = Column(Text, nullable=True)

class BroilerPlacementPlan(Base):
    __tablename__ = "broiler_placement_plans"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False)
    shed_id = Column(Integer, ForeignKey("broiler_sheds.id"), nullable=False)

    cycle_code = Column(Text)
    placement_date = Column(Date)
    planned_birds = Column(Integer)
    target_density_kg_m2 = Column(Numeric(6, 2))
    target_lw_kg = Column(Numeric(6, 2))
    growout_days = Column(Integer)
    chick_allowance_pct = Column(Numeric(6, 2), default=0)
    notes = Column(Text)
    status = Column(String(40), default="Draft")
    last_saved_by = Column(Text)
    last_saved_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())

    farm = relationship("BroilerFarm")
    shed = relationship("BroilerShed", back_populates="plans")
    
class BroilerDailyPerformance(Base):
    __tablename__ = "broiler_daily_performance"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    placement_plan_id = Column(Integer, ForeignKey("broiler_placement_plans.id"), nullable=False)

    entry_date = Column(Date, nullable=False)
    age_days = Column(Integer)

    opening_birds = Column(Integer)
    mortality_birds = Column(Integer, default=0)
    mortality_front = Column(Integer, default=0)
    mortality_middle = Column(Integer, default=0)
    mortality_back = Column(Integer, default=0)
    mortality_other = Column(Integer, default=0)

    cull_legs = Column(Integer, default=0)
    cull_runts = Column(Integer, default=0)
    cull_beak = Column(Integer, default=0)
    cull_other = Column(Integer, default=0)
    cull_birds = Column(Integer, default=0)
    closing_birds = Column(Integer)

    feed_kg = Column(Numeric(12, 2), default=0)
    water_litres = Column(Numeric(12, 2), default=0)
    avg_weight_kg = Column(Numeric(8, 3))

    notes = Column(Text)
    last_saved_by = Column(Text)
    last_saved_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())

    placement_plan = relationship("BroilerPlacementPlan")

class AppNote(Base):
    __tablename__ = "app_notes"

    id = Column(Integer, primary_key=True, index=True)

    module = Column(String(50), nullable=False, default="broilers")
    page = Column(String(100), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    priority = Column(String(30), nullable=False, default="Medium")
    status = Column(String(30), nullable=False, default="Todo")

    source = Column(String(100), nullable=True)  # JJ, Cornelius, Adam, etc.
    category = Column(String(80), nullable=True)  # Feature, Bug, Terminology, Review

    is_done = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
class AppNoteComment(Base):
    __tablename__ = "app_note_comments"

    id = Column(Integer, primary_key=True, index=True)

    note_id = Column(Integer, nullable=False)
    author = Column(String(100), nullable=False, default="JJ")
    comment = Column(Text, nullable=False)

    created_at = Column(DateTime, server_default=func.now())

class LayerRearingFlock(Base):
    __tablename__ = "layer_rearing_flocks"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    farm_id = Column(
        Integer,
        ForeignKey("broiler_farms.id"),
        nullable=False,
        index=True,
    )
    shed_id = Column(
        Integer,
        ForeignKey("broiler_sheds.id"),
        nullable=False,
        index=True,
    )

    destination_farm_id = Column(
        Integer,
        ForeignKey("broiler_farms.id"),
        nullable=True,
        index=True,
    )
    destination_shed_id = Column(
        Integer,
        ForeignKey("broiler_sheds.id"),
        nullable=True,
        index=True,
    )

    flock_code = Column(String(120), nullable=False)
    breed = Column(String(120), nullable=True)

    hatch_date = Column(Date, nullable=True)
    placement_date = Column(Date, nullable=True)
    birds_placed = Column(Integer, nullable=True)

    planned_transfer_date = Column(Date, nullable=True)

    actual_transfer_date = Column(Date, nullable=True)
    birds_transferred = Column(Integer, nullable=True)
    transfer_notes = Column(Text, nullable=True)
    transferred_by = Column(String(255), nullable=True)
    transferred_at = Column(DateTime, nullable=True)

    status = Column(String(40), nullable=False, default="Draft")
    notes = Column(Text, nullable=True)

    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    farm = relationship(
        "BroilerFarm",
        foreign_keys=[farm_id],
    )
    shed = relationship(
        "BroilerShed",
        foreign_keys=[shed_id],
    )
    destination_farm = relationship(
        "BroilerFarm",
        foreign_keys=[destination_farm_id],
    )
    destination_shed = relationship(
        "BroilerShed",
        foreign_keys=[destination_shed_id],
    )

    daily_performance = relationship(
        "LayerRearingDailyPerformance",
        back_populates="flock",
        cascade="all, delete-orphan",
    )
    commercial_layer_flock = relationship(
        "CommercialLayerFlock",
        back_populates="source_rearing_flock",
        uselist=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "flock_code",
            name="uq_company_layer_rearing_flock_code",
        ),
    )


class LayerRearingDailyPerformance(Base):
    __tablename__ = "layer_rearing_daily_performance"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    flock_id = Column(
        Integer,
        ForeignKey("layer_rearing_flocks.id"),
        nullable=False,
        index=True,
    )

    entry_date = Column(Date, nullable=False)
    age_days = Column(Integer, nullable=True)

    opening_birds = Column(Integer, nullable=True)

    mortality_front = Column(Integer, nullable=False, default=0)
    mortality_middle = Column(Integer, nullable=False, default=0)
    mortality_back = Column(Integer, nullable=False, default=0)
    mortality_other = Column(Integer, nullable=False, default=0)
    mortality_birds = Column(Integer, nullable=False, default=0)

    cull_legs = Column(Integer, nullable=False, default=0)
    cull_runts = Column(Integer, nullable=False, default=0)
    cull_beak = Column(Integer, nullable=False, default=0)
    cull_other = Column(Integer, nullable=False, default=0)
    cull_birds = Column(Integer, nullable=False, default=0)

    closing_birds = Column(Integer, nullable=True)

    feed_kg = Column(Numeric(12, 2), nullable=True)
    water_litres = Column(Numeric(12, 2), nullable=True)
    avg_weight_kg = Column(Numeric(8, 3), nullable=True)

    notes = Column(Text, nullable=True)

    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    flock = relationship(
        "LayerRearingFlock",
        back_populates="daily_performance",
    )

    __table_args__ = (
        UniqueConstraint(
            "flock_id",
            "entry_date",
            name="uq_layer_rearing_flock_entry_date",
        ),
    )


class BreederRearingFlock(Base):
    __tablename__ = "breeder_rearing_flocks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False, index=True)
    shed_id = Column(Integer, ForeignKey("broiler_sheds.id"), nullable=False, index=True)
    destination_farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=True, index=True)
    destination_shed_id = Column(Integer, ForeignKey("broiler_sheds.id"), nullable=True, index=True)
    flock_code = Column(String(120), nullable=False)
    breed = Column(String(120), nullable=True)
    hatch_date = Column(Date, nullable=True)
    placement_date = Column(Date, nullable=True)
    female_birds = Column(Integer, nullable=True)
    male_birds = Column(Integer, nullable=True)
    planned_transfer_date = Column(Date, nullable=True)

    actual_transfer_date = Column(Date, nullable=True)
    females_transferred = Column(Integer, nullable=True)
    males_transferred = Column(Integer, nullable=True)
    transfer_notes = Column(Text, nullable=True)
    transferred_by = Column(String(255), nullable=True)
    transferred_at = Column(DateTime, nullable=True)

    status = Column(String(40), nullable=False, default="Draft")
    notes = Column(Text, nullable=True)
    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())

    farm = relationship("BroilerFarm", foreign_keys=[farm_id])
    shed = relationship("BroilerShed", foreign_keys=[shed_id])
    destination_farm = relationship("BroilerFarm", foreign_keys=[destination_farm_id])
    destination_shed = relationship("BroilerShed", foreign_keys=[destination_shed_id])
    production_flock = relationship(
        "BreederProductionFlock",
        back_populates="source_rearing_flock",
        uselist=False,
    )
    daily_performance = relationship(
        "BreederRearingDailyPerformance",
        back_populates="flock",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("company_id", "flock_code", name="uq_company_breeder_rearing_flock_code"),
    )


class BreederRearingDailyPerformance(Base):
    __tablename__ = "breeder_rearing_daily_performance"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    flock_id = Column(Integer, ForeignKey("breeder_rearing_flocks.id"), nullable=False, index=True)

    entry_date = Column(Date, nullable=False)
    age_days = Column(Integer, nullable=True)

    opening_female_birds = Column(Integer, nullable=True)
    female_mortality = Column(Integer, nullable=False, default=0)
    female_culls = Column(Integer, nullable=False, default=0)
    closing_female_birds = Column(Integer, nullable=True)

    opening_male_birds = Column(Integer, nullable=True)
    male_mortality = Column(Integer, nullable=False, default=0)
    male_culls = Column(Integer, nullable=False, default=0)
    closing_male_birds = Column(Integer, nullable=True)

    feed_kg = Column(Numeric(12, 2), nullable=True)
    water_litres = Column(Numeric(12, 2), nullable=True)
    female_bodyweight_kg = Column(Numeric(8, 3), nullable=True)
    male_bodyweight_kg = Column(Numeric(8, 3), nullable=True)

    notes = Column(Text, nullable=True)
    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())

    flock = relationship("BreederRearingFlock", back_populates="daily_performance")

    __table_args__ = (
        UniqueConstraint(
            "flock_id",
            "entry_date",
            name="uq_breeder_rearing_flock_entry_date",
        ),
    )


class BreederProductionFlock(Base):
    __tablename__ = "breeder_production_flocks"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    source_rearing_flock_id = Column(
        Integer,
        ForeignKey("breeder_rearing_flocks.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False, index=True)
    shed_id = Column(Integer, ForeignKey("broiler_sheds.id"), nullable=False, index=True)

    flock_code = Column(String(120), nullable=False)
    breed = Column(String(120), nullable=True)
    hatch_date = Column(Date, nullable=True)
    transfer_date = Column(Date, nullable=False)

    opening_female_birds = Column(Integer, nullable=False, default=0)
    opening_male_birds = Column(Integer, nullable=False, default=0)

    status = Column(String(40), nullable=False, default="Active")
    notes = Column(Text, nullable=True)

    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())

    source_rearing_flock = relationship(
        "BreederRearingFlock",
        back_populates="production_flock",
    )
    farm = relationship("BroilerFarm", foreign_keys=[farm_id])
    shed = relationship("BroilerShed", foreign_keys=[shed_id])
    daily_performance = relationship(
        "BreederProductionDailyPerformance",
        back_populates="flock",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "flock_code",
            name="uq_company_breeder_production_flock_code",
        ),
    )


class BreederProductionDailyPerformance(Base):
    __tablename__ = "breeder_production_daily_performance"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    flock_id = Column(
        Integer,
        ForeignKey("breeder_production_flocks.id"),
        nullable=False,
        index=True,
    )

    entry_date = Column(Date, nullable=False)
    age_days = Column(Integer, nullable=True)

    opening_female_birds = Column(Integer, nullable=True)
    female_mortality = Column(Integer, nullable=False, default=0)
    female_culls = Column(Integer, nullable=False, default=0)
    closing_female_birds = Column(Integer, nullable=True)

    opening_male_birds = Column(Integer, nullable=True)
    male_mortality = Column(Integer, nullable=False, default=0)
    male_culls = Column(Integer, nullable=False, default=0)
    closing_male_birds = Column(Integer, nullable=True)

    feed_kg = Column(Numeric(12, 2), nullable=True)
    water_litres = Column(Numeric(12, 2), nullable=True)

    female_bodyweight_kg = Column(Numeric(8, 3), nullable=True)
    male_bodyweight_kg = Column(Numeric(8, 3), nullable=True)

    total_eggs = Column(Integer, nullable=False, default=0)
    hatching_eggs = Column(Integer, nullable=False, default=0)
    floor_eggs = Column(Integer, nullable=False, default=0)
    rejects = Column(Integer, nullable=False, default=0)

    production_standard_pct = Column(Numeric(7, 3), nullable=True)

    notes = Column(Text, nullable=True)
    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    flock = relationship(
        "BreederProductionFlock",
        back_populates="daily_performance",
    )

    __table_args__ = (
        UniqueConstraint(
            "flock_id",
            "entry_date",
            name="uq_breeder_production_flock_entry_date",
        ),
    )


# ---------------------------------------------------------------------
# Commercial Layers
# ---------------------------------------------------------------------

class CommercialLayerFlock(Base):
    __tablename__ = "commercial_layer_flocks"

    id = Column(Integer, primary_key=True, index=True)
    source_rearing_flock_id = Column(
        Integer,
        ForeignKey("layer_rearing_flocks.id"),
        nullable=True,
        unique=True,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    farm_id = Column(
        Integer,
        ForeignKey("broiler_farms.id"),
        nullable=False,
        index=True,
    )
    shed_id = Column(
        Integer,
        ForeignKey("broiler_sheds.id"),
        nullable=False,
        index=True,
    )

    flock_code = Column(String(120), nullable=False)
    breed = Column(String(120), nullable=True)
    hatch_date = Column(Date, nullable=True)
    housed_date = Column(Date, nullable=True)
    birds_housed = Column(Integer, nullable=True)
    
    planned_depletion_date = Column(
        Date,
        nullable=True,
    )

    status = Column(String(40), nullable=False, default="Active")
    notes = Column(Text, nullable=True)

    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    source_rearing_flock = relationship(
        "LayerRearingFlock",
        back_populates="commercial_layer_flock",
    )
    farm = relationship("BroilerFarm", foreign_keys=[farm_id])
    shed = relationship("BroilerShed", foreign_keys=[shed_id])

    daily_performance = relationship(
        "CommercialLayerDailyPerformance",
        back_populates="flock",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "flock_code",
            name="uq_company_commercial_layer_flock_code",
        ),
    )


class CommercialLayerDailyPerformance(Base):
    __tablename__ = "commercial_layer_daily_performance"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    flock_id = Column(
        Integer,
        ForeignKey("commercial_layer_flocks.id"),
        nullable=False,
        index=True,
    )

    entry_date = Column(Date, nullable=False)
    age_days = Column(Integer, nullable=True)

    opening_birds = Column(Integer, nullable=True)
    mortality_birds = Column(Integer, nullable=False, default=0)
    cull_birds = Column(Integer, nullable=False, default=0)
    closing_birds = Column(Integer, nullable=True)

    total_eggs = Column(
        Integer,
        nullable=False,
        default=0,
    )

    saleable_eggs = Column(
        Integer,
        nullable=False,
        default=0,
    )

    seconds = Column(
        Integer,
        nullable=False,
        default=0,
    )

    cracks = Column(
        Integer,
        nullable=False,
        default=0,
    )

    rejects = Column(
        Integer,
        nullable=False,
        default=0,
    )

    egg_weight_g = Column(
        Numeric(8, 3),
        nullable=True,
    )

    feed_kg = Column(
        Numeric(12, 2),
        nullable=True,
    )

    water_litres = Column(
        Numeric(12, 2),
        nullable=True,
    )

    bodyweight_g = Column(
        Numeric(10, 2),
        nullable=True,
    )

    production_standard_pct = Column(Numeric(7, 3), nullable=True)
    mortality_standard_pct = Column(Numeric(7, 3), nullable=True)
    egg_weight_standard_g = Column(Numeric(8, 3), nullable=True)
    feed_standard_g_bird_day = Column(Numeric(8, 3), nullable=True)
    eggs_per_bird_standard = Column(Numeric(10, 4), nullable=True)
    bodyweight_standard_g = Column(Numeric(10, 2), nullable=True)

    notes = Column(Text, nullable=True)
    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    flock = relationship(
        "CommercialLayerFlock",
        back_populates="daily_performance",
    )

    __table_args__ = (
        UniqueConstraint(
            "flock_id",
            "entry_date",
            name="uq_commercial_layer_flock_entry_date",
        ),
    )

# ---------------------------------------------------------------------
# Hatchery Integration
# Breeder Production -> Egg Receiving -> Setter Program
# ---------------------------------------------------------------------

class HatcheryEggReceipt(Base):
    __tablename__ = "hatchery_egg_receipts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    breeder_production_flock_id = Column(
        Integer,
        ForeignKey("breeder_production_flocks.id"),
        nullable=False,
        index=True,
    )

    receipt_date = Column(Date, nullable=False, index=True)
    total_eggs_received = Column(Integer, nullable=False, default=0)
    floor_eggs = Column(Integer, nullable=False, default=0)
    cracked_eggs = Column(Integer, nullable=False, default=0)
    dirty_eggs = Column(Integer, nullable=False, default=0)
    rejected_eggs = Column(Integer, nullable=False, default=0)
    settable_eggs = Column(Integer, nullable=False, default=0)
    avg_egg_weight_g = Column(Numeric(8, 3), nullable=True)
    storage_room = Column(String(120), nullable=True)
    status = Column(String(40), nullable=False, default="Ready")
    notes = Column(Text, nullable=True)

    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    breeder_production_flock = relationship("BreederProductionFlock")
    setter_batches = relationship(
        "HatcherySetterBatch",
        back_populates="egg_receipt",
        cascade="all, delete-orphan",
    )


class HatcherySetterBatch(Base):
    __tablename__ = "hatchery_setter_batches"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )
    egg_receipt_id = Column(
        Integer,
        ForeignKey("hatchery_egg_receipts.id"),
        nullable=False,
        index=True,
    )

    set_date = Column(Date, nullable=False, index=True)
    setter_name = Column(String(120), nullable=False)
    eggs_set = Column(Integer, nullable=False, default=0)

    # Fertility and hatchability are separate assumptions so OviCore can
    # explain whether future chick movement is breeder-driven or hatch-driven.
    expected_fertility_pct = Column(Numeric(7, 3), nullable=True)
    expected_hatchability_pct = Column(Numeric(7, 3), nullable=True)
    expected_chicks = Column(Integer, nullable=True)

    # Chicken incubation defaults to 21 days in the API, but is persisted so
    # future species / operational exceptions do not require schema changes.
    hatch_date = Column(Date, nullable=False, index=True)

    status = Column(String(40), nullable=False, default="Planned")
    notes = Column(Text, nullable=True)

    last_saved_by = Column(String(255), nullable=True)
    last_saved_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at = Column(DateTime, server_default=func.now())

    egg_receipt = relationship(
        "HatcheryEggReceipt",
        back_populates="setter_batches",
    )

