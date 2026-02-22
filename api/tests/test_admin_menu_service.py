import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.admin_menu_service import AdminMenuService  # noqa: E402


class AdminMenuServiceTests(unittest.TestCase):
    @patch("flask_api.services.admin_menu_service.query_db")
    def test_get_reference_data_uses_unified_group_tables(self, mock_query_db):
        mock_query_db.return_value = [
            {"id": 1, "key": "entree", "name": "Entree", "sort_order": 1, "is_active": 1, "menu_type": "regular"},
            {"id": 2, "key": "entree", "name": "Entree", "sort_order": 1, "is_active": 1, "menu_type": "formal"},
        ]

        data = AdminMenuService.get_reference_data()

        self.assertEqual(len(data["option_groups"]), 2)
        self.assertEqual(data["sections"], [])
        self.assertEqual(data["tiers"], [])
        regular_group = data["option_groups"][0]
        formal_group = data["option_groups"][1]
        self.assertEqual(regular_group["category"], "regular")
        self.assertEqual(formal_group["category"], "formal")
        self.assertGreater(formal_group["id"], 1_000_000)

        executed_queries = [call.args[0] for call in mock_query_db.call_args_list]
        self.assertTrue(any("FROM menu_type_groups" in query for query in executed_queries))
        self.assertTrue(any("JOIN menu_groups" in query for query in executed_queries))

    @patch("flask_api.services.admin_menu_service.query_db")
    def test_list_menu_items_reads_unified_item_and_type_tables(self, mock_query_db):
        mock_query_db.return_value = [
            {
                "id": 3,
                "menu_type": "regular",
                "item_key": "jerk_chicken",
                "item_name": "Jerk Chicken",
                "is_active": 1,
                "half_tray_price": "75.00",
                "full_tray_price": "140.00",
                "created_at": None,
                "updated_at": None,
                "group_id": 1,
                "group_key": "entree",
                "group_title": "Entree",
            },
            {
                "id": 4,
                "menu_type": "formal",
                "item_key": "short_rib",
                "item_name": "Braised Short Rib",
                "is_active": 1,
                "half_tray_price": "75.00",
                "full_tray_price": "140.00",
                "created_at": None,
                "updated_at": None,
                "group_id": 2,
                "group_key": "entree",
                "group_title": "Entree",
            },
        ]

        rows = AdminMenuService.list_menu_items(search="", is_active="all", limit=50)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["menu_type"], "regular")
        self.assertEqual(rows[1]["menu_type"], "formal")
        self.assertEqual(rows[0]["tray_price_half"], "75.00")
        self.assertIsNone(rows[1]["tray_price_half"])
        self.assertGreater(rows[1]["id"], 1_000_000)

        executed_queries = [call.args[0] for call in mock_query_db.call_args_list]
        self.assertTrue(any("FROM menu_items" in query for query in executed_queries))
        self.assertTrue(any("JOIN menu_item_type_groups" in query for query in executed_queries))

    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_types")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_row")
    def test_get_menu_item_detail_returns_single_group_assignment(self, mock_fetch_item_row, mock_fetch_item_types):
        mock_fetch_item_row.return_value = {
            "id": 3,
            "menu_type": "regular",
            "item_key": "jerk_chicken",
            "item_name": "Jerk Chicken",
            "is_active": True,
            "group_id": 1,
            "group_key": "entree",
            "group_title": "Entree",
            "tray_price_half": "75.00",
            "tray_price_full": "140.00",
            "created_at": None,
            "updated_at": None,
            "_raw_row_id": 3,
        }
        mock_fetch_item_types.return_value = ["regular"]

        detail = AdminMenuService.get_menu_item_detail(3)

        self.assertIsNotNone(detail)
        self.assertEqual(len(detail["option_group_assignments"]), 1)
        self.assertEqual(detail["option_group_assignments"][0]["group_title"], "Entree")
        self.assertEqual(detail["section_row_assignments"], [])
        self.assertEqual(detail["tier_bullet_assignments"], [])
        self.assertEqual(detail["tray_price_half"], "75.00")


if __name__ == "__main__":
    unittest.main()
