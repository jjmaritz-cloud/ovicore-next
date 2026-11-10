import unittest
from types import SimpleNamespace
from app.feed_catalog.energy import estimate_ration_amen, parse_amen

class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.ingredients={"a":SimpleNamespace(id="a",company_id=2,code="W",name="Wheat",energy="13"),
                          "b":SimpleNamespace(id="b",company_id=2,code="L",name="Limestone",energy="0")}
        self.ration=SimpleNamespace(company_id=2,status="Draft",lines=[{"ingredientId":"a","percent":90}, {"ingredientId":"b","percent":10}])
    def test_preview_draft(self):
        value,snapshot=estimate_ration_amen(self.ration,self.ingredients,allow_draft_preview=True)
        self.assertAlmostEqual(value, 2796.3671, places=3)
        self.assertEqual(len(snapshot),2)
    def test_draft_cannot_be_assigned(self):
        with self.assertRaisesRegex(ValueError,"Approved"):
            estimate_ration_amen(self.ration,self.ingredients)
    def test_missing_energy_blocks_preview(self):
        self.ingredients["a"].energy=""
        with self.assertRaisesRegex(ValueError,"missing"):
            estimate_ration_amen(self.ration,self.ingredients,allow_draft_preview=True)
    def test_units(self):
        self.assertAlmostEqual(float(parse_amen("13")), 3107.0746,places=3)
        self.assertIsNone(parse_amen("13 MJ/kg"))

if __name__ == "__main__": unittest.main()
