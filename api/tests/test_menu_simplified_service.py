import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.menu_service import MenuService  # noqa: E402


class MenuSimplifiedServiceTests(unittest.TestCase):
    def test_schema_paths_skip_obsolete_service_plan_migrations(self):
        path_names = [path.name for path in MenuService._get_schema_paths()]
        self.assertIn("20260316_catering_packages_refactor.sql", path_names)
        self.assertIn("20260316_service_package_status_phase2.sql", path_names)
        self.assertIn("20260316_service_package_drop_descriptions.sql", path_names)
        self.assertNotIn("20260311_service_plan_catalog.sql", path_names)
        self.assertNotIn("20260315_service_packages_unify_tiers.sql", path_names)

    def test_regular_group_inference_splits_sides_and_salads(self):
        self.assertEqual(
            MenuService._infer_regular_group_key("sides_salads", "Caesar Salad", "sidesSalads"),
            "salad",
        )
        self.assertEqual(
            MenuService._infer_regular_group_key("sides_salads", "Rice Pilaf", "sidesSalads"),
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

    @patch("flask_api.services.menu_service.AdminServicePlanService.list_service_plan_sections")
    @patch("flask_api.services.menu_service.MenuService._list_items_by_type")
    @patch("flask_api.services.menu_service.MenuService._list_groups_by_type")
    def test_build_catalog_uses_service_plan_tables_when_available(
        self,
        mock_list_groups,
        mock_list_items,
        mock_list_service_plan_sections,
    ):
        mock_list_groups.side_effect = [
            [
                {"key": "entree", "name": "Entree"},
                {"key": "signature_protein", "name": "Signature Protein"},
                {"key": "side", "name": "Side"},
                {"key": "salad", "name": "Salad"},
            ],
            [
                {"key": "passed_appetizer", "name": "Passed Appetizer"},
                {"key": "starter", "name": "Starter"},
                {"key": "entree", "name": "Entree"},
                {"key": "side", "name": "Side"},
            ],
        ]
        mock_list_items.side_effect = [
            [
                {
                    "id": 1,
                    "name": "Braised Beef",
                    "group": {"key": "entree"},
                    "half_tray_price": 120.0,
                    "full_tray_price": 220.0,
                },
                {
                    "id": 2,
                    "name": "Rice Pilaf",
                    "group": {"key": "side"},
                    "half_tray_price": 55.0,
                    "full_tray_price": 95.0,
                },
                {
                    "id": 3,
                    "name": "Caesar Salad",
                    "group": {"key": "salad"},
                    "half_tray_price": 45.0,
                    "full_tray_price": 80.0,
                },
            ],
            [
                {
                    "id": 10,
                    "name": "Mini Tart",
                    "group": {"key": "passed_appetizer"},
                },
                {
                    "id": 11,
                    "name": "Seasonal Soup",
                    "group": {"key": "starter"},
                },
                {
                    "id": 12,
                    "name": "Filet Mignon",
                    "group": {"key": "entree"},
                },
                {
                    "id": 13,
                    "name": "Duchess Potatoes",
                    "group": {"key": "side"},
                },
            ],
        ]
        mock_list_service_plan_sections.side_effect = [
            (
                {
                    "sections": [
                        {
                            "id": 1,
                            "section_key": "catering_packages",
                            "public_section_id": "catering_packages",
                            "section_type": "packages",
                            "title": "Catering Packages",
                            "note": "Per-person catering package offerings.",
                            "is_active": True,
                            "plans": [
                                {
                                    "id": 21,
                                    "plan_key": "catering:taco_bar",
                                    "title": "Taco Bar",
                                    "price": "$18-$25 per person",
                                    "price_meta": {
                                        "amount_min": "18.00",
                                        "amount_max": "25.00",
                                        "currency": "USD",
                                        "unit": "per_person",
                                    },
                                    "selection_mode": "custom_options",
                                    "is_active": True,
                                    "constraints": [{"selection_key": "entree", "min_select": 1, "max_select": 1}],
                                    "details": [{"detail_text": "Spanish rice"}],
                                    "selection_groups": [
                                        {
                                            "group_key": "entree",
                                            "group_title": "Taco Bar Proteins",
                                            "source_type": "custom_options",
                                            "min_select": 1,
                                            "max_select": 1,
                                            "options": [{"option_key": "chicken", "option_label": "Chicken"}],
                                        }
                                    ],
                                },
                            ],
                            "include_keys": [],
                        },
                        {
                            "id": 2,
                            "section_key": "catering_menu_options",
                            "public_section_id": "catering_menu_options",
                            "section_type": "include_menu",
                            "title": "Menu Options",
                            "note": "Choose from the listed menu groups.",
                            "is_active": True,
                            "plans": [],
                            "include_keys": ["entree", "side", "salad"],
                        },
                    ]
                },
                200,
            ),
            (
                {
                    "sections": [
                        {
                            "id": 3,
                            "section_key": "formal_packages",
                            "public_section_id": "formal_packages",
                            "section_type": "packages",
                            "title": "Formal Dinner Packages",
                            "note": None,
                            "is_active": True,
                            "plans": [
                                {
                                    "id": 31,
                                    "plan_key": "formal:2-course",
                                    "title": "Two-Course Dinner",
                                    "price": "$65-$90 per person",
                                    "price_meta": None,
                                    "is_active": False,
                                    "constraints": [],
                                    "details": [],
                                },
                                {
                                    "id": 32,
                                    "plan_key": "formal:3-course",
                                    "title": "Three-Course Dinner",
                                    "price": "$75-$110+ per person",
                                    "price_meta": {
                                        "amount_min": "75.00",
                                        "amount_max": "110.00",
                                        "currency": "USD",
                                        "unit": "per_person",
                                    },
                                    "selection_mode": "menu_groups",
                                    "is_active": True,
                                    "constraints": [{"selection_key": "passed", "min_select": 2, "max_select": 2}],
                                    "details": [{"detail_text": "2 Passed Appetizers"}],
                                    "selection_groups": [],
                                },
                            ],
                            "include_keys": [],
                        },
                    ]
                },
                200,
            ),
        ]

        payload = MenuService._build_catalog_payload_from_simplified_tables()

        self.assertEqual(
            payload["formal_plan_options"],
            [
                {
                    "id": "formal:3-course",
                    "planId": "formal:3-course",
                    "sectionId": "formal_packages",
                    "title": "Three-Course Dinner",
                    "price": "$75-$110+ per person",
                    "details": ["2 Passed Appetizers"],
                    "constraints": {"passed": {"min": 2, "max": 2}},
                    "selectionMode": "menu_groups",
                    "selectionGroups": [],
                    "isActive": True,
                    "priceMeta": {"amountMin": "75.00", "amountMax": "110.00", "currency": "USD", "unit": "per_person"},
                }
            ],
        )
        self.assertEqual(payload["menu"]["catering"]["sections"][0]["type"], "packages")
        self.assertEqual(payload["menu"]["catering"]["sections"][0]["packages"][0]["planId"], "catering:taco_bar")
        self.assertEqual(payload["menu"]["catering"]["sections"][0]["packages"][0]["details"], ["Spanish rice"])
        self.assertEqual(payload["menu"]["catering"]["sections"][0]["packages"][0]["selectionMode"], "custom_options")
        self.assertEqual(payload["menu"]["catering"]["sections"][1]["includeKeys"], ["entree", "side", "salad"])


if __name__ == "__main__":
    unittest.main()
