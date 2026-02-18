import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
  sys.path.insert(0, str(API_ROOT))

from flask_api.models.menu import Menu


class MenuPriceNormalizationTests(unittest.TestCase):
  def test_normalize_range_price(self):
    normalized = Menu._normalize_price_fields("$30-$40 per person")
    self.assertEqual(normalized["price"], "$30-$40 per person")
    self.assertEqual(normalized["price_amount_min"], 30.0)
    self.assertEqual(normalized["price_amount_max"], 40.0)
    self.assertEqual(normalized["price_currency"], "USD")
    self.assertEqual(normalized["price_unit"], "per_person")

  def test_normalize_plus_range_price(self):
    normalized = Menu._normalize_price_fields("$75-$110+ per person")
    self.assertEqual(normalized["price_amount_min"], 75.0)
    self.assertEqual(normalized["price_amount_max"], 110.0)
    self.assertEqual(normalized["price_currency"], "USD")
    self.assertEqual(normalized["price_unit"], "per_person")

  def test_normalize_single_price(self):
    normalized = Menu._normalize_price_fields("$85")
    self.assertEqual(normalized["price_amount_min"], 85.0)
    self.assertEqual(normalized["price_amount_max"], 85.0)
    self.assertEqual(normalized["price_currency"], "USD")

  def test_meta_overrides_text_parse(self):
    normalized = Menu._normalize_price_fields(
      "$30-$40 per person",
      {"amount_min": 32, "amount_max": 44, "currency": "USD", "unit": "per_person"},
    )
    self.assertEqual(normalized["price_amount_min"], 32.0)
    self.assertEqual(normalized["price_amount_max"], 44.0)

  def test_attach_price_meta_payload(self):
    payload = {}
    Menu._attach_price_meta_to_payload(payload, "$45-$65 per person")
    self.assertEqual(payload["price"], "$45-$65 per person")
    self.assertEqual(payload["priceMeta"]["amountMin"], 45.0)
    self.assertEqual(payload["priceMeta"]["amountMax"], 65.0)
    self.assertEqual(payload["priceMeta"]["currency"], "USD")
    self.assertEqual(payload["priceMeta"]["unit"], "per_person")


if __name__ == "__main__":
  unittest.main()
