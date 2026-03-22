import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.models.menu import Menu  # noqa: E402


class MenuConstraintNormalizationTests(unittest.TestCase):
    def test_get_effective_service_constraints_for_catering_buffet_plan(self):
        constraints = Menu.get_effective_service_constraints({"id": "catering:buffet_tier_2"})
        self.assertEqual(constraints.get("entree_signature_protein"), {"min": 2, "max": 3})
        self.assertEqual(constraints.get("sides_salads"), {"min": 5, "max": 5})

    def test_get_effective_service_constraints_for_catering_buffet_package_title(self):
        constraints = Menu.get_effective_service_constraints(
            {"sectionId": "catering_buffet_packages", "title": "Tier 2: Elevated Buffet / Family-Style"}
        )
        self.assertEqual(constraints.get("sides_salads"), {"min": 5, "max": 5})

    def test_get_effective_service_constraints_for_formal_plan(self):
        constraints = Menu.get_effective_service_constraints({"id": "formal:3-course"})
        self.assertEqual(constraints.get("passed"), {"min": 2, "max": 2})
        self.assertEqual(constraints.get("starter"), {"min": 1, "max": 1})
        self.assertEqual(constraints.get("entree"), {"min": 1, "max": 2})

    def test_get_effective_service_constraints_prefers_payload_constraints(self):
        constraints = Menu.get_effective_service_constraints(
            {
                "id": "formal:2-course",
                "constraints": {
                    "starter": {"min": 2, "max": 2},
                    "entree": {"min": 3, "max": 3},
                },
            }
        )
        self.assertEqual(constraints.get("starter"), {"min": 2, "max": 2})
        self.assertEqual(constraints.get("entree"), {"min": 3, "max": 3})

    def test_get_effective_service_constraints_for_homestyle_package(self):
        constraints = Menu.get_effective_service_constraints(
            {"sectionId": "catering_packages", "title": "Hearty Homestyle Packages"}
        )
        self.assertEqual(constraints.get("entree_signature_protein"), {"min": 1, "max": 1})
        self.assertEqual(constraints.get("sides_salads"), {"min": 2, "max": 2})

    def test_get_effective_service_constraints_preserves_specific_catering_payload_groups(self):
        constraints = Menu.get_effective_service_constraints(
            {
                "id": "catering:custom_package",
                "constraints": {
                    "entree": {"min": 1, "max": 1},
                    "salads": {"min": 1, "max": 1},
                },
            }
        )
        self.assertEqual(constraints.get("entree"), {"min": 1, "max": 1})
        self.assertEqual(constraints.get("salads"), {"min": 1, "max": 1})


if __name__ == "__main__":
    unittest.main()
