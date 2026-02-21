from flask_api.config.mysqlconnection import db_transaction, query_db


class AdminMediaService:
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
    ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}

    @staticmethod
    def _to_bool(value, default=None):
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in ("1", "true", "yes", "on"):
            return True
        if normalized in ("0", "false", "no", "off"):
            return False
        return default

    @staticmethod
    def _to_int(value, default=None, minimum=None, maximum=None):
        try:
            normalized = int(value)
        except (TypeError, ValueError):
            return default
        if minimum is not None and normalized < minimum:
            normalized = minimum
        if maximum is not None and normalized > maximum:
            normalized = maximum
        return normalized

    @classmethod
    def infer_media_type_from_filename(cls, filename):
        lower_name = str(filename or "").strip().lower()
        if "." not in lower_name:
            return None
        ext = lower_name[lower_name.rfind(".") :]
        if ext in cls.ALLOWED_IMAGE_EXTENSIONS:
            return "image"
        if ext in cls.ALLOWED_VIDEO_EXTENSIONS:
            return "video"
        return None

    @classmethod
    def _resequence_slides(cls, connection=None):
        rows = query_db(
            """
      SELECT id, display_order
      FROM slides
      ORDER BY display_order ASC, id ASC;
      """,
            connection=connection,
            auto_commit=False,
        )
        if not rows:
            return

        for index, row in enumerate(rows, start=1):
            query_db(
                """
        UPDATE slides
        SET display_order = %(temp_order)s
        WHERE id = %(id)s;
        """,
                {"temp_order": 1000000 + index, "id": row["id"]},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        for index, row in enumerate(rows, start=1):
            query_db(
                """
        UPDATE slides
        SET display_order = %(display_order)s
        WHERE id = %(id)s;
        """,
                {"display_order": index, "id": row["id"]},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

    @classmethod
    def list_media(cls, search="", media_type="", is_active=None, is_slide=None, limit=400):
        conditions = []
        payload = {"limit": cls._to_int(limit, default=400, minimum=1, maximum=2000)}

        if str(search or "").strip():
            payload["search"] = f"%{str(search).strip()}%"
            conditions.append("(title LIKE %(search)s OR caption LIKE %(search)s OR image_url LIKE %(search)s)")

        normalized_media_type = str(media_type or "").strip().lower()
        if normalized_media_type in ("image", "video"):
            payload["media_type"] = normalized_media_type
            conditions.append("media_type = %(media_type)s")

        is_active_filter = cls._to_bool(is_active, default=None)
        if is_active_filter is not None:
            payload["is_active"] = 1 if is_active_filter else 0
            conditions.append("is_active = %(is_active)s")

        is_slide_filter = cls._to_bool(is_slide, default=None)
        if is_slide_filter is not None:
            payload["is_slide"] = 1 if is_slide_filter else 0
            conditions.append("is_slide = %(is_slide)s")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        rows = query_db(
            f"""
      SELECT
        id,
        title,
        caption,
        image_url,
        media_type,
        alt_text,
        display_order,
        is_slide,
        is_active,
        created_at,
        updated_at
      FROM slides
      {where_clause}
      ORDER BY display_order ASC, id ASC
      LIMIT %(limit)s;
      """,
            payload,
        )

        return [
            {
                "id": row.get("id"),
                "title": str(row.get("title") or "").strip(),
                "caption": str(row.get("caption") or "").strip(),
                "alt_text": str(row.get("alt_text") or "").strip(),
                "src": row.get("image_url"),
                "image_url": row.get("image_url"),
                "media_type": row.get("media_type") or "image",
                "display_order": row.get("display_order"),
                "is_slide": bool(row.get("is_slide", 0)),
                "is_active": bool(row.get("is_active", 0)),
                "created_at": (
                    row.get("created_at").isoformat() if hasattr(row.get("created_at"), "isoformat") else None
                ),
                "updated_at": (
                    row.get("updated_at").isoformat() if hasattr(row.get("updated_at"), "isoformat") else None
                ),
            }
            for row in rows
        ]

    @classmethod
    def get_media_by_id(cls, media_id):
        normalized_media_id = cls._to_int(media_id, minimum=1)
        if not normalized_media_id:
            return None

        row = query_db(
            """
      SELECT
        id,
        title,
        caption,
        image_url,
        media_type,
        alt_text,
        display_order,
        is_slide,
        is_active,
        created_at,
        updated_at
      FROM slides
      WHERE id = %(id)s
      LIMIT 1;
      """,
            {"id": normalized_media_id},
            fetch="one",
        )
        if not row:
            return None
        return {
            "id": row.get("id"),
            "title": str(row.get("title") or "").strip(),
            "caption": str(row.get("caption") or "").strip(),
            "alt_text": str(row.get("alt_text") or "").strip(),
            "src": row.get("image_url"),
            "image_url": row.get("image_url"),
            "media_type": row.get("media_type") or "image",
            "display_order": row.get("display_order"),
            "is_slide": bool(row.get("is_slide", 0)),
            "is_active": bool(row.get("is_active", 0)),
            "created_at": row.get("created_at").isoformat() if hasattr(row.get("created_at"), "isoformat") else None,
            "updated_at": row.get("updated_at").isoformat() if hasattr(row.get("updated_at"), "isoformat") else None,
        }

    @classmethod
    def create_media_record(cls, payload):
        image_url = str((payload or {}).get("image_url") or "").strip()
        media_type = str((payload or {}).get("media_type") or "").strip().lower()
        if not image_url:
            return {"error": "image_url is required."}, 400
        if media_type not in ("image", "video"):
            return {"error": "media_type must be image or video."}, 400

        with db_transaction() as connection:
            next_display_row = query_db(
                """
        SELECT COALESCE(MAX(display_order), 0) + 1 AS next_display_order
        FROM slides;
        """,
                fetch="one",
                connection=connection,
                auto_commit=False,
            )
            next_display_order = cls._to_int(
                (payload or {}).get("display_order"),
                default=next_display_row.get("next_display_order", 1) if next_display_row else 1,
                minimum=1,
            )

            slide_id = query_db(
                """
        INSERT INTO slides (
          title,
          caption,
          image_url,
          media_type,
          alt_text,
          display_order,
          is_slide,
          is_active
        )
        VALUES (
          %(title)s,
          %(caption)s,
          %(image_url)s,
          %(media_type)s,
          %(alt_text)s,
          %(display_order)s,
          %(is_slide)s,
          %(is_active)s
        )
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          title = VALUES(title),
          caption = VALUES(caption),
          media_type = VALUES(media_type),
          alt_text = VALUES(alt_text),
          display_order = VALUES(display_order),
          is_slide = VALUES(is_slide),
          is_active = VALUES(is_active),
          updated_at = CURRENT_TIMESTAMP;
        """,
                {
                    "title": str((payload or {}).get("title") or "").strip() or "placeholder title",
                    "caption": str((payload or {}).get("caption") or "").strip() or "placeholder text",
                    "image_url": image_url,
                    "media_type": media_type,
                    "alt_text": str((payload or {}).get("alt_text") or "").strip()
                    or str((payload or {}).get("title") or "").strip()
                    or "placeholder title",
                    "display_order": next_display_order,
                    "is_slide": 1 if cls._to_bool((payload or {}).get("is_slide"), default=False) else 0,
                    "is_active": 1 if cls._to_bool((payload or {}).get("is_active"), default=True) else 0,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            cls._resequence_slides(connection=connection)

        created = cls.get_media_by_id(slide_id)
        return {"media": created}, 201

    @classmethod
    def update_media(cls, media_id, payload):
        normalized_media_id = cls._to_int(media_id, minimum=1)
        if not normalized_media_id:
            return {"error": "Invalid media id."}, 400

        existing = cls.get_media_by_id(normalized_media_id)
        if not existing:
            return {"error": "Media item not found."}, 404

        with db_transaction() as connection:
            query_db(
                """
        UPDATE slides
        SET
          title = %(title)s,
          caption = %(caption)s,
          alt_text = %(alt_text)s,
          display_order = %(display_order)s,
          is_slide = %(is_slide)s,
          is_active = %(is_active)s,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = %(id)s;
        """,
                {
                    "id": normalized_media_id,
                    "title": (
                        str((payload or {}).get("title") or "").strip()
                        if "title" in (payload or {})
                        else existing["title"]
                    ),
                    "caption": (
                        str((payload or {}).get("caption") or "").strip()
                        if "caption" in (payload or {})
                        else existing["caption"]
                    ),
                    "alt_text": (
                        str((payload or {}).get("alt_text") or "").strip()
                        if "alt_text" in (payload or {})
                        else existing["alt_text"]
                    ),
                    "display_order": cls._to_int(
                        (payload or {}).get("display_order"),
                        default=existing["display_order"],
                        minimum=1,
                    ),
                    "is_slide": 1 if cls._to_bool((payload or {}).get("is_slide"), default=existing["is_slide"]) else 0,
                    "is_active": (
                        1 if cls._to_bool((payload or {}).get("is_active"), default=existing["is_active"]) else 0
                    ),
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            cls._resequence_slides(connection=connection)

        updated = cls.get_media_by_id(normalized_media_id)
        return {"media": updated}, 200
