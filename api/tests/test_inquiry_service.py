import smtplib
import socket
import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.inquiry_service import InquiryService  # noqa: E402


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

    @patch("flask_api.services.inquiry_service.query_db")
    def test_get_confirmation_email_content_uses_db_config(self, mock_query_db):
        mock_query_db.return_value = {
            "config_json": {
                "confirmation_subject": "Custom Subject",
                "owner_note": "Custom owner note.",
            }
        }
        subject, note = InquiryService._get_confirmation_email_content()
        self.assertEqual(subject, "Custom Subject")
        self.assertEqual(note, "Custom owner note.")

    def test_build_owner_email_sets_reply_to_customer(self):
        inquiry = SimpleNamespace(
            id=42,
            full_name="Taylor Client",
            email="taylor@example.com",
            phone="(212) 555-1212",
            event_type="Wedding",
            event_date=str(date(2026, 6, 15)),
            guest_count=50,
            budget="$2,500-$5,000",
            service_interest="Community Catering",
            service_selection={"level": "tier", "title": "Tier 2", "price": "$45-$65 per person"},
            desired_menu_items=[
                {"name": "Jerk Chicken", "category": "entree", "tray_size": "Half", "tray_price": "$85"}
            ],
            message="Please include setup.",
        )
        message = InquiryService._build_owner_email(
            inquiry=inquiry,
            submitted_at_utc="2026-02-19T20:00:00Z",
            inquiry_from_email="sender@example.com",
            inquiry_to_email="owner@example.com",
        )
        body = message.get_body(preferencelist=("plain",)).get_content()
        self.assertEqual(message["Reply-To"], "taylor@example.com")
        self.assertNotIn("Inquiry ID", body)
        self.assertIn("Submitted Date: Thursday, February 19, 2026", body)
        self.assertIn("Event Date: Monday, June 15, 2026", body)
        self.assertIn("POST 468 CATERING INQUIRY", body)
        self.assertIn("Entree/Protein:", body)
        self.assertIn("- Jerk Chicken (Tray: Half, Price: $85)", body)
        self.assertIn("Budget: $2,500-$5,000", body)
        self.assertIn("CONTACT", body)
        self.assertIsNotNone(message.get_body(preferencelist=("html",)))

    def test_build_confirmation_email_sets_reply_to_owner_and_placeholder_note(self):
        inquiry = SimpleNamespace(
            id=43,
            full_name="Taylor Client",
            email="taylor@example.com",
            phone="(212) 555-1212",
            event_type="Wedding",
            event_date=str(date(2026, 6, 15)),
            guest_count=50,
            budget="$2,500-$5,000",
            service_interest="Community Catering",
            service_selection={},
            desired_menu_items=[
                {"name": "Jerk Chicken", "category": "entree"},
                {"name": "Garden Salad", "category": "salads"},
            ],
            message="Please include setup.",
        )
        message = InquiryService._build_customer_confirmation_email(
            inquiry=inquiry,
            submitted_at_utc="2026-02-19T20:00:00Z",
            inquiry_from_email="sender@example.com",
            reply_to_email="owner@example.com",
            owner_note="[PLACEHOLDER_OWNER_NOTE]",
            confirmation_subject="We received your catering inquiry",
        )
        body = message.get_body(preferencelist=("plain",)).get_content()
        self.assertEqual(message["Reply-To"], "owner@example.com")
        self.assertNotIn("Inquiry ID", body)
        self.assertIn("Submitted Date: Thursday, February 19, 2026", body)
        self.assertIn(
            "- Event Date: Monday, June 15, 2026 (*Event time of day will be clarified later by our catering staff.*)",
            body,
        )
        self.assertIn("Entree/Protein:", body)
        self.assertIn("Salads:", body)
        self.assertNotIn("A note from the site owner:", body)
        self.assertIn("[PLACEHOLDER_OWNER_NOTE]", body)
        self.assertIsNotNone(message.get_body(preferencelist=("html",)))

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

    @patch("flask_api.services.inquiry_service.Inquiry.from_payload")
    @patch("flask_api.services.inquiry_service.InquiryAbuseGuard.evaluate")
    @patch("flask_api.services.inquiry_service.InquiryAbuseGuard.record_successful_submission")
    def test_submit_returns_500_and_does_not_record_duplicate_on_save_failure(
        self,
        mock_record_successful_submission,
        mock_abuse_evaluate,
        mock_from_payload,
    ):
        def _save_raises():
            raise RuntimeError("db unavailable")

        mock_from_payload.return_value = SimpleNamespace(
            id=None,
            full_name="Taylor Client",
            email="taylor@example.com",
            service_selection={},
            desired_menu_items=[],
            message="",
            validate=lambda: [],
            save=_save_raises,
        )
        mock_abuse_evaluate.return_value = {
            "allow": True,
            "status_code": 200,
            "warning": None,
            "warning_code": None,
            "silent_accept": False,
            "alert": False,
            "meta": {"duplicate_key": "dupe-key"},
        }

        body, status_code = InquiryService.submit({}, client_ip="1.2.3.4", user_agent="ua")
        self.assertEqual(status_code, 500)
        self.assertEqual(body, {"errors": ["Unable to process inquiry right now. Please try again later."]})
        mock_record_successful_submission.assert_not_called()


if __name__ == "__main__":
    unittest.main()
