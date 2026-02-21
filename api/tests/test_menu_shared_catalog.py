import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.models.menu import Menu  # noqa: E402


class MenuSharedCatalogTests(unittest.TestCase):
    def test_collect_item_records_reuses_identity_and_togo_tray_prices(self):
        menu_options = {
            "signatureProteins": {
                "category": "entree",
                "items": ["Braised Short Ribs"],
            }
        }
        menu = {
            "togo": {
                "sections": [
                    {
                        "sectionId": "togo_signature_proteins",
                        "category": "entree",
                        "rows": [["Braised Short Ribs", "$120", "$225"]],
                    }
                ]
            },
            "community": {"sections": []},
        }

        records = Menu._collect_item_records_from_payload(menu_options, menu, [])
        self.assertIn("Braised Short Ribs", records)
        self.assertEqual(len(records), 1)
        self.assertEqual(records["Braised Short Ribs"]["tray_price_half"], "$120")
        self.assertEqual(records["Braised Short Ribs"]["tray_price_full"], "$225")

    def test_collect_item_records_supports_non_togo_items_without_tray_prices(self):
        menu_options = {
            "sidesSalads": {
                "category": "sides_salads",
                "items": ["Garlic Bread / Rolls / Cornbread"],
            }
        }

        records = Menu._collect_item_records_from_payload(menu_options, {"community": {"sections": []}}, [])
        entry = records["Garlic Bread / Rolls / Cornbread"]
        self.assertEqual(entry["item_category"], "sides_salads")
        self.assertIsNone(entry["tray_price_half"])
        self.assertIsNone(entry["tray_price_full"])

    def test_collect_item_records_does_not_materialize_community_tier_summary_bullets(self):
        menu = {
            "community": {
                "sections": [
                    {
                        "sectionId": "community_buffet_tiers",
                        "type": "tiers",
                        "title": "Event Catering - Buffet Style",
                        "tiers": [
                            {
                                "tierTitle": "Tier 1",
                                "bullets": ["2 Entrees", "2 Sides", "1 Salad", "Bread"],
                            }
                        ],
                    }
                ]
            }
        }

        records = Menu._collect_item_records_from_payload({}, menu, [])
        self.assertEqual(records, {})

    def test_collect_item_records_keeps_formal_tier_items_materialized(self):
        menu = {
            "formal": {
                "sections": [
                    {
                        "sectionId": "formal_entree",
                        "courseType": "entree",
                        "type": "tiers",
                        "tiers": [
                            {
                                "tierTitle": "Options",
                                "bullets": ["Braised Short Rib"],
                            }
                        ],
                    }
                ]
            }
        }

        records = Menu._collect_item_records_from_payload({}, menu, [])
        self.assertIn("Braised Short Rib", records)
        self.assertEqual(records["Braised Short Rib"]["item_type"], "entree")

    def test_extract_non_formal_items_accepts_simplified_payload(self):
        payload = {
            "non_formal_items": [
                {
                    "name": "Lumpia",
                    "item_type": "sides_salads",
                    "item_category": "sides",
                    "is_active": True,
                    "tray_prices": {"half": "$55", "full": "$100"},
                }
            ]
        }

        non_formal_items = Menu._extract_non_formal_items_from_payload(payload)
        records = Menu._collect_item_records_from_payload({}, {}, non_formal_items)
        self.assertIn("Lumpia", records)
        self.assertEqual(records["Lumpia"]["item_type"], "sides_salads")
        self.assertEqual(records["Lumpia"]["item_category"], "sides")
        self.assertEqual(records["Lumpia"]["tray_price_half"], "$55")
        self.assertEqual(records["Lumpia"]["tray_price_full"], "$100")

    def test_normalize_non_formal_admin_item_validates_required_name(self):
        normalized, error = Menu._normalize_non_formal_admin_item({}, 0)
        self.assertIsNone(normalized)
        self.assertEqual(error, "items[0].name is required.")

    def test_normalize_non_formal_admin_item_uses_simple_payload_shape(self):
        normalized, error = Menu._normalize_non_formal_admin_item(
            {
                "name": "Jerk Chicken",
                "type": "signature_proteins",
                "category": "entree",
                "active": True,
                "tray_prices": {"half": "$75", "full": "$140"},
            },
            0,
        )
        self.assertIsNone(error)
        self.assertEqual(normalized["item_name"], "Jerk Chicken")
        self.assertEqual(normalized["item_type"], "signature_proteins")
        self.assertEqual(normalized["item_category"], "entree")
        self.assertEqual(normalized["is_active"], 1)
        self.assertEqual(normalized["tray_price_half"], "$75")
        self.assertEqual(normalized["tray_price_full"], "$140")


if __name__ == "__main__":
    unittest.main()
