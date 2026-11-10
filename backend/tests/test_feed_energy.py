"""Run: python -m unittest discover -s tests -p test_feed_energy.py"""
import unittest
from types import SimpleNamespace
from sqlalchemy import Column, Integer, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.feed_catalog.models import declare_models
from app.feed_catalog.energy import declare_energy_model, estimate_ration_amen, parse_amen


class EnergyTest(unittest.TestCase):
    def test_energy_calculation_requires_complete_amen(self):
        ingredient = SimpleNamespace(id="w", code="W", name="Wheat", company_id=2, energy="13.0")
        ration = SimpleNamespace(status="Approved", company_id=2, lines=[{"ingredientId":"w", "percent":100}])
        energy, snapshot = estimate_ration_amen(ration, {"w":ingredient})
        self.assertAlmostEqual(energy, 3107.0746, places=3)
        self.assertAlmostEqual(snapshot[0]["amenKcalKgAsFed"], 3107.0745698, places=3)
        self.assertEqual(snapshot[0]["energyMjKgAsFed"], 13.0)
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
        self.assertAlmostEqual(float(parse_amen("13.0")), 3107.0745698, places=4)
        self.assertIsNone(parse_amen("2750"))  # kcal/kg mistakenly entered in MJ/kg field
        self.assertEqual(parse_amen("0"), 0)
        self.assertIsNone(parse_amen("12.1 MJ/kg"))
        self.assertIsNone(parse_amen("42"))
        self.assertIsNone(parse_amen("NaN"))
        self.assertIsNone(parse_amen(""))


    def test_weighted_mj_to_kcal_and_zero_energy_ingredients(self):
        ingredients = {
            "w": SimpleNamespace(id="w", code="W", name="Wheat", company_id=2, energy="13"),
            "s": SimpleNamespace(id="s", code="S", name="Soy", company_id=2, energy="10"),
            "l": SimpleNamespace(id="l", code="L", name="Limestone", company_id=2, energy="0"),
        }
        ration = SimpleNamespace(status="Approved", company_id=2, lines=[
            {"ingredientId": "w", "percent": 60},
            {"ingredientId": "s", "percent": 30},
            {"ingredientId": "l", "percent": 10},
        ])
        energy, snapshot = estimate_ration_amen(ration, ingredients)
        self.assertAlmostEqual(energy, 2581.26195, places=3)  # 10.8 MJ/kg
        self.assertEqual(len(snapshot), 3)
        self.assertEqual(snapshot[2]["amenKcalKgAsFed"], 0)

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
