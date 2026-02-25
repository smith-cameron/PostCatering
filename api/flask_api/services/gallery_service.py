from flask_api.models.slide import Slide


class GalleryService:
    DEFAULT_TITLE = "placeholder title"
    DEFAULT_TEXT = "placeholder text"

    @classmethod
    def _normalize_text(cls, value):
        return str(value or "").strip()

    @staticmethod
    def _to_order(value, fallback=10**9):
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback

    @classmethod
    def get_gallery_items(cls):
        rows = Slide.get_active_media_rows()
        ordered_rows = sorted(
            rows,
            key=lambda row: (
                0 if bool(row.get("is_slide", 0)) else 1,
                cls._to_order(row.get("display_order")),
                -cls._to_order(row.get("id"), fallback=0),
            ),
        )
        gallery_items = []
        for row in ordered_rows:
            title = cls._normalize_text(row.get("title")) or cls.DEFAULT_TITLE
            caption = cls._normalize_text(row.get("caption")) or cls.DEFAULT_TEXT
            alt_text = cls._normalize_text(row.get("alt_text")) or title
            gallery_items.append(
                {
                    "id": row.get("id"),
                    "src": row.get("image_url"),
                    "thumbnail_src": row.get("image_url"),
                    "title": title,
                    "slide_title": title,
                    "caption": caption,
                    "slide_text": caption,
                    "text": caption,
                    "alt": alt_text,
                    "alt_text": alt_text,
                    "display_order": row.get("display_order"),
                    "is_slide": bool(row.get("is_slide", 0)),
                    "media_type": row.get("media_type") or "image",
                }
            )
        return gallery_items
