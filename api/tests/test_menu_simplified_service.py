import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.menu_service import MenuService  # noqa: E402


class MenuSimplifiedServiceTests(unittest.TestCase):
    def test_general_group_mapping_splits_sides_and_salads(self):
        self.assertEqual(
            MenuService._general_group_from_legacy("sides_salads", "Caesar Salad", "sidesSalads"),
            "salad",
        )
        self.assertEqual(
            MenuService._general_group_from_legacy("sides_salads", "Rice Pilaf", "sidesSalads"),
            "side",
        )

    def test_assign_unique_keys_is_deterministic_with_suffixes(self):
        rows = [
            {"name": "Mac & Cheese"},
            {"name": "Mac Cheese"},
            {"name": "Mac   Cheese"},
        ]
        keyed = MenuService._assign_unique_keys(rows)
        self.assertEqual(keyed[0]["key"], "mac-cheese")
        self.assertEqual(keyed[1]["key"], "mac-cheese-2")
        self.assertEqual(keyed[2]["key"], "mac-cheese-3")

    def test_extract_items_sets_required_general_prices(self):
        payload = {
            "menu_options": {
                "sidesSalads": {
                    "category": "sides_salads",
                    "items": ["Charcuterie Board"],
                }
            },
            "menu": {
                "togo": {
                    "sections": [
                        {
                            "sectionId": "togo_sides",
                            "category": "sides_salads",
                            "rows": [["Charcuterie Board", "—", "$95"]],
                        }
                    ]
                },
                "formal": {"sections": []},
            },
        }

        general_rows, _ = MenuService._extract_simplified_items_from_payload(payload)
        self.assertEqual(len(general_rows), 1)
        row = general_rows[0]
        self.assertEqual(row["name"], "Charcuterie Board")
        self.assertEqual(float(row["half_tray_price"]), 95.0)
        self.assertEqual(float(row["full_tray_price"]), 95.0)


if __name__ == "__main__":
    unittest.main()
