import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.models.menu import Menu  # noqa: E402


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

    @patch("flask_api.models.menu.query_db")
    def test_get_effective_service_constraints_falls_back_for_legacy_tier_columns(self, mock_query_db):
        def _side_effect(query, payload=None, fetch="all", connection=None, auto_commit=True):
            if "SELECT c.constraint_key, c.min_select, c.max_select, c.constraint_value" in query:
                raise Exception("(1054, \"Unknown column 'c.min_select' in 'field list'\")")
            return [
                {"constraint_key": "salads_min", "constraint_value": 1},
                {"constraint_key": "salads_max", "constraint_value": 2},
            ]

        mock_query_db.side_effect = _side_effect
        constraints = Menu.get_effective_service_constraints(
            {"level": "tier", "sectionId": "community_buffet_tiers", "title": "Tier 2: Elevated Buffet / Family-Style"}
        )
        self.assertEqual(constraints.get("salads"), {"min": 1, "max": 2})


if __name__ == "__main__":
    unittest.main()
