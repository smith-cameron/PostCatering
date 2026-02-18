import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
  sys.path.insert(0, str(API_ROOT))

from flask_api.models.menu import Menu


class MenuConstraintNormalizationTests(unittest.TestCase):
  def test_normalize_tier_constraints_new_shape(self):
    rows = [
      {"constraint_key": "entrees", "min_select": 2, "max_select": 3, "constraint_value": None},
      {"constraint_key": "sides", "min_select": 3, "max_select": 3, "constraint_value": None},
    ]
    normalized = Menu._normalize_tier_constraints(rows)
    self.assertEqual(normalized["entrees"], {"min": 2, "max": 3})
    self.assertEqual(normalized["sides"], {"min": 3, "max": 3})

  def test_normalize_tier_constraints_legacy_suffix_rows(self):
    rows = [
      {"constraint_key": "salads_min", "constraint_value": 1, "min_select": 0, "max_select": 0},
      {"constraint_key": "salads_max", "constraint_value": 2, "min_select": 0, "max_select": 0},
    ]
    normalized = Menu._normalize_tier_constraints(rows)
    self.assertEqual(normalized["salads"], {"min": 1, "max": 2})

  def test_normalize_tier_constraints_legacy_plain_value(self):
    rows = [
      {"constraint_key": "bread", "constraint_value": 1, "min_select": 0, "max_select": 0},
    ]
    normalized = Menu._normalize_tier_constraints(rows)
    self.assertEqual(normalized["bread"], {"min": 1, "max": 1})


if __name__ == "__main__":
  unittest.main()
