import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pymysql.err import OperationalError

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.models.slide import Slide  # noqa: E402


class SlideModelTests(unittest.TestCase):
    @patch("flask_api.models.slide.query_db")
    def test_get_active_queries_only_slide_flagged_records(self, mock_query_db):
        mock_query_db.return_value = []

        Slide.get_active()

        mock_query_db.assert_called_once()
        query = mock_query_db.call_args.args[0]
        self.assertIn("WHERE is_active = 1", query)
        self.assertIn("AND is_slide = 1", query)

    @patch("flask_api.models.slide.query_db")
    def test_get_active_dicts_exposes_is_slide_and_media_type(self, mock_query_db):
        mock_query_db.return_value = [
            {
                "id": 7,
                "title": "Main hall",
                "caption": "Dinner setup",
                "image_url": "/api/assets/slides/IMG_8709.jpg",
                "alt_text": "Main hall dinner setup",
                "display_order": 2,
                "is_slide": 1,
                "media_type": "image",
            }
        ]

        slides = Slide.get_active_dicts()

        self.assertEqual(len(slides), 1)
        self.assertTrue(slides[0]["is_slide"])
        self.assertEqual(slides[0]["media_type"], "image")

    @patch("flask_api.models.slide.query_db")
    def test_get_active_falls_back_when_media_columns_are_missing(self, mock_query_db):
        mock_query_db.side_effect = [
            OperationalError(1054, "Unknown column 'media_type' in 'field list'"),
            [
                {
                    "id": 1,
                    "title": "Legacy slide",
                    "caption": "Legacy caption",
                    "image_url": "/api/assets/slides/legacy.jpg",
                    "alt_text": "Legacy",
                    "display_order": 1,
                }
            ],
        ]

        slides = Slide.get_active_dicts()

        self.assertEqual(len(slides), 1)
        self.assertEqual(slides[0]["id"], 1)
        self.assertTrue(slides[0]["is_slide"])
        self.assertEqual(slides[0]["media_type"], "image")
        self.assertEqual(mock_query_db.call_count, 2)

    @patch("flask_api.models.slide.query_db")
    def test_get_active_dicts_resolves_prefixed_asset_filenames(self, mock_query_db):
        with tempfile.TemporaryDirectory() as temp_dir:
            prefixed_asset = Path(temp_dir) / "520231114_152614.jpg"
            prefixed_asset.write_bytes(b"img")

            mock_query_db.return_value = [
                {
                    "id": 1,
                    "title": "Legacy slide",
                    "caption": "Legacy caption",
                    "image_url": "/api/assets/slides/20231114_152614.jpg",
                    "alt_text": "Legacy",
                    "display_order": 1,
                    "is_slide": 1,
                    "media_type": "image",
                }
            ]

            with patch("flask_api.models.slide.SLIDES_ASSET_DIR", Path(temp_dir)):
                slides = Slide.get_active_dicts()

        self.assertEqual(slides[0]["src"], "/api/assets/slides/520231114_152614.jpg")

    @patch("flask_api.models.slide.query_db")
    def test_get_active_dicts_applies_default_title_and_text(self, mock_query_db):
        mock_query_db.return_value = [
            {
                "id": 9,
                "title": "",
                "caption": "",
                "image_url": "/api/assets/slides/blank.jpg",
                "alt_text": "",
                "display_order": 1,
                "is_slide": 1,
                "media_type": "image",
            }
        ]

        slides = Slide.get_active_dicts()

        self.assertEqual(slides[0]["title"], "Post 468 Catering")
        self.assertEqual(slides[0]["text"], "Photos and videos from events, service, and community programs.")
        self.assertEqual(slides[0]["alt"], "Post 468 Catering")

    @patch("flask_api.models.slide.query_db")
    def test_get_active_dicts_replaces_filename_like_title_and_caption(self, mock_query_db):
        mock_query_db.return_value = [
            {
                "id": 10,
                "title": "gallery-photo.jpg",
                "caption": "gallery-photo.jpg",
                "image_url": "/api/assets/slides/gallery-photo.jpg",
                "alt_text": "gallery-photo.jpg",
                "display_order": 1,
                "is_slide": 1,
                "media_type": "image",
            }
        ]

        slides = Slide.get_active_dicts()

        self.assertEqual(slides[0]["title"], "Post 468 Catering")
        self.assertEqual(slides[0]["caption"], "Photos and videos from events, service, and community programs.")
        self.assertEqual(slides[0]["alt"], "Post 468 Catering")


if __name__ == "__main__":
    unittest.main()
