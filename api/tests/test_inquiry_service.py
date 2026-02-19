import smtplib
import socket
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

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

  def test_diagnose_smtp_failure_auth(self):
    exc = smtplib.SMTPAuthenticationError(535, b"5.7.8 bad credentials")
    diagnosis = InquiryService._diagnose_smtp_failure(exc)
    self.assertEqual(diagnosis["reason_code"], "smtp_auth_failed")
    self.assertIn("authentication", diagnosis["warning"].lower())

  def test_diagnose_smtp_failure_timeout(self):
    diagnosis = InquiryService._diagnose_smtp_failure(socket.timeout("timed out"))
    self.assertEqual(diagnosis["reason_code"], "smtp_timeout")
    self.assertIn("timed out", diagnosis["warning"].lower())

  def test_diagnose_smtp_failure_generic(self):
    diagnosis = InquiryService._diagnose_smtp_failure(RuntimeError("boom"))
    self.assertEqual(diagnosis["reason_code"], "email_send_failed")

  @patch("flask_api.services.inquiry_service.Inquiry.from_payload")
  @patch("flask_api.services.inquiry_service.InquiryAbuseGuard.evaluate")
  def test_submit_returns_error_on_abuse_block(self, mock_abuse_evaluate, mock_from_payload):
    mock_from_payload.return_value = SimpleNamespace(
      service_selection={},
      desired_menu_items=[],
      message="",
      validate=lambda: [],
    )
    mock_abuse_evaluate.return_value = {
      "allow": False,
      "status_code": 429,
      "warning": "Please wait before submitting another inquiry.",
      "warning_code": "rate_limit_minute",
      "silent_accept": False,
      "alert": False,
      "meta": {"ip_hash": "abc", "user_agent_hash": "def"},
    }

    body, status_code = InquiryService.submit({}, client_ip="1.2.3.4", user_agent="ua")
    self.assertEqual(status_code, 429)
    self.assertEqual(body, {"errors": ["Please wait before submitting another inquiry."]})

  @patch("flask_api.services.inquiry_service.Inquiry.from_payload")
  @patch("flask_api.services.inquiry_service.InquiryAbuseGuard.evaluate")
  def test_submit_silent_accept_on_abuse_soft_block(self, mock_abuse_evaluate, mock_from_payload):
    mock_from_payload.return_value = SimpleNamespace(
      service_selection={},
      desired_menu_items=[],
      message="",
      validate=lambda: [],
    )
    mock_abuse_evaluate.return_value = {
      "allow": False,
      "status_code": 202,
      "warning": None,
      "warning_code": "duplicate_submission_window",
      "silent_accept": True,
      "alert": False,
      "meta": {"ip_hash": "abc", "user_agent_hash": "def"},
    }

    body, status_code = InquiryService.submit({}, client_ip="1.2.3.4", user_agent="ua")
    self.assertEqual(status_code, 202)
    self.assertEqual(body, {"inquiry_id": None, "email_sent": False})


if __name__ == "__main__":
  unittest.main()
