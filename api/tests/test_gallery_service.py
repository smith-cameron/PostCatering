import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.gallery_service import GalleryService  # noqa: E402


class GalleryServiceTests(unittest.TestCase):
    def test_get_gallery_items_merges_static_assets_with_slide_flags(self):
        with patch("flask_api.services.gallery_service.Slide.get_active_media_rows") as mock_rows:
            mock_rows.return_value = [
                {
                    "id": 99,
                    "title": "Gallery Photo",
                    "caption": "Fresh setup",
                    "image_url": "/api/assets/slides/gallery-photo.jpg",
                    "media_type": "image",
                    "alt_text": "Gallery photo",
                    "display_order": 1,
                    "is_slide": 1,
                },
                {
                    "id": 100,
                    "title": "",
                    "caption": "",
                    "image_url": "/api/assets/slides/event-reel.mp4",
                    "media_type": "video",
                    "alt_text": "",
                    "display_order": 2,
                    "is_slide": 0,
                },
            ]

            items = GalleryService.get_gallery_items()

        self.assertEqual(len(items), 2)
        self.assertTrue(items[0]["is_slide"])
        self.assertEqual(items[0]["id"], 99)
        self.assertEqual(items[1]["media_type"], "video")
        self.assertFalse(items[1]["is_slide"])
        self.assertEqual(items[1]["title"], "placeholder title")
        self.assertEqual(items[1]["slide_text"], "placeholder text")
        self.assertEqual(items[1]["alt"], "placeholder title")


if __name__ == "__main__":
    unittest.main()
