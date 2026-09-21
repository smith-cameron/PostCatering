import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api.services.media_asset_service import Image, MediaAssetService  # noqa: E402


@unittest.skipIf(Image is None, "Pillow is required for thumbnail generation tests.")
class MediaAssetServiceTests(unittest.TestCase):
    def test_thumbnail_url_for_image_url_generates_local_thumbnail(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            media_root = Path(temp_dir)
            source_path = media_root / "hero.jpg"
            with Image.new("RGB", (1800, 1200), "#8e4f2b") as image:
                image.save(source_path, format="JPEG", quality=95)

            with patch.object(MediaAssetService, "LOCAL_MEDIA_DIR", media_root):
                thumbnail_url = MediaAssetService.thumbnail_url_for_image_url("/api/assets/slides/hero.jpg")

            thumbnail_path = media_root / "thumbs" / "hero--jpg.jpg"
            self.assertEqual(thumbnail_url, "/api/assets/slides/thumbs/hero--jpg.jpg")
            self.assertTrue(thumbnail_path.exists())
            self.assertLess(thumbnail_path.stat().st_size, source_path.stat().st_size)

            with Image.open(thumbnail_path) as thumbnail_image:
                self.assertLessEqual(thumbnail_image.size[0], 640)
                self.assertLessEqual(thumbnail_image.size[1], 640)

    def test_thumbnail_url_for_image_url_ignores_external_assets(self):
        thumbnail_url = MediaAssetService.thumbnail_url_for_image_url("https://cdn.example.com/hero.jpg")
        self.assertEqual(thumbnail_url, "https://cdn.example.com/hero.jpg")

    def test_delete_local_asset_bundle_removes_original_and_thumbnail(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            media_root = Path(temp_dir)
            source_path = media_root / "events" / "hero.jpg"
            source_path.parent.mkdir(parents=True, exist_ok=True)
            source_path.write_bytes(b"source-bytes")
            thumbnail_path = media_root / "thumbs" / "events" / "hero--jpg.jpg"
            thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
            thumbnail_path.write_bytes(b"thumb-bytes")

            with patch.object(MediaAssetService, "LOCAL_MEDIA_DIR", media_root):
                result = MediaAssetService.delete_local_asset_bundle(
                    "/api/assets/slides/events/hero.jpg",
                    media_type="image",
                )

            self.assertTrue(result["deleted_original"])
            self.assertTrue(result["deleted_thumbnail"])
            self.assertFalse(source_path.exists())
            self.assertFalse(thumbnail_path.exists())
