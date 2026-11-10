import unittest
from datetime import date
from decimal import Decimal
from pydantic import ValidationError
from app.feed_catalog.nutrition import NutritionSpecIn, nutrient_intake, declare_nutrition_model

class NutritionTests(unittest.TestCase):
    def test_daily_lysine_and_energy(self):
        result = nutrient_intake({"amen_mj_kg": 11.5, "digestible_lysine_pct": 0.75, "total_lysine_pct": 0.85}, 115)
        self.assertEqual(result["digestible_lysine_mg_bird_day"], 862.5)
        self.assertEqual(result["total_lysine_mg_bird_day"], 977.5)
        self.assertAlmostEqual(result["kcal_bird_day"], 316.03, delta=0.1)

    def test_missing_values_remain_missing(self):
        self.assertIsNone(nutrient_intake({"crude_protein_pct":18}, 110)["digestible_lysine_mg_bird_day"])

    def test_digestible_cannot_exceed_total(self):
        with self.assertRaises(ValidationError):
            NutritionSpecIn(effective_from=date(2026,11,11),source="Mill formulated",values={"digestible_lysine_pct": Decimal("0.9"),"total_lysine_pct":Decimal("0.8")})

    def test_rejects_unknown_nutrients(self):
        with self.assertRaises(ValidationError):
            NutritionSpecIn(effective_from=date(2026,11,11),source="Mill formulated",values={"not_nutrient":Decimal("1")})

    def test_rejects_empty_or_zero_values(self):
        for values in ({}, {"digestible_lysine_pct": None}, {"digestible_lysine_pct": Decimal("0")}):
            with self.assertRaises(ValidationError):
                NutritionSpecIn(effective_from=date(2026,11,11),source="Mill formulated",values=values)

    def test_rejects_invalid_feed(self):
        with self.assertRaises(ValueError): nutrient_intake({"digestible_lysine_pct":0.75}, 0)

if __name__ == "__main__": unittest.main()
