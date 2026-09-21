import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.admin_media_service import AdminMediaService  # noqa: E402


class AdminMediaServiceTests(unittest.TestCase):
    def test_create_media_record_rejects_video_landing_slide(self):
        response_body, status_code = AdminMediaService.create_media_record(
            {
                "title": "Event Reel",
                "caption": "Fast-paced event recap",
                "image_url": "/api/assets/slides/event-reel.mp4",
                "media_type": "video",
                "is_slide": True,
            }
        )

        self.assertEqual(status_code, 400)
        self.assertEqual(response_body, {"error": "Only images can be used as landing slides."})

    @patch("flask_api.services.admin_media_service.AdminMediaService.get_media_by_id")
    def test_update_media_rejects_video_landing_slide(self, mock_get_media_by_id):
        mock_get_media_by_id.return_value = {
            "id": 44,
            "title": "Event Reel",
            "caption": "Fast-paced event recap",
            "src": "/api/assets/slides/event-reel.mp4",
            "image_url": "/api/assets/slides/event-reel.mp4",
            "media_type": "video",
            "display_order": 1,
            "is_slide": False,
            "is_active": True,
        }

        response_body, status_code = AdminMediaService.update_media(44, {"is_slide": True})

        self.assertEqual(status_code, 400)
        self.assertEqual(response_body, {"error": "Only images can be used as landing slides."})

    @patch("flask_api.services.admin_media_service.MediaAssetService.delete_local_asset_bundle")
    @patch("flask_api.services.admin_media_service.query_db")
    @patch("flask_api.services.admin_media_service.db_transaction")
    @patch("flask_api.services.admin_media_service.AdminMediaService.get_media_by_id")
    @patch("flask_api.services.admin_media_service.AdminMediaService._resequence_group")
    def test_delete_media_removes_local_asset_bundle(
        self,
        mock_resequence_group,
        mock_get_media_by_id,
        mock_db_transaction,
        mock_query_db,
        mock_delete_local_asset_bundle,
    ):
        mock_get_media_by_id.return_value = {
            "id": 44,
            "title": "Gallery Photo",
            "caption": "Fresh setup",
            "src": "/api/assets/slides/gallery-photo.jpg",
            "image_url": "/api/assets/slides/gallery-photo.jpg",
            "media_type": "image",
            "display_order": 1,
            "is_slide": False,
            "is_active": True,
        }
        mock_db_transaction.return_value = MagicMock()

        response_body, status_code = AdminMediaService.delete_media(44)

        self.assertEqual(status_code, 200)
        self.assertEqual(response_body["deleted_media_id"], 44)
        mock_query_db.assert_called_once()
        mock_resequence_group.assert_called_once()
        mock_delete_local_asset_bundle.assert_called_once_with(
            "/api/assets/slides/gallery-photo.jpg",
            media_type="image",
        )
