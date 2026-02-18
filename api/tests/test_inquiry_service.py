import sys
import unittest
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
  sys.path.insert(0, str(API_ROOT))

from flask_api.services.inquiry_service import InquiryService


class InquiryServiceFormattingTests(unittest.TestCase):
  def test_format_service_selection(self):
    formatted = InquiryService._format_service_selection(
      {
        "level": "tier",
        "title": "Tier 2: Elevated Buffet / Family-Style",
        "price": "$45-$65 per person",
      }
    )
    self.assertEqual(formatted, "Tier: Tier 2: Elevated Buffet / Family-Style ($45-$65 per person)")

  def test_format_desired_items(self):
    formatted = InquiryService._format_desired_items(
      [
        {"name": "Jerk Chicken", "tray_size": "Half", "tray_price": "$85"},
        {"name": "Garden Salad"},
        "Dinner Rolls",
      ]
    )
    self.assertIn("- Jerk Chicken (Tray: Half, Price: $85)", formatted)
    self.assertIn("- Garden Salad", formatted)
    self.assertIn("- Dinner Rolls", formatted)

  def test_formatters_handle_empty_values(self):
    self.assertEqual(InquiryService._format_service_selection({}), "")
    self.assertEqual(InquiryService._format_desired_items([]), "")


if __name__ == "__main__":
  unittest.main()
