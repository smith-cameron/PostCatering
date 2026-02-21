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
    def test_get_menu_item_detail_omits_inactive_assignments(self, mock_query_db):
        mock_query_db.side_effect = [
            {
                "id": 9,
                "item_key": "jerk_chicken",
                "item_name": "Jerk Chicken",
                "is_active": 1,
                "created_at": None,
                "updated_at": None,
            },
            [
                {
                    "id": 1,
                    "group_id": 2,
                    "option_key": "proteins",
                    "group_title": "Proteins",
                    "display_order": 1,
                    "is_active": 1,
                },
                {
                    "id": 2,
                    "group_id": 2,
                    "option_key": "proteins",
                    "group_title": "Proteins",
                    "display_order": 2,
                    "is_active": 0,
                },
            ],
            [
                {
                    "id": 3,
                    "section_id": 4,
                    "catalog_key": "community",
                    "section_key": "community_entrees",
                    "section_title": "Entrees",
                    "value_1": None,
                    "value_2": None,
                    "display_order": 1,
                    "is_active": 1,
                },
                {
                    "id": 4,
                    "section_id": 4,
                    "catalog_key": "community",
                    "section_key": "community_entrees",
                    "section_title": "Entrees",
                    "value_1": None,
                    "value_2": None,
                    "display_order": 2,
                    "is_active": 0,
                },
            ],
            [
                {
                    "id": 5,
                    "tier_id": 10,
                    "catalog_key": "community",
                    "section_key": "community_tiers",
                    "section_title": "Buffet Tiers",
                    "tier_title": "Tier 1",
                    "display_order": 1,
                    "is_active": 1,
                },
                {
                    "id": 6,
                    "tier_id": 10,
                    "catalog_key": "community",
                    "section_key": "community_tiers",
                    "section_title": "Buffet Tiers",
                    "tier_title": "Tier 1",
                    "display_order": 2,
                    "is_active": 0,
                },
            ],
        ]

        item = AdminMenuService.get_menu_item_detail(9)

        self.assertIsNotNone(item)
        self.assertEqual(len(item["option_group_assignments"]), 1)
        self.assertEqual(len(item["section_row_assignments"]), 1)
        self.assertEqual(len(item["tier_bullet_assignments"]), 1)
        self.assertEqual(item["option_group_assignments"][0]["id"], 1)
        self.assertEqual(item["section_row_assignments"][0]["id"], 3)
        self.assertEqual(item["tier_bullet_assignments"][0]["id"], 5)

        option_query = mock_query_db.call_args_list[1].args[0]
        section_query = mock_query_db.call_args_list[2].args[0]
        tier_query = mock_query_db.call_args_list[3].args[0]
        self.assertIn("AND gi.is_active = 1", option_query)
        self.assertIn("AND r.is_active = 1", section_query)
        self.assertIn("AND b.is_active = 1", tier_query)


if __name__ == "__main__":
    unittest.main()
