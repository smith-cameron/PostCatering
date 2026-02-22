import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

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

    @patch("flask_api.services.admin_menu_service.query_db")
    def test_list_menu_items_includes_unassigned_items_with_empty_type_list(self, mock_query_db):
        mock_query_db.return_value = [
            {
                "id": 9,
                "menu_type": None,
                "item_key": "seasonal_special",
                "item_name": "Seasonal Special",
                "is_active": 0,
                "tray_price_half": "0.00",
                "tray_price_full": "0.00",
                "created_at": None,
                "updated_at": None,
                "group_id": None,
                "group_key": None,
                "group_title": None,
            }
        ]

        rows = AdminMenuService.list_menu_items(search="", is_active="all", limit=50)

        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["menu_type"])
        self.assertEqual(rows[0]["menu_types"], [])
        self.assertIsNone(rows[0]["group_id"])
        self.assertFalse(rows[0]["is_active"])

    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_assignments")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_types")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_row")
    def test_get_menu_item_detail_returns_single_group_assignment(
        self,
        mock_fetch_item_row,
        mock_fetch_item_types,
        mock_fetch_item_assignments,
    ):
        mock_fetch_item_row.return_value = {
            "id": 3,
            "menu_type": "regular",
            "item_key": "jerk_chicken",
            "item_name": "Jerk Chicken",
            "item_type": "protein",
            "item_category": "entree",
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
        mock_fetch_item_assignments.return_value = {
            "regular": {
                "raw_group_id": 1,
                "encoded_group_id": 1,
                "group_key": "entree",
                "group_title": "Entree",
                "is_active": True,
            }
        }

        detail = AdminMenuService.get_menu_item_detail(3)

        self.assertIsNotNone(detail)
        self.assertEqual(len(detail["option_group_assignments"]), 1)
        self.assertEqual(detail["option_group_assignments"][0]["group_title"], "Entree")
        self.assertEqual(detail["option_group_assignments"][0]["menu_type"], "regular")
        self.assertEqual(detail["section_row_assignments"], [])
        self.assertEqual(detail["tier_bullet_assignments"], [])
        self.assertEqual(detail["tray_price_half"], "75.00")

    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_assignments")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_types")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_row")
    def test_get_menu_item_detail_returns_assignments_for_all_item_menu_types(
        self,
        mock_fetch_item_row,
        mock_fetch_item_types,
        mock_fetch_item_assignments,
    ):
        mock_fetch_item_row.return_value = {
            "id": 5,
            "menu_type": "regular",
            "item_key": "mac_cheese",
            "item_name": "Mac and Cheese",
            "item_type": "side",
            "item_category": "side",
            "is_active": True,
            "group_id": 2,
            "group_key": "side",
            "group_title": "Side",
            "tray_price_half": "60.00",
            "tray_price_full": "110.00",
            "created_at": None,
            "updated_at": None,
            "_raw_row_id": 5,
        }
        mock_fetch_item_types.return_value = ["regular", "formal"]
        mock_fetch_item_assignments.return_value = {
            "regular": {
                "raw_group_id": 2,
                "encoded_group_id": 2,
                "group_key": "side",
                "group_title": "Side",
                "is_active": True,
            },
            "formal": {
                "raw_group_id": 3,
                "encoded_group_id": 1_000_003,
                "group_key": "starter",
                "group_title": "Starter",
                "is_active": True,
            },
        }

        detail = AdminMenuService.get_menu_item_detail(5)

        self.assertIsNotNone(detail)
        self.assertEqual(detail["menu_types"], ["regular", "formal"])
        self.assertEqual(len(detail["option_group_assignments"]), 2)
        by_type = {
            assignment["menu_type"]: assignment
            for assignment in detail["option_group_assignments"]
        }
        self.assertEqual(by_type["regular"]["group_title"], "Side")
        self.assertEqual(by_type["regular"]["group_id"], 2)
        self.assertEqual(by_type["formal"]["group_title"], "Starter")
        self.assertEqual(by_type["formal"]["group_id"], 1_000_003)

    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_raw_item_row")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_row")
    def test_get_menu_item_detail_returns_unassigned_item_when_no_type_links(self, mock_fetch_item_row, mock_fetch_raw_item_row):
        mock_fetch_item_row.return_value = None
        mock_fetch_raw_item_row.return_value = {
            "id": 5,
            "item_key": "jerk_chicken",
            "item_name": "Jerk Chicken",
            "item_type": "protein",
            "item_category": "entree",
            "tray_price_half": "75.00",
            "tray_price_full": "140.00",
            "is_active": 0,
        }

        detail = AdminMenuService.get_menu_item_detail(5)

        self.assertIsNotNone(detail)
        self.assertEqual(detail["menu_types"], [])
        self.assertEqual(detail["option_group_assignments"], [])
        self.assertFalse(detail["is_active"])

    @patch("flask_api.services.admin_menu_service.AdminMenuService._has_global_item_name_conflict")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_type_id_map")
    @patch("flask_api.services.admin_menu_service.AdminMenuService.get_menu_item_detail")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._set_item_type_assignments")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._generate_unique_item_key")
    @patch("flask_api.services.admin_menu_service.query_db")
    @patch("flask_api.services.admin_menu_service.db_transaction")
    def test_create_menu_item_allows_empty_menu_type_and_forces_inactive(
        self,
        mock_db_transaction,
        mock_query_db,
        mock_generate_unique_item_key,
        mock_set_item_type_assignments,
        mock_get_menu_item_detail,
        mock_fetch_type_id_map,
        mock_has_global_conflict,
    ):
        mock_has_global_conflict.return_value = False
        mock_generate_unique_item_key.return_value = "jerk_chicken"
        mock_query_db.return_value = 5
        mock_get_menu_item_detail.return_value = {
            "id": 5,
            "item_name": "Jerk Chicken",
            "menu_types": [],
            "is_active": False,
            "option_group_assignments": [],
        }

        context_manager = MagicMock()
        context_manager.__enter__.return_value = "connection"
        context_manager.__exit__.return_value = False
        mock_db_transaction.return_value = context_manager

        response, status = AdminMenuService.create_menu_item(
            {
                "item_name": "Jerk Chicken",
                "menu_type": [],
                "is_active": True,
            }
        )

        self.assertEqual(status, 201)
        self.assertEqual(response["item"]["menu_types"], [])
        self.assertFalse(response["item"]["is_active"])
        mock_fetch_type_id_map.assert_not_called()
        mock_set_item_type_assignments.assert_called_once_with(
            row_id=5,
            assignments_by_type={},
            type_id_map={},
            connection="connection",
        )
        _, insert_payload = mock_query_db.call_args[0]
        self.assertEqual(insert_payload["is_active"], 0)

    @patch("flask_api.services.admin_menu_service.AdminMenuService._has_global_item_name_conflict")
    @patch("flask_api.services.admin_menu_service.db_transaction")
    def test_create_menu_item_duplicate_name_returns_specific_error(self, mock_db_transaction, mock_has_global_conflict):
        mock_has_global_conflict.return_value = True

        context_manager = MagicMock()
        context_manager.__enter__.return_value = "connection"
        context_manager.__exit__.return_value = False
        mock_db_transaction.return_value = context_manager

        response, status = AdminMenuService.create_menu_item(
            {
                "item_name": "Jerk Chicken",
                "menu_type": [],
            }
        )

        self.assertEqual(status, 409)
        self.assertEqual(response.get("error"), "Item name must be unique.")

    @patch("flask_api.services.admin_menu_service.AdminMenuService._has_global_item_name_conflict")
    @patch("flask_api.services.admin_menu_service.db_transaction")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_types")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_row")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._decode_item_id")
    def test_update_menu_item_duplicate_name_returns_specific_error(
        self,
        mock_decode_item_id,
        mock_fetch_item_row,
        mock_fetch_item_types,
        mock_db_transaction,
        mock_has_global_conflict,
    ):
        mock_decode_item_id.return_value = ("regular", 5)
        mock_fetch_item_row.return_value = {
            "id": 5,
            "menu_type": "regular",
            "item_key": "jerk_chicken",
            "item_name": "Jerk Chicken",
            "item_type": "protein",
            "item_category": "entree",
            "is_active": True,
            "group_id": 10,
            "group_key": "signature_proteins",
            "group_title": "Proteins",
            "tray_price_half": "75.00",
            "tray_price_full": "140.00",
            "_raw_row_id": 5,
        }
        mock_fetch_item_types.return_value = ["regular"]
        mock_has_global_conflict.return_value = True

        context_manager = MagicMock()
        context_manager.__enter__.return_value = "connection"
        context_manager.__exit__.return_value = False
        mock_db_transaction.return_value = context_manager

        response, status = AdminMenuService.update_menu_item(
            5,
            {
                "item_name": "Jerk Chicken",
            },
        )

        self.assertEqual(status, 409)
        self.assertEqual(response.get("error"), "Item name must be unique.")

    @patch("flask_api.services.admin_menu_service.AdminMenuService._has_global_item_name_conflict")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._set_item_type_assignments")
    @patch("flask_api.services.admin_menu_service.query_db")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_raw_item_row")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._generate_unique_item_key")
    @patch("flask_api.services.admin_menu_service.db_transaction")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_types")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_item_row")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._decode_item_id")
    def test_update_menu_item_empty_type_selection_forces_inactive_and_clears_assignments(
        self,
        mock_decode_item_id,
        mock_fetch_item_row,
        mock_fetch_item_types,
        mock_db_transaction,
        mock_generate_unique_item_key,
        mock_fetch_raw_item_row,
        mock_query_db,
        mock_set_item_type_assignments,
        mock_has_global_conflict,
    ):
        mock_has_global_conflict.return_value = False
        mock_decode_item_id.return_value = ("regular", 5)
        mock_fetch_item_row.return_value = {
            "id": 5,
            "menu_type": "regular",
            "item_key": "jerk_chicken",
            "item_name": "Jerk Chicken",
            "item_type": "protein",
            "item_category": "entree",
            "is_active": True,
            "group_id": 10,
            "group_key": "signature_proteins",
            "group_title": "Proteins",
            "tray_price_half": "75.00",
            "tray_price_full": "140.00",
            "_raw_row_id": 5,
        }
        mock_fetch_item_types.return_value = ["regular"]
        mock_generate_unique_item_key.return_value = "jerk_chicken"
        mock_fetch_raw_item_row.side_effect = [
            {
                "id": 5,
                "item_key": "jerk_chicken",
                "item_name": "Jerk Chicken",
                "item_type": "protein",
                "item_category": "entree",
                "tray_price_half": "75.00",
                "tray_price_full": "140.00",
                "is_active": 1,
            },
            {
                "id": 5,
                "item_key": "jerk_chicken",
                "item_name": "Jerk Chicken",
                "item_type": "protein",
                "item_category": "entree",
                "tray_price_half": "75.00",
                "tray_price_full": "140.00",
                "is_active": 0,
            },
        ]

        context_manager = MagicMock()
        context_manager.__enter__.return_value = "connection"
        context_manager.__exit__.return_value = False
        mock_db_transaction.return_value = context_manager

        response, status = AdminMenuService.update_menu_item(
            5,
            {
                "item_name": "Jerk Chicken",
                "menu_type": [],
                "is_active": True,
            },
        )

        self.assertEqual(status, 200)
        self.assertEqual(response["item"]["menu_types"], [])
        self.assertEqual(response["item"]["option_group_assignments"], [])
        self.assertFalse(response["item"]["is_active"])
        mock_set_item_type_assignments.assert_called_once_with(
            row_id=5,
            assignments_by_type={},
            type_id_map={},
            connection="connection",
        )
        self.assertTrue(mock_query_db.called)
        _, update_payload = mock_query_db.call_args[0]
        self.assertEqual(update_payload["is_active"], 0)

    @patch("flask_api.services.admin_menu_service.query_db")
    @patch("flask_api.services.admin_menu_service.db_transaction")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._fetch_raw_item_row")
    @patch("flask_api.services.admin_menu_service.AdminMenuService._decode_item_id")
    def test_delete_menu_item_deletes_record_and_returns_deleted_name(
        self,
        mock_decode_item_id,
        mock_fetch_raw_item_row,
        mock_db_transaction,
        mock_query_db,
    ):
        mock_decode_item_id.return_value = ("regular", 5)
        mock_fetch_raw_item_row.return_value = {"id": 5, "item_name": "Jerk Chicken"}

        context_manager = MagicMock()
        context_manager.__enter__.return_value = "connection"
        context_manager.__exit__.return_value = False
        mock_db_transaction.return_value = context_manager

        response, status = AdminMenuService.delete_menu_item(5)

        self.assertEqual(status, 200)
        self.assertTrue(response["ok"])
        self.assertEqual(response["deleted_item_id"], 5)
        self.assertEqual(response["item_name"], "Jerk Chicken")
        self.assertTrue(mock_query_db.called)
        delete_sql, delete_payload = mock_query_db.call_args[0]
        self.assertIn("DELETE FROM menu_items", delete_sql)
        self.assertEqual(delete_payload["id"], 5)
        self.assertEqual(mock_query_db.call_args.kwargs["connection"], "connection")
        self.assertEqual(mock_query_db.call_args.kwargs["auto_commit"], False)


if __name__ == "__main__":
    unittest.main()
