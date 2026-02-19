import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.inquiry_abuse_guard import InquiryAbuseGuard  # noqa: E402


def _make_inquiry(**overrides):
    base = {
        "full_name": "Jordan Client",
        "email": "jordan@example.com",
        "phone": "(212) 555-1212",
        "event_type": "Wedding",
        "event_date": "2026-06-15",
        "service_interest": "community buffet",
        "message": "Looking for a quote.",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class InquiryAbuseGuardTests(unittest.TestCase):
    def setUp(self):
        InquiryAbuseGuard._ip_events.clear()
        InquiryAbuseGuard._recent_submission_keys.clear()
        InquiryAbuseGuard._blocked_events.clear()

    def test_integrity_field_is_silent_accept(self):
        inquiry = _make_inquiry()
        with patch.dict("os.environ", {"INQUIRY_INTEGRITY_FIELD": "company_website"}, clear=False):
            result = InquiryAbuseGuard.evaluate(
                inquiry=inquiry,
                raw_payload={"company_website": "spam.example"},
                client_ip="1.2.3.4",
                user_agent="bot",
            )
        self.assertFalse(result["allow"])
        self.assertTrue(result["silent_accept"])
        self.assertEqual(result["status_code"], 202)

    def test_rate_limit_per_minute_blocks_excess(self):
        inquiry = _make_inquiry()
        with patch.dict("os.environ", {"INQUIRY_RATE_LIMIT_PER_IP_PER_MINUTE": "1"}, clear=False):
            first = InquiryAbuseGuard.evaluate(inquiry, raw_payload={}, client_ip="9.9.9.9", user_agent="ua")
            second = InquiryAbuseGuard.evaluate(inquiry, raw_payload={}, client_ip="9.9.9.9", user_agent="ua")
        self.assertTrue(first["allow"])
        self.assertFalse(second["allow"])
        self.assertEqual(second["status_code"], 429)
        self.assertEqual(second["warning_code"], "rate_limit_minute")

    def test_duplicate_submission_window_silent_accept(self):
        inquiry = _make_inquiry()
        with patch.dict("os.environ", {"INQUIRY_DUPLICATE_WINDOW_SECONDS": "1200"}, clear=False):
            first = InquiryAbuseGuard.evaluate(inquiry, raw_payload={}, client_ip="5.5.5.5", user_agent="ua")
            duplicate_key = first.get("meta", {}).get("duplicate_key")
            InquiryAbuseGuard.record_successful_submission(duplicate_key)
            second = InquiryAbuseGuard.evaluate(inquiry, raw_payload={}, client_ip="5.5.5.5", user_agent="ua")
        self.assertTrue(first["allow"])
        self.assertFalse(second["allow"])
        self.assertTrue(second["silent_accept"])
        self.assertEqual(second["warning_code"], "duplicate_submission_window")

    def test_blocked_domain_rejected(self):
        inquiry = _make_inquiry(email="person@mailinator.com")
        result = InquiryAbuseGuard.evaluate(inquiry, raw_payload={}, client_ip="4.4.4.4", user_agent="ua")
        self.assertFalse(result["allow"])
        self.assertEqual(result["status_code"], 400)
        self.assertEqual(result["warning_code"], "email_domain_blocked")

    def test_link_threshold_rejected(self):
        inquiry = _make_inquiry(message="https://a.com https://b.com https://c.com")
        with patch.dict("os.environ", {"INQUIRY_MAX_LINKS": "2"}, clear=False):
            result = InquiryAbuseGuard.evaluate(inquiry, raw_payload={}, client_ip="8.8.8.8", user_agent="ua")
        self.assertFalse(result["allow"])
        self.assertEqual(result["warning_code"], "spam_link_threshold")


if __name__ == "__main__":
    unittest.main()
