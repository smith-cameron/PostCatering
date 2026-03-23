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

    def test_serialize_plan_row_normalizes_legacy_plain_numeric_package_price_display(self):
        row = {
            "id": 12,
            "section_id": 3,
            "section_key": "catering_packages",
            "catalog_key": "catering",
            "plan_key": "catering:elevated-buffet",
            "title": "Elevated Buffet",
            "price_display": "45-89",
            "price_amount_min": None,
            "price_amount_max": None,
            "price_currency": None,
            "price_unit": None,
            "selection_mode": "none",
            "sort_order": 1,
            "is_active": 1,
        }

        serialized = AdminServicePlanService._serialize_plan_row(row)

        self.assertEqual(serialized["price"], "$45-$89 per person")
        self.assertEqual(
            serialized["price_meta"],
            {
                "amount_min": "45.00",
                "amount_max": "89.00",
                "currency": "USD",
                "unit": "per_person",
            },
        )

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
                "constraints": [{"selection_key": "entree", "min": 1, "max": 1}],
                "selection_groups": [
                    {
                        "group_key": "entree",
                        "group_title": "Taco Bar Proteins",
                        "source_type": "custom_options",
                        "min_select": 1,
                        "max_select": 1,
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
    def test_create_service_plan_rejects_invalid_price_with_field_error(
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
                "price": "market price",
            }
        )

        self.assertEqual(status_code, 400)
        self.assertEqual(
            response_body.get("field_errors"),
            {"price": "Price display must include at least one numeric amount."},
        )
        mock_query_db.assert_not_called()
        mock_query_db_many.assert_not_called()

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
    def test_create_service_plan_rejects_duplicate_included_items_with_field_error(
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
                "details": ["Bread", " bread "],
            }
        )

        self.assertEqual(status_code, 400)
        self.assertEqual(response_body.get("field_errors"), {"details": "Included items cannot repeat."})
        mock_query_db.assert_not_called()
        mock_query_db_many.assert_not_called()

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
    def test_create_service_plan_rejects_duplicate_custom_option_keys_after_slugification(
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
                "constraints": [{"selection_key": "signature_protein", "min": 1, "max": 1}],
                "selection_groups": [
                    {
                        "group_key": "signature_protein",
                        "group_title": "Taco Bar Proteins",
                        "source_type": "custom_options",
                        "min_select": 1,
                        "max_select": 1,
                        "options": [
                            {"option_label": "Carne Asada"},
                            {"option_label": "Carne-Asada"},
                        ],
                    }
                ],
            }
        )

        self.assertEqual(status_code, 400)
        self.assertEqual(
            response_body.get("field_errors"),
            {"choice_rows": "Custom customer choice options must stay unique after formatting."},
        )
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
                    "min_select": 1,
                    "max_select": 1,
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

    @patch("flask_api.services.admin_service_plan_service.query_db")
    @patch("flask_api.services.admin_service_plan_service.query_db_many")
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_selection_groups",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_details",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_constraints",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._get_plan_row",
        return_value={
            "id": 10,
            "catalog_key": "catering",
            "section_id": 3,
            "title": "Taco Bar",
            "price_display": "$18-$25 per person",
            "price_amount_min": "18.00",
            "price_amount_max": "25.00",
            "price_currency": "USD",
            "price_unit": "per_person",
            "selection_mode": "none",
            "is_active": 1,
        },
    )
    @patch("flask_api.services.admin_service_plan_service.db_transaction")
    def test_update_service_plan_rejects_invalid_choice_limits_with_field_error(
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
            {"constraints": [{"selection_key": "entree", "min": 2, "max": 1}]},
        )

        self.assertEqual(status_code, 400)
        self.assertEqual(
            response_body.get("field_errors"),
            {"choice_rows": "Each customer choice must use Min less than or equal to Max."},
        )
        mock_query_db.assert_not_called()
        mock_query_db_many.assert_not_called()

    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService.get_service_plan_detail")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_selection_groups")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_details")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_constraints")
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._next_plan_sort_order", return_value=1
    )
    @patch("flask_api.services.admin_service_plan_service.query_db", return_value=25)
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._get_plan_by_key", return_value=None)
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._get_section_row",
        return_value={
            "id": 3,
            "catalog_key": "formal",
            "section_key": "formal_packages",
            "section_type": "packages",
        },
    )
    @patch("flask_api.services.admin_service_plan_service.db_transaction")
    def test_create_service_plan_accepts_valid_payload_and_derives_price_meta(
        self,
        mock_db_transaction,
        _mock_get_section_row,
        _mock_get_plan_by_key,
        mock_query_db,
        _mock_next_plan_sort_order,
        mock_replace_constraints,
        mock_replace_details,
        mock_replace_selection_groups,
        mock_get_service_plan_detail,
    ):
        mock_db_transaction.return_value.__enter__.return_value = object()
        mock_get_service_plan_detail.return_value = {"id": 25, "title": "Three-Course Dinner"}

        response_body, status_code = AdminServicePlanService.create_service_plan(
            {
                "section_id": 3,
                "title": "Three-Course Dinner",
                "price": "$75-$110+ per person",
                "constraints": [{"selection_key": "entree", "min": 1, "max": 2}],
            }
        )

        self.assertEqual(status_code, 201)
        self.assertEqual(response_body.get("plan"), {"id": 25, "title": "Three-Course Dinner"})
        insert_payload = mock_query_db.call_args.args[1]
        self.assertEqual(insert_payload["title"], "Three-Course Dinner")
        self.assertEqual(insert_payload["price_display"], "$75-$110+ per person")
        self.assertEqual(insert_payload["price_amount_min"], "75.00")
        self.assertEqual(insert_payload["price_amount_max"], "110.00")
        self.assertEqual(insert_payload["price_currency"], "USD")
        self.assertEqual(insert_payload["price_unit"], "per_person")
        self.assertEqual(insert_payload["selection_mode"], "menu_groups")
        mock_replace_constraints.assert_called_once()
        mock_replace_details.assert_called_once()
        mock_replace_selection_groups.assert_called_once()

    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService.get_service_plan_detail")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_selection_groups")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_details")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_constraints")
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._next_plan_sort_order", return_value=1
    )
    @patch("flask_api.services.admin_service_plan_service.query_db", return_value=27)
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
    def test_create_service_plan_normalizes_plain_numeric_price_to_per_person_display(
        self,
        mock_db_transaction,
        _mock_get_section_row,
        _mock_get_plan_by_key,
        mock_query_db,
        _mock_next_plan_sort_order,
        mock_replace_constraints,
        mock_replace_details,
        mock_replace_selection_groups,
        mock_get_service_plan_detail,
    ):
        mock_db_transaction.return_value.__enter__.return_value = object()
        mock_get_service_plan_detail.return_value = {"id": 27, "title": "Elevated Buffet"}

        response_body, status_code = AdminServicePlanService.create_service_plan(
            {
                "section_id": 3,
                "title": "Elevated Buffet",
                "price": "45-89",
            }
        )

        self.assertEqual(status_code, 201)
        self.assertEqual(response_body.get("plan"), {"id": 27, "title": "Elevated Buffet"})
        insert_payload = mock_query_db.call_args.args[1]
        self.assertEqual(insert_payload["price_display"], "$45-$89 per person")
        self.assertEqual(insert_payload["price_amount_min"], "45.00")
        self.assertEqual(insert_payload["price_amount_max"], "89.00")
        self.assertEqual(insert_payload["price_currency"], "USD")
        self.assertEqual(insert_payload["price_unit"], "per_person")
        mock_replace_constraints.assert_called_once()
        mock_replace_details.assert_called_once()
        mock_replace_selection_groups.assert_called_once()

    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService.get_service_plan_detail")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_selection_groups")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_details")
    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService._replace_plan_constraints")
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._next_plan_sort_order", return_value=1
    )
    @patch("flask_api.services.admin_service_plan_service.query_db", return_value=26)
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
    def test_create_service_plan_accepts_custom_selection_groups_without_limits(
        self,
        mock_db_transaction,
        _mock_get_section_row,
        _mock_get_plan_by_key,
        mock_query_db,
        _mock_next_plan_sort_order,
        mock_replace_constraints,
        mock_replace_details,
        mock_replace_selection_groups,
        mock_get_service_plan_detail,
    ):
        mock_db_transaction.return_value.__enter__.return_value = object()
        mock_get_service_plan_detail.return_value = {"id": 26, "title": "Taco Bar"}

        response_body, status_code = AdminServicePlanService.create_service_plan(
            {
                "section_id": 3,
                "title": "Taco Bar",
                "selection_groups": [
                    {
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

        self.assertEqual(status_code, 201)
        self.assertEqual(response_body.get("plan"), {"id": 26, "title": "Taco Bar"})
        insert_payload = mock_query_db.call_args.args[1]
        self.assertEqual(insert_payload["selection_mode"], "custom_options")

        mock_replace_constraints.assert_called_once()
        self.assertEqual(mock_replace_constraints.call_args.args[1], [])
        mock_replace_details.assert_called_once()
        self.assertEqual(mock_replace_details.call_args.args[1], [])
        mock_replace_selection_groups.assert_called_once()

        selection_groups = mock_replace_selection_groups.call_args.args[1]
        self.assertEqual(len(selection_groups), 1)
        self.assertEqual(selection_groups[0]["group_key"], "taco_bar_proteins")
        self.assertEqual(selection_groups[0]["group_title"], "Taco Bar Proteins")
        self.assertIsNone(selection_groups[0]["min_select"])
        self.assertIsNone(selection_groups[0]["max_select"])
        self.assertEqual(
            selection_groups[0]["options"],
            [
                {
                    "option_key": "carne_asada",
                    "option_label": "Carne Asada",
                    "menu_item_id": None,
                    "sort_order": 1,
                    "is_active": 1,
                },
                {
                    "option_key": "chicken",
                    "option_label": "Chicken",
                    "menu_item_id": None,
                    "sort_order": 2,
                    "is_active": 1,
                },
                {
                    "option_key": "marinated_pork",
                    "option_label": "Marinated Pork",
                    "menu_item_id": None,
                    "sort_order": 3,
                    "is_active": 1,
                },
            ],
        )

    @patch("flask_api.services.admin_service_plan_service.AdminServicePlanService.get_service_plan_detail")
    @patch("flask_api.services.admin_service_plan_service.query_db")
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_selection_groups",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_details",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._fetch_plan_constraints",
        return_value={10: []},
    )
    @patch(
        "flask_api.services.admin_service_plan_service.AdminServicePlanService._get_plan_row",
        return_value={
            "id": 10,
            "catalog_key": "catering",
            "section_id": 3,
            "title": "Taco Bar",
            "price_display": "$18-$25 per person",
            "price_amount_min": "18.00",
            "price_amount_max": "25.00",
            "price_currency": "USD",
            "price_unit": "per_person",
            "selection_mode": "none",
            "is_active": 1,
        },
    )
    @patch("flask_api.services.admin_service_plan_service.db_transaction")
    def test_update_service_plan_normalizes_plain_numeric_price_to_per_person_display(
        self,
        mock_db_transaction,
        _mock_get_plan_row,
        _mock_fetch_constraints,
        _mock_fetch_details,
        _mock_fetch_selection_groups,
        mock_query_db,
        mock_get_service_plan_detail,
    ):
        mock_db_transaction.return_value.__enter__.return_value = object()
        mock_get_service_plan_detail.return_value = {"id": 10, "title": "Taco Bar"}

        response_body, status_code = AdminServicePlanService.update_service_plan(
            10,
            {"price": "45"},
        )

        self.assertEqual(status_code, 200)
        self.assertEqual(response_body.get("plan"), {"id": 10, "title": "Taco Bar"})
        update_payload = mock_query_db.call_args.args[1]
        self.assertEqual(update_payload["price_display"], "$45 per person")
        self.assertEqual(update_payload["price_amount_min"], "45.00")
        self.assertEqual(update_payload["price_amount_max"], "45.00")
        self.assertEqual(update_payload["price_currency"], "USD")
        self.assertEqual(update_payload["price_unit"], "per_person")


if __name__ == "__main__":
    unittest.main()
