import unittest
from io import BytesIO
from openpyxl import Workbook
from app.feed_catalog.bulk_import import read_workbook


def fixture(percentage=100, bad_ref=False):
    wb=Workbook(); a=wb.active; a.title='Rations'
    a.append(['Ration Code','Formula Version','Ration Description']);a.append(['T1',1,'Test'])
    b=wb.create_sheet('Ingredients AMEn');b.append(['Mill Ingredient Code','Ingredient Name']);b.append(['W1','Wheat'])
    c=wb.create_sheet('Formula Lines');c.append(['Ration Code','Formula Version','Mill Ingredient Code','Inclusion %'])
    c.append(['T1',1,'OTHER' if bad_ref else 'W1',percentage]);out=BytesIO();wb.save(out);return out.getvalue()


class FeedBulkImportTests(unittest.TestCase):
    def test_valid_formulation(self):
        r,i,lines=read_workbook(fixture());self.assertEqual(len(r),1);self.assertEqual(len(i),1);self.assertEqual(sum(map(len,lines.values())),1)
    def test_rejects_wrong_total(self):
        with self.assertRaisesRegex(ValueError,'total 100'):read_workbook(fixture(95))
    def test_rejects_unknown_ingredient(self):
        with self.assertRaisesRegex(ValueError,'Unknown ration or ingredient'):read_workbook(fixture(bad_ref=True))
    def test_rejects_oversized_file(self):
        with self.assertRaisesRegex(ValueError,'smaller than 2 MB'):read_workbook(b'A'*2_000_001)


if __name__=='__main__':unittest.main()
