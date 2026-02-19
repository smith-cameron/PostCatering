import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import ANY, patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api import app  # noqa: E402
import flask_api.controllers.main_controller  # noqa: E402,F401


class ApiEndpointIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_get_menus_uses_seed_payload_when_menu_data_source_is_seed_file(self):
        with patch.dict("os.environ", {"MENU_DATA_SOURCE": "seed-file"}, clear=False):
            response = self.client.get("/api/menus")

        body = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body.get("source"), "seed-file")
        self.assertIn("menu_options", body)
        self.assertIn("formal_plan_options", body)
        self.assertIn("menu", body)
        self.assertIn("community", body["menu"])
        self.assertIn("page_title", body["menu"]["community"])

    @patch("flask_api.controllers.main_controller.SlideService.get_active_slides")
    def test_get_slides_returns_active_slide_payload(self, mock_get_active_slides):
        mock_get_active_slides.return_value = [
            {
                "id": 11,
                "src": "/api/assets/slides/20231114_152614.jpg",
                "alt": "Service line",
                "title": "Community Dinner",
                "text": "Seasonal favorites",
                "is_slide": True,
                "media_type": "image",
            }
        ]

        response = self.client.get("/api/slides")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            body,
            {
                "slides": [
                    {
                        "id": 11,
                        "src": "/api/assets/slides/20231114_152614.jpg",
                        "alt": "Service line",
                        "title": "Community Dinner",
                        "text": "Seasonal favorites",
                        "is_slide": True,
                        "media_type": "image",
                    }
                ]
            },
        )
        mock_get_active_slides.assert_called_once_with()

    @patch("flask_api.controllers.main_controller.GalleryService.get_gallery_items")
    def test_get_gallery_returns_media_payload(self, mock_get_gallery_items):
        mock_get_gallery_items.return_value = [
            {
                "id": "asset:IMG_8709.jpg",
                "src": "/api/assets/slides/IMG_8709.jpg",
                "media_type": "image",
                "is_slide": False,
            },
            {
                "id": "asset:events-reel.mp4",
                "src": "/api/assets/slides/events-reel.mp4",
                "media_type": "video",
                "is_slide": False,
            },
        ]

        response = self.client.get("/api/gallery")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            body,
            {
                "media": [
                    {
                        "id": "asset:IMG_8709.jpg",
                        "src": "/api/assets/slides/IMG_8709.jpg",
                        "media_type": "image",
                        "is_slide": False,
                    },
                    {
                        "id": "asset:events-reel.mp4",
                        "src": "/api/assets/slides/events-reel.mp4",
                        "media_type": "video",
                        "is_slide": False,
                    },
                ]
            },
        )
        mock_get_gallery_items.assert_called_once_with()

    @patch("flask_api.controllers.main_controller.InquiryService.submit")
    def test_create_inquiry_passes_client_metadata_to_service(self, mock_submit):
        mock_submit.return_value = ({"ok": True}, 201)
        response = self.client.post(
            "/api/inquiries",
            json={"full_name": "Test"},
            headers={
                "X-Forwarded-For": "203.0.113.10, 10.0.0.2",
                "User-Agent": "PostCatering-Test",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json(), {"ok": True})
        mock_submit.assert_called_once()
        args, kwargs = mock_submit.call_args
        self.assertEqual(args[0], {"full_name": "Test"})
        self.assertEqual(kwargs["client_ip"], "203.0.113.10")
        self.assertEqual(kwargs["user_agent"], "PostCatering-Test")

    @patch("flask_api.services.inquiry_service.InquiryAbuseGuard.evaluate", return_value={"allow": True})
    def test_create_inquiry_returns_validation_errors_for_invalid_payload(self, _mock_abuse):
        response = self.client.post("/api/inquiries", json={})
        body = response.get_json()

        self.assertEqual(response.status_code, 400)
        self.assertIn("errors", body)
        self.assertIn("full_name is required.", body["errors"])
        self.assertIn("email is required.", body["errors"])
        self.assertIn("desired_menu_items is required.", body["errors"])

    @patch("flask_api.services.inquiry_service.Inquiry.update_email_sent", autospec=True)
    @patch(
        "flask_api.services.inquiry_service.InquiryService._send_inquiry_notifications",
        return_value={
            "owner_email_sent": True,
            "confirmation_email_sent": True,
            "warning_messages": [],
            "warning_codes": [],
        },
    )
    @patch("flask_api.services.inquiry_service.Inquiry.save", autospec=True)
    @patch("flask_api.services.inquiry_service.InquiryAbuseGuard.evaluate", return_value={"allow": True})
    def test_create_inquiry_valid_payload_returns_created(
        self,
        _mock_abuse,
        mock_save,
        _mock_send_notifications,
        mock_update_email_sent,
    ):
        def fake_save(inquiry):
            inquiry.id = 987
            return inquiry.id

        mock_save.side_effect = fake_save
        payload = {
            "full_name": "Taylor Client",
            "email": "taylor@example.com",
            "phone": "(212) 555-1212",
            "event_type": "Wedding",
            "event_date": (date.today() + timedelta(days=14)).isoformat(),
            "guest_count": 50,
            "budget": "$2,500-$5,000",
            "service_interest": "Community Catering",
            "service_selection": {},
            "desired_menu_items": [{"name": "Jerk Chicken", "category": "entree"}],
            "message": "Please include setup.",
        }

        response = self.client.post("/api/inquiries", json=payload)
        body = response.get_json()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            body,
            {
                "inquiry_id": 987,
                "email_sent": True,
                "owner_email_sent": True,
                "confirmation_email_sent": True,
            },
        )
        mock_save.assert_called_once()
        mock_update_email_sent.assert_called_once_with(ANY, True)


if __name__ == "__main__":
    unittest.main()
