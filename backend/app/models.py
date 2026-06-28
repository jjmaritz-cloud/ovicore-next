from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Float, UniqueConstraint, func
from sqlalchemy.orm import relationship
from .db import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, unique=True, index=True)
    trading_name = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    users = relationship("AppUser", back_populates="company")
    broiler_farms = relationship("BroilerFarm", back_populates="company")


class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)

    is_global_admin = Column(Boolean, nullable=False, default=False)
    is_company_admin = Column(Boolean, nullable=False, default=False)

    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    company = relationship("Company", back_populates="users")
    farm_access = relationship(
        "UserFarmAccess",
        back_populates="user",
        cascade="all, delete-orphan",
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
    )


class BroilerShed(Base):
    __tablename__ = "broiler_sheds"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False)
    shed_name = Column(Text, nullable=False)
    shed_code = Column(Text)
    floor_area_m2 = Column(Numeric(10, 2), nullable=False)
    default_density_kg_m2 = Column(Numeric(6, 2), nullable=False, default=38.00)
    default_target_lw_kg = Column(Numeric(6, 2), nullable=False, default=2.40)
    default_growout_days = Column(Integer, nullable=False, default=42)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    farm = relationship("BroilerFarm", back_populates="sheds")
    plans = relationship("BroilerPlacementPlan", back_populates="shed")

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