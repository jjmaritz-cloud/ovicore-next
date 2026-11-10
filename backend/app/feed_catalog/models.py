"""Company-scoped Feed Operations catalogue models.

Register once using the application's existing SQLAlchemy Base in app/main.py.
New installations only: apply schema to sandbox and review migration before production.
"""
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, ForeignKeyConstraint, UniqueConstraint, Text, JSON, CheckConstraint


def declare_models(Base):
    class FeedMill(Base):
        __tablename__ = "feed_mills"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
        code = Column(String(30), nullable=False)
        name = Column(String(255), nullable=False)
        kind = Column(String(30), nullable=False)
        location = Column(String(255), nullable=False, default="")
        contact = Column(String(255), nullable=False, default="")
        email = Column(String(255), nullable=False, default="")
        phone = Column(String(60), nullable=False, default="")
        status = Column(String(20), nullable=False, default="Active")
        notes = Column(Text, nullable=False, default="")
        __table_args__ = (
            UniqueConstraint("company_id", "id", name="uq_feed_mill_tenant_id"),
            UniqueConstraint("company_id", "code", name="uq_feed_mill_company_code"),
        )

    class FeedIngredient(Base):
        __tablename__ = "feed_ingredients"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
        code = Column(String(32), nullable=False)
        name = Column(String(255), nullable=False)
        category = Column(String(100), nullable=False)
        price = Column(Numeric(14, 4), nullable=False)
        protein = Column(String(60), nullable=False, default="")
        energy = Column(String(60), nullable=False, default="")
        status = Column(String(20), nullable=False, default="Active")
        notes = Column(Text, nullable=False, default="")
        __table_args__ = (
            UniqueConstraint("company_id", "id", name="uq_feed_ingredient_tenant_id"),
            UniqueConstraint("company_id", "code", name="uq_feed_ingredient_company_code"),
            CheckConstraint("price >= 0", name="ck_feed_ingredient_price_nonnegative"),
        )

    class FeedRation(Base):
        __tablename__ = "feed_rations"
        id = Column(String(64), primary_key=True)
        company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
        mill_id = Column(String(64), nullable=False)
        code = Column(String(32), nullable=False)
        name = Column(String(255), nullable=False)
        supplier_code = Column(String(64), nullable=False)
        supplier_name = Column(String(255), nullable=False)
        phase = Column(String(80), nullable=False)
        type = Column(String(20), nullable=False)
        base_id = Column(String(64), nullable=True)
        status = Column(String(20), nullable=False)
        notes = Column(Text, nullable=False, default="")
        lines = Column(JSON, nullable=False, default=list)
        __table_args__ = (
            UniqueConstraint("company_id", "id", name="uq_feed_ration_tenant_id"),
            ForeignKeyConstraint(["company_id", "mill_id"], ["feed_mills.company_id", "feed_mills.id"], name="fk_feed_ration_tenant_mill"),
            ForeignKeyConstraint(["company_id", "base_id"], ["feed_rations.company_id", "feed_rations.id"], name="fk_feed_ration_tenant_base"),
            UniqueConstraint("company_id", "mill_id", "code", name="uq_feed_ration_company_mill_code"),
            UniqueConstraint("company_id", "mill_id", "supplier_code", name="uq_feed_ration_company_mill_supplier"),
            CheckConstraint("base_id IS NULL OR base_id <> id", name="ck_feed_ration_not_own_base"),
        )

    from .nutrition import declare_nutrition_model
    FeedRation.NutritionSpec = declare_nutrition_model(Base)
    return FeedMill, FeedIngredient, FeedRation
