from pathlib import Path
from urllib.parse import unquote, urlparse

from flask_api.models.slide import Slide


class GalleryService:
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
    VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}
    GALLERY_ASSET_DIR = Path(__file__).resolve().parent.parent / "static" / "slides"
    DEFAULT_SLIDE_TITLE = "Post 468 Catering"
    DEFAULT_SLIDE_TEXT = "Photos and videos from events, service, and community programs."

    @classmethod
    def _infer_media_type(cls, filename):
        extension = Path(filename).suffix.lower()
        if extension in cls.VIDEO_EXTENSIONS:
            return "video"
        if extension in cls.IMAGE_EXTENSIONS:
            return "image"
        return None

    @classmethod
    def _asset_filename_from_url(cls, image_url):
        if not image_url:
            return ""
        parsed = urlparse(image_url)
        return unquote(Path(parsed.path).name)

    @classmethod
    def _resolve_asset_filename(cls, filename):
        if not filename or not cls.GALLERY_ASSET_DIR.exists():
            return filename

        exact_path = cls.GALLERY_ASSET_DIR / filename
        if exact_path.exists():
            return filename

        lowered_filename = filename.lower()
        matches = sorted(
            (
                asset_path.name
                for asset_path in cls.GALLERY_ASSET_DIR.iterdir()
                if asset_path.is_file() and asset_path.name.lower().endswith(lowered_filename)
            ),
            key=lambda name: (len(name), name.lower()),
        )
        return matches[0] if matches else filename

    @classmethod
    def _normalize_text(cls, value):
        return str(value or "").strip()

    @classmethod
    def _is_filename_like(cls, text, filename):
        normalized = cls._normalize_text(text).lower()
        if not normalized:
            return False
        reference_name = cls._normalize_text(filename).lower()
        reference_stem = Path(reference_name).stem if reference_name else ""
        if normalized in {reference_name, reference_stem}:
            return True
        return bool(Path(normalized).suffix.lower())

    @classmethod
    def _build_slide_title(cls, raw_title, filename):
        normalized_title = cls._normalize_text(raw_title)
        if not normalized_title or cls._is_filename_like(normalized_title, filename):
            return cls.DEFAULT_SLIDE_TITLE
        return normalized_title

    @classmethod
    def _build_slide_text(cls, raw_caption, filename):
        normalized_caption = cls._normalize_text(raw_caption)
        if not normalized_caption or cls._is_filename_like(normalized_caption, filename):
            return cls.DEFAULT_SLIDE_TEXT
        return normalized_caption

    @classmethod
    def get_gallery_items(cls):
        db_rows = Slide.get_active_media_rows()
        rows_by_filename = {}
        for row in db_rows:
            candidate_filename = cls._resolve_asset_filename(cls._asset_filename_from_url(row.get("image_url")))
            if candidate_filename:
                rows_by_filename[candidate_filename] = row

        if not cls.GALLERY_ASSET_DIR.exists():
            return []

        gallery_items = []
        for asset_path in sorted(cls.GALLERY_ASSET_DIR.iterdir(), key=lambda path: path.name.lower()):
            if not asset_path.is_file():
                continue

            media_type = cls._infer_media_type(asset_path.name)
            if media_type is None:
                continue

            row = rows_by_filename.get(asset_path.name, {})
            item_id = row.get("id", f"asset:{asset_path.name}")
            slide_title = cls._build_slide_title(row.get("title"), asset_path.name)
            slide_text = cls._build_slide_text(row.get("caption"), asset_path.name)
            caption = cls._normalize_text(row.get("caption"))
            alt_text = cls._normalize_text(row.get("alt_text")) or slide_title
            if cls._is_filename_like(alt_text, asset_path.name):
                alt_text = slide_title
            resolved_media_type = row.get("media_type") or media_type
            source_url = f"/api/assets/slides/{asset_path.name}"

            gallery_items.append(
                {
                    "id": item_id,
                    "src": source_url,
                    "thumbnail_src": source_url,
                    "filename": asset_path.name,
                    "title": slide_title,
                    "slide_title": slide_title,
                    "slide_text": slide_text,
                    "caption": caption,
                    "text": slide_text,
                    "alt": alt_text,
                    "alt_text": alt_text,
                    "display_order": row.get("display_order"),
                    "is_slide": bool(row.get("is_slide", 0)),
                    "media_type": resolved_media_type,
                }
            )

        return gallery_items
