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
    def _apply_display_order_sequence(cls, ordered_ids, connection=None):
        normalized_ids = [cls._to_int(value, minimum=1) for value in ordered_ids or []]
        normalized_ids = [value for value in normalized_ids if value]
        if not normalized_ids:
            return

        for index, slide_id in enumerate(normalized_ids, start=1):
            query_db(
                """
        UPDATE slides
        SET display_order = %(temp_order)s
        WHERE id = %(id)s;
        """,
                {"temp_order": 1000000 + index, "id": slide_id},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        for index, slide_id in enumerate(normalized_ids, start=1):
            query_db(
                """
        UPDATE slides
        SET display_order = %(display_order)s
        WHERE id = %(id)s;
        """,
                {"display_order": index, "id": slide_id},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

    @classmethod
    def _list_group_ids(cls, is_slide, connection=None):
        rows = query_db(
            """
      SELECT id
      FROM slides
      WHERE is_slide = %(is_slide)s
      ORDER BY display_order ASC, id ASC;
      """,
            {"is_slide": 1 if cls._to_bool(is_slide, default=False) else 0},
            connection=connection,
            auto_commit=False,
        )
        return [cls._to_int(row.get("id"), minimum=1) for row in rows or [] if cls._to_int(row.get("id"), minimum=1)]

    @classmethod
    def _resequence_group(cls, is_slide, connection=None, leading_ids=None):
        current_ids = cls._list_group_ids(is_slide=is_slide, connection=connection)
        if not current_ids:
            return []
        if leading_ids:
            normalized_leading = [cls._to_int(value, minimum=1) for value in leading_ids]
            normalized_leading = [value for value in normalized_leading if value]
            current_set = set(current_ids)
            ordered_leading = []
            seen = set()
            for media_id in normalized_leading:
                if media_id in current_set and media_id not in seen:
                    ordered_leading.append(media_id)
                    seen.add(media_id)
            ordered_ids = ordered_leading + [media_id for media_id in current_ids if media_id not in seen]
        else:
            ordered_ids = current_ids
        cls._apply_display_order_sequence(ordered_ids, connection=connection)
        return ordered_ids

    @classmethod
    def _resequence_slides(cls, connection=None):
        return cls._resequence_group(is_slide=True, connection=connection)

    @classmethod
    def _next_group_display_order(cls, is_slide, connection=None):
        next_display_row = query_db(
            """
      SELECT COALESCE(MAX(display_order), 0) + 1 AS next_display_order
      FROM slides
      WHERE is_slide = %(is_slide)s;
      """,
            {"is_slide": 1 if cls._to_bool(is_slide, default=False) else 0},
            fetch="one",
            connection=connection,
            auto_commit=False,
        )
        return cls._to_int(
            (next_display_row or {}).get("next_display_order"),
            default=1,
            minimum=1,
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
      ORDER BY
        CASE WHEN is_slide = 1 THEN 0 ELSE 1 END ASC,
        display_order ASC,
        id DESC
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
            resolved_is_slide = cls._to_bool((payload or {}).get("is_slide"), default=False)
            next_display_order = cls._to_int(
                (payload or {}).get("display_order"),
                default=cls._next_group_display_order(is_slide=True, connection=connection) if resolved_is_slide else 1,
                minimum=1,
            )
            resolved_title = str((payload or {}).get("title") or "").strip() or "placeholder title"
            resolved_caption = str((payload or {}).get("caption") or "").strip() or "placeholder text"

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
                    "title": resolved_title,
                    "caption": resolved_caption,
                    "image_url": image_url,
                    "media_type": media_type,
                    "alt_text": resolved_title,
                    "display_order": next_display_order,
                    "is_slide": 1 if resolved_is_slide else 0,
                    "is_active": 1 if cls._to_bool((payload or {}).get("is_active"), default=True) else 0,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            if resolved_is_slide:
                cls._resequence_group(is_slide=True, connection=connection)
            else:
                cls._resequence_group(is_slide=False, connection=connection, leading_ids=[slide_id])

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

        resolved_title = (
            str((payload or {}).get("title") or "").strip()
            if "title" in (payload or {})
            else existing["title"]
        )
        resolved_caption = (
            str((payload or {}).get("caption") or "").strip()
            if "caption" in (payload or {})
            else existing["caption"]
        )

        with db_transaction() as connection:
            is_slide_explicit = "is_slide" in (payload or {})
            display_order_explicit = "display_order" in (payload or {})
            next_is_slide = cls._to_bool((payload or {}).get("is_slide"), default=existing["is_slide"])
            moved_from_slide_to_gallery = existing["is_slide"] and not next_is_slide
            next_display_order = cls._to_int(
                (payload or {}).get("display_order"),
                default=existing["display_order"],
                minimum=1,
            )
            if next_is_slide and not existing["is_slide"] and not display_order_explicit:
                next_display_order = cls._next_group_display_order(is_slide=True, connection=connection)
            if not next_is_slide and existing["is_slide"] and not display_order_explicit:
                next_display_order = 1

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
                    "title": resolved_title,
                    "caption": resolved_caption,
                    "alt_text": resolved_title,
                    "display_order": next_display_order,
                    "is_slide": 1 if next_is_slide else 0,
                    "is_active": (
                        1 if cls._to_bool((payload or {}).get("is_active"), default=existing["is_active"]) else 0
                    ),
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            if moved_from_slide_to_gallery and not display_order_explicit:
                cls._resequence_group(is_slide=False, connection=connection, leading_ids=[normalized_media_id])
            else:
                cls._resequence_group(is_slide=False, connection=connection)
            cls._resequence_group(is_slide=True, connection=connection)

        updated = cls.get_media_by_id(normalized_media_id)
        return {"media": updated}, 200

    @classmethod
    def reorder_slide_items(cls, payload):
        body = dict(payload or {})
        body["is_slide"] = True
        response_body, status_code = cls.reorder_media_items(body)
        if status_code >= 400:
            return response_body, status_code
        return {"slides": response_body.get("media") or []}, 200

    @classmethod
    def reorder_media_items(cls, payload):
        requested_ids = (payload or {}).get("ordered_ids")
        if not isinstance(requested_ids, list):
            return {"error": "ordered_ids must be a list of media ids."}, 400

        normalized_ids = []
        seen = set()
        for raw_value in requested_ids:
            media_id = cls._to_int(raw_value, minimum=1)
            if not media_id or media_id in seen:
                continue
            seen.add(media_id)
            normalized_ids.append(media_id)

        if not normalized_ids:
            return {"error": "At least one valid media id is required."}, 400

        requested_group = cls._to_bool((payload or {}).get("is_slide"), default=None)
        with db_transaction() as connection:
            target_is_slide = requested_group
            if target_is_slide is None:
                first_row = query_db(
                    """
          SELECT is_slide
          FROM slides
          WHERE id = %(id)s
          LIMIT 1;
          """,
                    {"id": normalized_ids[0]},
                    fetch="one",
                    connection=connection,
                    auto_commit=False,
                )
                if not first_row:
                    return {"error": "None of the provided ids exist."}, 400
                target_is_slide = bool(first_row.get("is_slide", 0))

            current_ids = cls._list_group_ids(is_slide=target_is_slide, connection=connection)
            if not current_ids:
                group_label = "slide" if target_is_slide else "gallery"
                return {"error": f"No {group_label} items are available to reorder."}, 400

            current_id_set = set(current_ids)
            requested_present = [media_id for media_id in normalized_ids if media_id in current_id_set]
            if not requested_present:
                group_label = "slide" if target_is_slide else "gallery"
                return {"error": f"None of the provided ids are current {group_label} items."}, 400

            requested_set = set(requested_present)
            ordered_ids = requested_present + [media_id for media_id in current_ids if media_id not in requested_set]
            cls._apply_display_order_sequence(ordered_ids, connection=connection)

        media_items = [cls.get_media_by_id(media_id) for media_id in ordered_ids]
        media_items = [row for row in media_items if row]
        return {"media": media_items, "is_slide": bool(target_is_slide)}, 200
