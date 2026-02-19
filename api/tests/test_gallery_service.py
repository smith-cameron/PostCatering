import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.gallery_service import GalleryService  # noqa: E402


class GalleryServiceTests(unittest.TestCase):
    def test_get_gallery_items_merges_static_assets_with_slide_flags(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            image_path = Path(temp_dir) / "5gallery-photo.jpg"
            video_path = Path(temp_dir) / "events-reel.mp4"
            image_path.write_bytes(b"img")
            video_path.write_bytes(b"video")

            with patch.object(GalleryService, "GALLERY_ASSET_DIR", Path(temp_dir)):
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
                        }
                    ]

                    items = GalleryService.get_gallery_items()

        by_filename = {item["filename"]: item for item in items}
        self.assertEqual(len(items), 2)
        self.assertTrue(by_filename["5gallery-photo.jpg"]["is_slide"])
        self.assertEqual(by_filename["5gallery-photo.jpg"]["id"], 99)
        self.assertEqual(by_filename["events-reel.mp4"]["media_type"], "video")
        self.assertFalse(by_filename["events-reel.mp4"]["is_slide"])


if __name__ == "__main__":
    unittest.main()
