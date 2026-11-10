"""Run: python -m unittest discover -s tests -p test_feed_energy.py"""
import unittest
from types import SimpleNamespace
from sqlalchemy import Column, Integer, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.feed_catalog.models import declare_models
from app.feed_catalog.energy import declare_energy_model, estimate_ration_amen, parse_amen


class EnergyTest(unittest.TestCase):
    def test_energy_calculation_requires_complete_amen(self):
        ingredient = SimpleNamespace(id="w", code="W", name="Wheat", company_id=2, energy="3000")
        ration = SimpleNamespace(status="Approved", company_id=2, lines=[{"ingredientId":"w", "percent":100}])
        energy, snapshot = estimate_ration_amen(ration, {"w":ingredient})
        self.assertEqual(energy, 3000)
        self.assertEqual(snapshot[0]["amenKcalKgAsFed"], 3000)
        ingredient.energy = "12.7 MJ/kg"
        with self.assertRaisesRegex(ValueError, "missing or invalid"):
            estimate_ration_amen(ration, {"w":ingredient})
        ingredient.energy = ""
        with self.assertRaises(ValueError):
            estimate_ration_amen(ration, {"w":ingredient})
        ration.lines = [{"ingredientId":"w", "percent":50}]
        with self.assertRaisesRegex(ValueError, "100%"):
            estimate_ration_amen(ration, {"w":ingredient})

    def test_energy_units(self):
        self.assertEqual(parse_amen("2750"), 2750)
        self.assertEqual(parse_amen("0"), 0)
        self.assertIsNone(parse_amen("12.1 MJ/kg"))
        self.assertIsNone(parse_amen("NaN"))
        self.assertIsNone(parse_amen(""))

    def test_snapshot_schema_isolated(self):
        Base = declarative_base()
        class Company(Base):
            __tablename__ = "companies"
            id = Column(Integer, primary_key=True)
            active = Column(Boolean, default=True)
        declare_models(Base)
        Assignment = declare_energy_model(Base)
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with sessionmaker(bind=engine)() as db:
            db.add(Company(id=2))
            db.add(Assignment(id="a", company_id=2, flock_id=12, ration_id="r",
                effective_from=__import__("datetime").date(2026,11,10),
                mill_id="m", ration_code="PBA1", ration_name="Layer 1",
                amen_kcal_kg=2800, ingredient_snapshot=[{"code":"W", "amenKcalKgAsFed":3000}],
                created_by="test"))
            db.commit()
            self.assertEqual(float(db.get(Assignment,"a").amen_kcal_kg),2800)


if __name__ == "__main__":
    unittest.main()
