from flask_api.config.mysqlconnection import query_db


def _is_unknown_column_error(error):
    message = str(error).lower()
    return "unknown column" in message and "1054" in message


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
        normalized_title = str(self.title or "").strip()
        normalized_caption = str(self.caption or "").strip()
        normalized_alt = str(self.alt_text or "").strip() or normalized_title
        return {
            "id": self.id,
            "src": self.image_url,
            "alt": normalized_alt,
            "title": normalized_title,
            "text": normalized_caption,
            "display_order": self.display_order,
            "image_url": self.image_url,
            "alt_text": normalized_alt,
            "caption": normalized_caption,
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
            is_slide,
            created_at
          FROM slides
          WHERE is_active = 1
          ORDER BY created_at DESC, id DESC;
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
              ORDER BY id DESC;
            """
            return query_db(legacy_query)
