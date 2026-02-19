from flask_api.models.slide import Slide


class GalleryService:
    DEFAULT_TITLE = "placeholder title"
    DEFAULT_TEXT = "placeholder text"

    @classmethod
    def _normalize_text(cls, value):
        return str(value or "").strip()

    @classmethod
    def get_gallery_items(cls):
        rows = Slide.get_active_media_rows()
        gallery_items = []
        for row in rows:
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
