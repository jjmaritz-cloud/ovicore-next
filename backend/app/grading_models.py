from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, CheckConstraint, func
from app.db import Base

class EggBatch(Base):
    __tablename__ = "egg_storage_batches"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("broiler_farms.id"), nullable=False, index=True)
    shed_id = Column(Integer, ForeignKey("broiler_sheds.id"), nullable=False)
    flock_id = Column(Integer, ForeignKey("commercial_layer_flocks.id"), nullable=False, index=True)
    lay_date = Column(Date, nullable=False, index=True)
    batch_code = Column(String(90), nullable=False)
    egg_count = Column(Integer, nullable=False)
    storage_location = Column(String(120), nullable=False)
    notes = Column(String(500), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("company_id", "batch_code", name="uq_egg_storage_company_batch_code"),
        CheckConstraint("egg_count > 0", name="ck_egg_storage_positive_count"),
    )
