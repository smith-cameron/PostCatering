import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
  sys.path.insert(0, str(API_ROOT))

from flask_api.models.inquiry import Inquiry
from flask_api.validators.inquiry_validators import (
  normalize_budget,
  normalize_email,
  normalize_phone,
  validate_service_selection_constraints,
  validate_budget,
  validate_email_format,
  validate_phone,
)


class InquiryValidationTests(unittest.TestCase):
  def test_email_normalization_and_validation(self):
    self.assertEqual(normalize_email("  USER.Name+tag@Example.COM  "), "user.name+tag@example.com")
    self.assertIsNone(validate_email_format("user.name+tag@example.com"))
    self.assertEqual(validate_email_format("bad@@example.com"), "email is invalid.")
    self.assertEqual(validate_email_format("user@localhost"), "email is invalid.")

  def test_phone_normalization_and_validation(self):
    self.assertEqual(normalize_phone(" +1 (212) 555-1212 "), "(212) 555-1212")
    self.assertIsNone(validate_phone("(212) 555-1212"))
    self.assertEqual(validate_phone("abc123"), "phone must not contain letters.")
    self.assertEqual(validate_phone("111-555-1212"), "phone must be a valid US phone number.")

  def test_budget_normalization_and_validation(self):
    self.assertEqual(normalize_budget(" 2500 to 5k "), "$2,500-$5,000")
    self.assertEqual(normalize_budget("$2,500"), "$2,500")
    self.assertIsNone(validate_budget("$2,500-$5,000"))
    self.assertEqual(
      validate_budget("cheap"),
      "budget must be a valid amount or range (e.g. $2,500 or $2,500-$5,000).",
    )

  def test_inquiry_from_payload_normalizes_fields(self):
    inquiry = Inquiry.from_payload(
      {
        "full_name": "Taylor Client",
        "email": "  TAYLOR.CLIENT@Example.COM  ",
        "phone": "+1 212.555.1212",
        "event_type": "Birthday",
        "event_date": (date.today() + timedelta(days=14)).isoformat(),
        "guest_count": "35",
        "budget": "2500 - 5000",
        "service_interest": "Dropoff",
        "desired_menu_items": ["Jerk Chicken"],
        "message": " Looking for options ",
      }
    )

    self.assertEqual(inquiry.email, "taylor.client@example.com")
    self.assertEqual(inquiry.phone, "(212) 555-1212")
    self.assertEqual(inquiry.budget, "$2,500-$5,000")
    self.assertEqual(inquiry.message, "Looking for options")
    self.assertEqual(inquiry.validate(), [])

  def test_homestyle_allows_combined_two_sides_or_salads(self):
    errors = validate_service_selection_constraints(
      {
        "level": "package",
        "sectionId": "community_homestyle",
        "title": "Hearty Homestyle Packages",
      },
      [
        {"name": "Jerk Chicken", "category": "entree"},
        {"name": "Green Beans", "category": "sides"},
        {"name": "House Salad", "category": "salads"},
      ],
    )
    self.assertEqual(errors, [])


if __name__ == "__main__":
  unittest.main()
