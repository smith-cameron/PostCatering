from pathlib import Path
from urllib.parse import unquote, urlparse

from flask_api.config.mysqlconnection import query_db

SLIDES_ASSET_DIR = Path(__file__).resolve().parent.parent / "static" / "slides"
SLIDE_DEFAULT_TITLE = "Post 468 Catering"
SLIDE_DEFAULT_TEXT = "Photos and videos from events, service, and community programs."
KNOWN_MEDIA_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".avif",
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
    ".ogv",
}


def _is_unknown_column_error(error):
    message = str(error).lower()
    return "unknown column" in message and "1054" in message


def _asset_filename_from_url(image_url):
    if not image_url:
        return ""
    parsed = urlparse(image_url)
    return unquote(Path(parsed.path).name)


def _resolve_slide_asset_filename(filename):
    if not filename or not SLIDES_ASSET_DIR.exists():
        return filename

    exact_path = SLIDES_ASSET_DIR / filename
    if exact_path.exists():
        return filename

    lowered_filename = filename.lower()
    matches = sorted(
        (
            asset_path.name
            for asset_path in SLIDES_ASSET_DIR.iterdir()
            if asset_path.is_file() and asset_path.name.lower().endswith(lowered_filename)
        ),
        key=lambda name: (len(name), name.lower()),
    )
    return matches[0] if matches else filename


def _resolve_image_url(image_url):
    filename = _asset_filename_from_url(image_url)
    resolved_filename = _resolve_slide_asset_filename(filename)
    if not resolved_filename:
        return image_url
    return f"/api/assets/slides/{resolved_filename}"


def _normalize_text(value):
    return str(value or "").strip()


def _is_filename_like(text, filename):
    normalized = _normalize_text(text).lower()
    if not normalized:
        return False
    reference_name = _normalize_text(filename).lower()
    reference_stem = Path(reference_name).stem if reference_name else ""
    if normalized in {reference_name, reference_stem}:
        return True
    suffix = Path(normalized).suffix.lower()
    return bool(suffix and suffix in KNOWN_MEDIA_EXTENSIONS)


def _build_slide_title(raw_title, resolved_filename):
    normalized_title = _normalize_text(raw_title)
    if not normalized_title or _is_filename_like(normalized_title, resolved_filename):
        return SLIDE_DEFAULT_TITLE
    return normalized_title


def _build_slide_text(raw_caption, resolved_filename):
    normalized_caption = _normalize_text(raw_caption)
    if not normalized_caption or _is_filename_like(normalized_caption, resolved_filename):
        return SLIDE_DEFAULT_TEXT
    return normalized_caption


class Slide:
    def __init__(
        self,
        slide_id,
        title,
        caption,
        image_url,
        alt_text,
        display_order,
        is_slide=True,
        media_type="image",
    ):
        self.id = slide_id
        self.title = title
        self.caption = caption
        self.image_url = image_url
        self.alt_text = alt_text
        self.display_order = display_order
        self.is_slide = bool(is_slide)
        self.media_type = media_type or "image"

    def to_dict(self):
        resolved_image_url = _resolve_image_url(self.image_url)
        resolved_filename = _asset_filename_from_url(resolved_image_url)
        resolved_title = _build_slide_title(self.title, resolved_filename)
        resolved_caption = _build_slide_text(self.caption, resolved_filename)
        resolved_alt = _normalize_text(self.alt_text)
        if not resolved_alt or _is_filename_like(resolved_alt, resolved_filename):
            resolved_alt = resolved_title
        return {
            "id": self.id,
            "src": resolved_image_url,
            "alt": resolved_alt,
            "title": resolved_title,
            "text": resolved_caption,
            "display_order": self.display_order,
            "image_url": resolved_image_url,
            "alt_text": resolved_alt,
            "caption": resolved_caption,
            "is_slide": self.is_slide,
            "media_type": self.media_type,
        }

    @classmethod
    def get_active(cls):
        query = """
          SELECT
            id,
            title,
            caption,
            image_url,
            media_type,
            alt_text,
            display_order,
            is_slide
          FROM slides
          WHERE is_active = 1
            AND is_slide = 1
          ORDER BY display_order ASC, id ASC;
        """
        try:
            rows = query_db(query)
        except Exception as error:
            if not _is_unknown_column_error(error):
                raise
            legacy_query = """
              SELECT
                id,
                title,
                caption,
                image_url,
                alt_text,
                display_order
              FROM slides
              WHERE is_active = 1
              ORDER BY display_order ASC, id ASC;
            """
            rows = query_db(legacy_query)
        return [
            cls(
                slide_id=row["id"],
                title=row["title"],
                caption=row["caption"],
                image_url=row["image_url"],
                alt_text=row["alt_text"],
                display_order=row["display_order"],
                is_slide=row.get("is_slide", 1),
                media_type=row.get("media_type", "image"),
            )
            for row in rows
        ]

    @classmethod
    def get_active_dicts(cls):
        return [slide.to_dict() for slide in cls.get_active()]

    @classmethod
    def get_active_media_rows(cls):
        query = """
          SELECT
            id,
            title,
            caption,
            image_url,
            media_type,
            alt_text,
            display_order,
            is_slide
          FROM slides
          WHERE is_active = 1
          ORDER BY display_order ASC, id ASC;
        """
        try:
            return query_db(query)
        except Exception as error:
            if not _is_unknown_column_error(error):
                raise
            legacy_query = """
              SELECT
                id,
                title,
                caption,
                image_url,
                alt_text,
                display_order
              FROM slides
              WHERE is_active = 1
              ORDER BY display_order ASC, id ASC;
            """
            return query_db(legacy_query)
