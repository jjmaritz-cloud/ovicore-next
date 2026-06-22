from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import relationship
from .db import Base


class BroilerFarm(Base):
    __tablename__ = "broiler_farms"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    farm_name = Column(Text, nullable=False)
    farm_code = Column(Text)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())

    sheds = relationship("BroilerShed", back_populates="farm")


class BroilerShed(Base):
    __tablename__ = "broiler_sheds"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
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


class BroilerPlacementPlan(Base):
    __tablename__ = "broiler_placement_plans"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
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

    company_id = Column(Integer, nullable=False, index=True)
    placement_plan_id = Column(Integer, ForeignKey("broiler_placement_plans.id"), nullable=False)

    entry_date = Column(Date, nullable=False)
    age_days = Column(Integer)

    opening_birds = Column(Integer)
    mortality_birds = Column(Integer, default=0)
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
