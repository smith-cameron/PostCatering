import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pymysql

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.admin_service_plan_service import AdminServicePlanService  # noqa: E402


class AdminServicePlanServiceTests(unittest.TestCase):
    def test_build_plan_key_uses_catalog_prefix_and_slug(self):
        self.assertEqual(
            AdminServicePlanService._build_plan_key("catering", title="Tier 1: Casual Buffet"),
            "catering:tier-1-casual-buffet",
        )
        self.assertEqual(
            AdminServicePlanService._build_plan_key("formal", provided_key="formal:3-course", title="ignored"),
            "formal:3-course",
        )

    def test_normalize_constraint_rows_accepts_dict_shapes(self):
        rows = AdminServicePlanService._normalize_constraint_rows(
            {
                "entree_signature_protein": {"min": 2, "max": 3},
                "sides_salads": 2,
            },
            catalog_key="catering",
        )
        self.assertEqual(
            rows,
            [
                {"selection_key": "entree_signature_protein", "min_select": 2, "max_select": 3},
                {"selection_key": "sides_salads", "min_select": 2, "max_select": 2},
            ],
        )

    def test_normalize_constraint_rows_preserves_specific_catering_side_and_salad_groups(self):
        rows = AdminServicePlanService._normalize_constraint_rows(
            [
                {"selection_key": "side", "min_select": 2, "max_select": 2},
                {"selection_key": "salads", "min_select": 1, "max_select": 1},
            ],
            catalog_key="catering",
        )
        self.assertEqual(
            rows,
            [
                {"selection_key": "sides", "min_select": 2, "max_select": 2},
                {"selection_key": "salads", "min_select": 1, "max_select": 1},
            ],
        )

    def test_normalize_detail_rows_accepts_strings_and_objects(self):
        rows = AdminServicePlanService._normalize_detail_rows(
            [
                "Bread",
                {"detail_text": "2 Passed Appetizers", "sort_order": 4},
                {"text": "1 Starter"},
            ]
        )
        self.assertEqual(
            rows,
            [
                {"detail_text": "Bread", "sort_order": 1},
                {"detail_text": "2 Passed Appetizers", "sort_order": 4},
                {"detail_text": "1 Starter", "sort_order": 3},
            ],
        )

    def test_validate_detail_choice_conflicts_rejects_duplicate_custom_choice_text(self):
        error = AdminServicePlanService._validate_detail_choice_conflicts(
            [{"detail_text": "Chicken, Carne Asada or Marinated Pork", "sort_order": 1}],
            [],
            [
                {
                    "group_key": "entree",
                    "group_title": "Taco Bar Proteins",
                    "source_type": "custom_options",
                    "options": [
                        {"option_label": "Carne Asada", "sort_order": 1},
                        {"option_label": "Chicken", "sort_order": 2},
                        {"option_label": "Marinated Pork", "sort_order": 3},
                    ],
                }
            ],
            catalog_key="catering",
        )
        self.assertIn("Included items should only list fixed inclusions", error)
        self.assertIn("Chicken, Carne Asada or Marinated Pork", error)

    def test_resolve_plan_active_flag_reads_is_active_only(self):
        self.assertTrue(AdminServicePlanService._resolve_plan_active_flag({"is_active": True}, default=False))
        self.assertTrue(AdminServicePlanService._resolve_plan_active_flag({"title": "Taco Bar"}, default=True))
        self.assertFalse(AdminServicePlanService._resolve_plan_active_flag({"title": "Taco Bar"}, default=False))

    def test_serialize_plan_row_returns_active_without_legacy_visibility_fields(self):
        row = {
            "id": 10,
            "section_id": 3,
            "section_key": "formal_packages",
            "catalog_key": "formal",
            "plan_key": "formal:2-course",
            "title": "Two-Course Dinner",
            "price_display": "$65-$90 per person",
            "selection_mode": "menu_groups",
            "sort_order": 1,
            "is_active": 0,
        }

        serialized = AdminServicePlanService._serialize_plan_row(row)

        self.assertFalse(serialized["is_active"])
        self.assertNotIn("is_public_visible", serialized)
        self.assertNotIn("is_inquiry_selectable", serialized)

    @patch(
        "flask_api.services.admin_service_plan_service.query_db",
        side_effect=pymysql.err.ProgrammingError(
            1146,
            "Table 'post_catering.service_plan_sections' doesn't exist",
        ),
    )
    def test_list_service_plan_sections_returns_503_when_tables_missing(self, _mock_query_db):
        response_body, status_code = AdminServicePlanService.list_service_plan_sections(catalog_key="catering")

        self.assertEqual(status_code, 503)
        self.assertIn("Service plan tables are not installed", response_body.get("error", ""))

    @patch("flask_api.services.admin_service_plan_service.query_db")
    @patch("flask_api.services.admin_service_plan_service.query_db_many")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._get_plan_by_key", return_value=None)
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._get_section_row",
        return_value={
            "id": 3,
            "catalog_key": "catering",
            "section_key": "catering_packages",
            "section_type": "packages",
        },
    )
    @patch("flask_api.services.admin_service_plan_service.db_transaction")
    def test_create_service_plan_rejects_duplicate_included_item_and_customer_choice(
        self,
        mock_db_transaction,
        _mock_get_section_row,
        _mock_get_plan_by_key,
        mock_query_db_many,
        mock_query_db,
    ):
        mock_db_transaction.return_value.__enter__.return_value = object()

        response_body, status_code = AdminServicePlanService.create_service_plan(
            {
                "section_id": 3,
                "title": "Taco Bar",
                "details": ["Chicken, Carne Asada, Marinated Pork"],
                "selection_groups": [
                    {
                        "group_key": "entree",
                        "group_title": "Taco Bar Proteins",
                        "source_type": "custom_options",
                        "options": [
                            {"option_label": "Carne Asada"},
                            {"option_label": "Chicken"},
                            {"option_label": "Marinated Pork"},
                        ],
                    }
                ],
            }
        )

        self.assertEqual(status_code, 400)
        self.assertIn("Included items should only list fixed inclusions", response_body.get("error", ""))
        mock_query_db.assert_not_called()
        mock_query_db_many.assert_not_called()

    @patch("flask_api.services.admin_service_plan_service.query_db")
    @patch("flask_api.services.admin_service_plan_service.query_db_many")
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_selection_groups",
        return_value={
            10: [
                {
                    "group_key": "entree",
                    "group_title": "Taco Bar Proteins",
                    "source_type": "custom_options",
                    "options": [
                        {"option_label": "Carne Asada", "sort_order": 1},
                        {"option_label": "Chicken", "sort_order": 2},
                        {"option_label": "Marinated Pork", "sort_order": 3},
                    ],
                }
            ]
        },
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_details",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_constraints",
        return_value={10: [{"selection_key": "entree", "min_select": 1, "max_select": 1}]},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._get_plan_row",
        return_value={
            "id": 10,
            "catalog_key": "catering",
            "section_id": 3,
            "title": "Taco Bar",
            "price_display": "$18-$25 per person",
            "price_amount_min": None,
            "price_amount_max": None,
            "price_currency": "USD",
            "price_unit": "per_person",
            "selection_mode": "custom_options",
            "is_active": 1,
        },
    )
    @patch("flask_api.services.admin_service_plan_service.db_transaction")
    def test_update_service_plan_rejects_detail_conflicts_against_existing_customer_choices(
        self,
        mock_db_transaction,
        _mock_get_plan_row,
        _mock_fetch_constraints,
        _mock_fetch_details,
        _mock_fetch_selection_groups,
        mock_query_db_many,
        mock_query_db,
    ):
        mock_db_transaction.return_value.__enter__.return_value = object()

        response_body, status_code = AdminServicePlanService.update_service_plan(
            10,
            {"details": ["Chicken, Carne Asada or Marinated Pork"]},
        )

        self.assertEqual(status_code, 400)
        self.assertIn("Included items should only list fixed inclusions", response_body.get("error", ""))
        mock_query_db.assert_not_called()
        mock_query_db_many.assert_not_called()


if __name__ == "__main__":
    unittest.main()
