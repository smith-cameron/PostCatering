import re

from flask_api.config.mysqlconnection import db_transaction, query_db


class AdminMenuService:
    ITEM_KEY_PATTERN = re.compile(r"[^a-z0-9]+")

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
    def _slugify_item_key(cls, value):
        normalized = cls.ITEM_KEY_PATTERN.sub("_", str(value or "").strip().lower()).strip("_")
        return normalized[:128] if normalized else ""

    @classmethod
    def _generate_unique_item_key(cls, item_name, provided_key=None, connection=None):
        base_key = cls._slugify_item_key(provided_key or item_name)
        if not base_key:
            base_key = "item"

        candidate = base_key
        suffix = 2
        while query_db(
            "SELECT id FROM menu_items WHERE item_key = %(item_key)s LIMIT 1;",
            {"item_key": candidate},
            fetch="one",
            connection=connection,
            auto_commit=False,
        ):
            candidate = f"{base_key}_{suffix}"
            suffix += 1
        return candidate[:128]

    @staticmethod
    def _decode_is_active_filter(value):
        normalized = str(value or "").strip().lower()
        if normalized in ("", "all"):
            return None
        if normalized in ("1", "true", "active"):
            return 1
        if normalized in ("0", "false", "inactive"):
            return 0
        return None

    @classmethod
    def get_reference_data(cls):
        option_groups = query_db(
            """
      SELECT
        id,
        option_key,
        option_id,
        category,
        title,
        display_order,
        is_active
      FROM menu_option_groups
      ORDER BY display_order ASC, id ASC;
      """
        )
        sections = query_db(
            """
      SELECT
        s.id,
        s.catalog_id,
        c.catalog_key,
        s.section_key,
        s.title,
        s.display_order,
        s.is_active
      FROM menu_sections s
      JOIN menu_catalogs c ON c.id = s.catalog_id
      ORDER BY c.display_order ASC, s.display_order ASC, s.id ASC;
      """
        )
        tiers = query_db(
            """
      SELECT
        t.id,
        t.section_id,
        s.section_key,
        s.title AS section_title,
        c.catalog_key,
        t.tier_title,
        t.display_order,
        t.is_active
      FROM menu_section_tiers t
      JOIN menu_sections s ON s.id = t.section_id
      JOIN menu_catalogs c ON c.id = s.catalog_id
      ORDER BY c.display_order ASC, s.display_order ASC, t.display_order ASC, t.id ASC;
      """
        )
        catalogs = query_db(
            """
      SELECT id, catalog_key, page_title, display_order, is_active
      FROM menu_catalogs
      ORDER BY display_order ASC, id ASC;
      """
        )

        return {
            "catalogs": [
                {
                    "id": row.get("id"),
                    "catalog_key": row.get("catalog_key"),
                    "page_title": row.get("page_title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in catalogs
            ],
            "option_groups": [
                {
                    "id": row.get("id"),
                    "option_key": row.get("option_key"),
                    "option_id": row.get("option_id"),
                    "category": row.get("category"),
                    "title": row.get("title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in option_groups
            ],
            "sections": [
                {
                    "id": row.get("id"),
                    "catalog_id": row.get("catalog_id"),
                    "catalog_key": row.get("catalog_key"),
                    "section_key": row.get("section_key"),
                    "title": row.get("title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in sections
            ],
            "tiers": [
                {
                    "id": row.get("id"),
                    "section_id": row.get("section_id"),
                    "section_key": row.get("section_key"),
                    "section_title": row.get("section_title"),
                    "catalog_key": row.get("catalog_key"),
                    "tier_title": row.get("tier_title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in tiers
            ],
        }

    @classmethod
    def list_menu_items(cls, search="", is_active=None, limit=250):
        conditions = []
        payload = {"limit": cls._to_int(limit, default=250, minimum=1, maximum=1000)}

        if str(search or "").strip():
            payload["search"] = f"%{str(search).strip()}%"
            conditions.append("(i.item_name LIKE %(search)s OR i.item_key LIKE %(search)s)")

        is_active_filter = cls._decode_is_active_filter(is_active)
        if is_active_filter is not None:
            payload["is_active"] = is_active_filter
            conditions.append("i.is_active = %(is_active)s")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = query_db(
            f"""
      SELECT
        i.id,
        i.item_key,
        i.item_name,
        i.is_active,
        i.created_at,
        i.updated_at,
        COALESCE(og.option_group_count, 0) AS option_group_count,
        COALESCE(sr.section_row_count, 0) AS section_row_count,
        COALESCE(tb.tier_bullet_count, 0) AS tier_bullet_count
      FROM menu_items i
      LEFT JOIN (
        SELECT item_id, COUNT(*) AS option_group_count
        FROM menu_option_group_items
        WHERE is_active = 1
        GROUP BY item_id
      ) og ON og.item_id = i.id
      LEFT JOIN (
        SELECT item_id, COUNT(*) AS section_row_count
        FROM menu_section_rows
        WHERE is_active = 1
        GROUP BY item_id
      ) sr ON sr.item_id = i.id
      LEFT JOIN (
        SELECT item_id, COUNT(*) AS tier_bullet_count
        FROM menu_section_tier_bullets
        WHERE is_active = 1
          AND item_id IS NOT NULL
        GROUP BY item_id
      ) tb ON tb.item_id = i.id
      {where_clause}
      ORDER BY i.item_name ASC, i.id ASC
      LIMIT %(limit)s;
      """,
            payload,
        )

        return [
            {
                "id": row.get("id"),
                "item_key": row.get("item_key"),
                "item_name": row.get("item_name"),
                "is_active": bool(row.get("is_active", 0)),
                "option_group_count": row.get("option_group_count", 0),
                "section_row_count": row.get("section_row_count", 0),
                "tier_bullet_count": row.get("tier_bullet_count", 0),
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
    def get_menu_item_detail(cls, item_id):
        normalized_item_id = cls._to_int(item_id, minimum=1)
        if not normalized_item_id:
            return None

        item = query_db(
            """
      SELECT id, item_key, item_name, is_active, created_at, updated_at
      FROM menu_items
      WHERE id = %(id)s
      LIMIT 1;
      """,
            {"id": normalized_item_id},
            fetch="one",
        )
        if not item:
            return None

        option_assignments = query_db(
            """
      SELECT
        gi.id,
        gi.group_id,
        g.option_key,
        g.title AS group_title,
        gi.display_order,
        gi.is_active
      FROM menu_option_group_items gi
      JOIN menu_option_groups g ON g.id = gi.group_id
      WHERE gi.item_id = %(item_id)s
      ORDER BY gi.display_order ASC, gi.id ASC;
      """,
            {"item_id": normalized_item_id},
        )
        section_rows = query_db(
            """
      SELECT
        r.id,
        r.section_id,
        c.catalog_key,
        s.section_key,
        s.title AS section_title,
        r.value_1,
        r.value_2,
        r.display_order,
        r.is_active
      FROM menu_section_rows r
      JOIN menu_sections s ON s.id = r.section_id
      JOIN menu_catalogs c ON c.id = s.catalog_id
      WHERE r.item_id = %(item_id)s
      ORDER BY c.display_order ASC, s.display_order ASC, r.display_order ASC, r.id ASC;
      """,
            {"item_id": normalized_item_id},
        )
        tier_rows = query_db(
            """
      SELECT
        b.id,
        b.tier_id,
        c.catalog_key,
        s.section_key,
        s.title AS section_title,
        t.tier_title,
        b.display_order,
        b.is_active
      FROM menu_section_tier_bullets b
      JOIN menu_section_tiers t ON t.id = b.tier_id
      JOIN menu_sections s ON s.id = t.section_id
      JOIN menu_catalogs c ON c.id = s.catalog_id
      WHERE b.item_id = %(item_id)s
      ORDER BY c.display_order ASC, s.display_order ASC, t.display_order ASC, b.display_order ASC, b.id ASC;
      """,
            {"item_id": normalized_item_id},
        )

        return {
            "id": item.get("id"),
            "item_key": item.get("item_key"),
            "item_name": item.get("item_name"),
            "is_active": bool(item.get("is_active", 0)),
            "created_at": item.get("created_at").isoformat() if hasattr(item.get("created_at"), "isoformat") else None,
            "updated_at": item.get("updated_at").isoformat() if hasattr(item.get("updated_at"), "isoformat") else None,
            "option_group_assignments": [
                {
                    "id": row.get("id"),
                    "group_id": row.get("group_id"),
                    "option_key": row.get("option_key"),
                    "group_title": row.get("group_title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in option_assignments
            ],
            "section_row_assignments": [
                {
                    "id": row.get("id"),
                    "section_id": row.get("section_id"),
                    "catalog_key": row.get("catalog_key"),
                    "section_key": row.get("section_key"),
                    "section_title": row.get("section_title"),
                    "value_1": row.get("value_1"),
                    "value_2": row.get("value_2"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in section_rows
            ],
            "tier_bullet_assignments": [
                {
                    "id": row.get("id"),
                    "tier_id": row.get("tier_id"),
                    "catalog_key": row.get("catalog_key"),
                    "section_key": row.get("section_key"),
                    "section_title": row.get("section_title"),
                    "tier_title": row.get("tier_title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in tier_rows
            ],
        }

    @classmethod
    def _resequence_display_order(
        cls,
        table_name,
        scope_column,
        scope_id,
        preferred_rank_by_row_id=None,
        connection=None,
    ):
        rows = query_db(
            f"""
      SELECT id, display_order
      FROM {table_name}
      WHERE {scope_column} = %(scope_id)s
        AND is_active = 1
      ORDER BY display_order ASC, id ASC;
      """,
            {"scope_id": scope_id},
            connection=connection,
            auto_commit=False,
        )
        if not rows:
            return

        ranked_rows = []
        preferred_rank_by_row_id = preferred_rank_by_row_id or {}
        for row in rows:
            preferred_rank = preferred_rank_by_row_id.get(row["id"])
            default_rank = cls._to_int(row.get("display_order"), default=999999, minimum=1)
            ranked_rows.append(
                {
                    "id": row["id"],
                    "rank": preferred_rank if preferred_rank is not None else default_rank,
                }
            )

        ranked_rows.sort(key=lambda entry: (entry["rank"], entry["id"]))
        for index, row in enumerate(ranked_rows, start=1):
            query_db(
                f"UPDATE {table_name} SET display_order = %(temp_order)s WHERE id = %(id)s;",
                {"temp_order": 1000000 + index, "id": row["id"]},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        for index, row in enumerate(ranked_rows, start=1):
            query_db(
                f"UPDATE {table_name} SET display_order = %(display_order)s WHERE id = %(id)s;",
                {"display_order": index, "id": row["id"]},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

    @classmethod
    def _sync_option_group_assignments(cls, item_id, assignments, connection=None):
        existing_group_rows = query_db(
            """
      SELECT DISTINCT group_id
      FROM menu_option_group_items
      WHERE item_id = %(item_id)s;
      """,
            {"item_id": item_id},
            connection=connection,
            auto_commit=False,
        )
        touched_group_ids = {int(row["group_id"]) for row in existing_group_rows if row.get("group_id")}
        preferred_group_item_order = {}

        query_db(
            """
      UPDATE menu_option_group_items
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = %(item_id)s;
      """,
            {"item_id": item_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )

        for index, assignment in enumerate(assignments or [], start=1):
            if not isinstance(assignment, dict):
                continue
            group_id = cls._to_int(assignment.get("group_id"), minimum=1)
            if not group_id:
                continue

            assignment_is_active = cls._to_bool(assignment.get("is_active"), default=True)
            if assignment_is_active is False:
                touched_group_ids.add(group_id)
                continue

            requested_order = cls._to_int(assignment.get("display_order"), default=index, minimum=1)
            inserted_row_id = query_db(
                """
        INSERT INTO menu_option_group_items (group_id, item_id, display_order, is_active)
        VALUES (%(group_id)s, %(item_id)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
                {
                    "group_id": group_id,
                    "item_id": item_id,
                    "display_order": requested_order,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            touched_group_ids.add(group_id)
            if inserted_row_id:
                preferred_group_item_order.setdefault(group_id, {})[inserted_row_id] = requested_order

        for group_id in sorted(touched_group_ids):
            cls._resequence_display_order(
                table_name="menu_option_group_items",
                scope_column="group_id",
                scope_id=group_id,
                preferred_rank_by_row_id=preferred_group_item_order.get(group_id, {}),
                connection=connection,
            )

    @classmethod
    def _sync_section_row_assignments(cls, item_id, assignments, connection=None):
        existing_section_rows = query_db(
            """
      SELECT DISTINCT section_id
      FROM menu_section_rows
      WHERE item_id = %(item_id)s;
      """,
            {"item_id": item_id},
            connection=connection,
            auto_commit=False,
        )
        touched_section_ids = {int(row["section_id"]) for row in existing_section_rows if row.get("section_id")}
        preferred_section_order = {}

        query_db(
            """
      UPDATE menu_section_rows
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = %(item_id)s;
      """,
            {"item_id": item_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )

        for index, assignment in enumerate(assignments or [], start=1):
            if not isinstance(assignment, dict):
                continue
            section_id = cls._to_int(assignment.get("section_id"), minimum=1)
            if not section_id:
                continue
            assignment_is_active = cls._to_bool(assignment.get("is_active"), default=True)
            if assignment_is_active is False:
                touched_section_ids.add(section_id)
                continue

            requested_order = cls._to_int(assignment.get("display_order"), default=index, minimum=1)
            inserted_row_id = query_db(
                """
        INSERT INTO menu_section_rows (section_id, item_id, value_1, value_2, display_order, is_active)
        VALUES (%(section_id)s, %(item_id)s, %(value_1)s, %(value_2)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          value_1 = VALUES(value_1),
          value_2 = VALUES(value_2),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
                {
                    "section_id": section_id,
                    "item_id": item_id,
                    "value_1": (str(assignment.get("value_1") or "").strip() or None),
                    "value_2": (str(assignment.get("value_2") or "").strip() or None),
                    "display_order": requested_order,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            touched_section_ids.add(section_id)
            if inserted_row_id:
                preferred_section_order.setdefault(section_id, {})[inserted_row_id] = requested_order

        for section_id in sorted(touched_section_ids):
            cls._resequence_display_order(
                table_name="menu_section_rows",
                scope_column="section_id",
                scope_id=section_id,
                preferred_rank_by_row_id=preferred_section_order.get(section_id, {}),
                connection=connection,
            )

    @classmethod
    def _sync_tier_bullet_assignments(cls, item_id, assignments, connection=None):
        existing_tier_rows = query_db(
            """
      SELECT DISTINCT tier_id
      FROM menu_section_tier_bullets
      WHERE item_id = %(item_id)s;
      """,
            {"item_id": item_id},
            connection=connection,
            auto_commit=False,
        )
        touched_tier_ids = {int(row["tier_id"]) for row in existing_tier_rows if row.get("tier_id")}
        preferred_tier_order = {}

        query_db(
            """
      UPDATE menu_section_tier_bullets
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = %(item_id)s;
      """,
            {"item_id": item_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )

        for index, assignment in enumerate(assignments or [], start=1):
            if not isinstance(assignment, dict):
                continue
            tier_id = cls._to_int(assignment.get("tier_id"), minimum=1)
            if not tier_id:
                continue
            assignment_is_active = cls._to_bool(assignment.get("is_active"), default=True)
            if assignment_is_active is False:
                touched_tier_ids.add(tier_id)
                continue

            requested_order = cls._to_int(assignment.get("display_order"), default=index, minimum=1)
            inserted_row_id = query_db(
                """
        INSERT INTO menu_section_tier_bullets (tier_id, item_id, bullet_text, display_order, is_active)
        VALUES (%(tier_id)s, %(item_id)s, NULL, %(display_order)s, 1);
        """,
                {
                    "tier_id": tier_id,
                    "item_id": item_id,
                    "display_order": 1000000 + requested_order + index,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            touched_tier_ids.add(tier_id)
            if inserted_row_id:
                preferred_tier_order.setdefault(tier_id, {})[inserted_row_id] = requested_order

        for tier_id in sorted(touched_tier_ids):
            cls._resequence_display_order(
                table_name="menu_section_tier_bullets",
                scope_column="tier_id",
                scope_id=tier_id,
                preferred_rank_by_row_id=preferred_tier_order.get(tier_id, {}),
                connection=connection,
            )

    @classmethod
    def _resequence_sections_for_catalog(cls, catalog_id, connection=None):
        cls._resequence_display_order(
            table_name="menu_sections",
            scope_column="catalog_id",
            scope_id=catalog_id,
            preferred_rank_by_row_id={},
            connection=connection,
        )

    @classmethod
    def _resequence_tiers_for_section(cls, section_id, connection=None):
        cls._resequence_display_order(
            table_name="menu_section_tiers",
            scope_column="section_id",
            scope_id=section_id,
            preferred_rank_by_row_id={},
            connection=connection,
        )

    @classmethod
    def create_menu_item(cls, payload):
        item_name = str((payload or {}).get("item_name") or "").strip()
        if not item_name:
            return {"error": "item_name is required."}, 400

        with db_transaction() as connection:
            duplicate_name = query_db(
                """
        SELECT id
        FROM menu_items
        WHERE item_name = %(item_name)s
        LIMIT 1;
        """,
                {"item_name": item_name},
                fetch="one",
                connection=connection,
                auto_commit=False,
            )
            if duplicate_name:
                return {"error": "A menu item with this name already exists."}, 409

            generated_item_key = cls._generate_unique_item_key(
                item_name=item_name,
                provided_key=(payload or {}).get("item_key"),
                connection=connection,
            )

            item_id = query_db(
                """
        INSERT INTO menu_items (item_key, item_name, is_active)
        VALUES (%(item_key)s, %(item_name)s, %(is_active)s);
        """,
                {
                    "item_key": generated_item_key,
                    "item_name": item_name,
                    "is_active": 1 if cls._to_bool((payload or {}).get("is_active"), default=True) else 0,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

            if "option_group_assignments" in (payload or {}):
                cls._sync_option_group_assignments(
                    item_id=item_id,
                    assignments=(payload or {}).get("option_group_assignments"),
                    connection=connection,
                )
            if "section_row_assignments" in (payload or {}):
                cls._sync_section_row_assignments(
                    item_id=item_id,
                    assignments=(payload or {}).get("section_row_assignments"),
                    connection=connection,
                )
            if "tier_bullet_assignments" in (payload or {}):
                cls._sync_tier_bullet_assignments(
                    item_id=item_id,
                    assignments=(payload or {}).get("tier_bullet_assignments"),
                    connection=connection,
                )

        created = cls.get_menu_item_detail(item_id)
        return {"item": created}, 201

    @classmethod
    def update_menu_item(cls, item_id, payload):
        normalized_item_id = cls._to_int(item_id, minimum=1)
        if not normalized_item_id:
            return {"error": "Invalid item id."}, 400

        existing = cls.get_menu_item_detail(normalized_item_id)
        if not existing:
            return {"error": "Menu item not found."}, 404

        with db_transaction() as connection:
            next_item_name = existing["item_name"]
            if "item_name" in (payload or {}):
                candidate_name = str((payload or {}).get("item_name") or "").strip()
                if not candidate_name:
                    return {"error": "item_name cannot be empty."}, 400
                next_item_name = candidate_name

            next_item_key = existing["item_key"]
            if "item_key" in (payload or {}):
                provided_key = str((payload or {}).get("item_key") or "").strip()
                if provided_key:
                    next_item_key = cls._slugify_item_key(provided_key)
                elif "item_name" in (payload or {}):
                    next_item_key = cls._generate_unique_item_key(
                        item_name=next_item_name,
                        provided_key=None,
                        connection=connection,
                    )

            duplicate_name = query_db(
                """
        SELECT id
        FROM menu_items
        WHERE item_name = %(item_name)s
          AND id <> %(id)s
        LIMIT 1;
        """,
                {"item_name": next_item_name, "id": normalized_item_id},
                fetch="one",
                connection=connection,
                auto_commit=False,
            )
            if duplicate_name:
                return {"error": "A menu item with this name already exists."}, 409

            duplicate_key = query_db(
                """
        SELECT id
        FROM menu_items
        WHERE item_key = %(item_key)s
          AND id <> %(id)s
        LIMIT 1;
        """,
                {"item_key": next_item_key, "id": normalized_item_id},
                fetch="one",
                connection=connection,
                auto_commit=False,
            )
            if duplicate_key:
                return {"error": "A menu item with this key already exists."}, 409

            if "item_key" in (payload or {}) or "item_name" in (payload or {}) or "is_active" in (payload or {}):
                query_db(
                    """
          UPDATE menu_items
          SET
            item_key = %(item_key)s,
            item_name = %(item_name)s,
            is_active = %(is_active)s,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = %(id)s;
          """,
                    {
                        "id": normalized_item_id,
                        "item_key": next_item_key,
                        "item_name": next_item_name,
                        "is_active": (
                            1 if cls._to_bool((payload or {}).get("is_active"), default=existing["is_active"]) else 0
                        ),
                    },
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )

            if "option_group_assignments" in (payload or {}):
                cls._sync_option_group_assignments(
                    item_id=normalized_item_id,
                    assignments=(payload or {}).get("option_group_assignments"),
                    connection=connection,
                )
            if "section_row_assignments" in (payload or {}):
                cls._sync_section_row_assignments(
                    item_id=normalized_item_id,
                    assignments=(payload or {}).get("section_row_assignments"),
                    connection=connection,
                )
            if "tier_bullet_assignments" in (payload or {}):
                cls._sync_tier_bullet_assignments(
                    item_id=normalized_item_id,
                    assignments=(payload or {}).get("tier_bullet_assignments"),
                    connection=connection,
                )

        updated = cls.get_menu_item_detail(normalized_item_id)
        return {"item": updated}, 200

    @classmethod
    def list_sections(cls, search="", catalog_key="", is_active=None, limit=250):
        conditions = []
        payload = {"limit": cls._to_int(limit, default=250, minimum=1, maximum=1000)}

        if str(search or "").strip():
            payload["search"] = f"%{str(search).strip()}%"
            conditions.append(
                "(s.title LIKE %(search)s OR s.section_key LIKE %(search)s OR s.description LIKE %(search)s)"
            )

        if str(catalog_key or "").strip():
            payload["catalog_key"] = str(catalog_key).strip().lower()
            conditions.append("c.catalog_key = %(catalog_key)s")

        is_active_filter = cls._decode_is_active_filter(is_active)
        if is_active_filter is not None:
            payload["is_active"] = is_active_filter
            conditions.append("s.is_active = %(is_active)s")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        rows = query_db(
            f"""
      SELECT
        s.id,
        s.catalog_id,
        c.catalog_key,
        s.section_key,
        s.section_type,
        s.title,
        s.description,
        s.price,
        s.category,
        s.course_type,
        s.display_order,
        s.is_active,
        COALESCE(ig.include_count, 0) AS include_count,
        COALESCE(t.tier_count, 0) AS tier_count
      FROM menu_sections s
      JOIN menu_catalogs c ON c.id = s.catalog_id
      LEFT JOIN (
        SELECT section_id, COUNT(*) AS include_count
        FROM menu_section_include_groups
        WHERE is_active = 1
        GROUP BY section_id
      ) ig ON ig.section_id = s.id
      LEFT JOIN (
        SELECT section_id, COUNT(*) AS tier_count
        FROM menu_section_tiers
        WHERE is_active = 1
        GROUP BY section_id
      ) t ON t.section_id = s.id
      {where_clause}
      ORDER BY c.display_order ASC, s.display_order ASC, s.id ASC
      LIMIT %(limit)s;
      """,
            payload,
        )

        return [
            {
                "id": row.get("id"),
                "catalog_id": row.get("catalog_id"),
                "catalog_key": row.get("catalog_key"),
                "section_key": row.get("section_key"),
                "section_type": row.get("section_type"),
                "title": row.get("title"),
                "description": row.get("description"),
                "price": row.get("price"),
                "category": row.get("category"),
                "course_type": row.get("course_type"),
                "display_order": row.get("display_order"),
                "is_active": bool(row.get("is_active", 0)),
                "include_count": row.get("include_count", 0),
                "tier_count": row.get("tier_count", 0),
            }
            for row in rows
        ]

    @classmethod
    def get_section_detail(cls, section_id):
        normalized_section_id = cls._to_int(section_id, minimum=1)
        if not normalized_section_id:
            return None

        section = query_db(
            """
      SELECT
        s.id,
        s.catalog_id,
        c.catalog_key,
        s.section_key,
        s.section_type,
        s.title,
        s.description,
        s.price,
        s.category,
        s.course_type,
        s.display_order,
        s.is_active
      FROM menu_sections s
      JOIN menu_catalogs c ON c.id = s.catalog_id
      WHERE s.id = %(id)s
      LIMIT 1;
      """,
            {"id": normalized_section_id},
            fetch="one",
        )
        if not section:
            return None

        include_groups = query_db(
            """
      SELECT
        ig.id,
        ig.group_id,
        g.option_key,
        g.title AS group_title,
        ig.display_order,
        ig.is_active
      FROM menu_section_include_groups ig
      JOIN menu_option_groups g ON g.id = ig.group_id
      WHERE ig.section_id = %(section_id)s
      ORDER BY ig.display_order ASC, ig.id ASC;
      """,
            {"section_id": normalized_section_id},
        )
        constraints = query_db(
            """
      SELECT id, constraint_key, min_select, max_select, is_active
      FROM menu_section_constraints
      WHERE section_id = %(section_id)s
      ORDER BY id ASC;
      """,
            {"section_id": normalized_section_id},
        )
        tiers = query_db(
            """
      SELECT id, tier_title, price, display_order, is_active
      FROM menu_section_tiers
      WHERE section_id = %(section_id)s
      ORDER BY display_order ASC, id ASC;
      """,
            {"section_id": normalized_section_id},
        )

        tier_constraints = query_db(
            """
      SELECT id, tier_id, constraint_key, min_select, max_select, is_active
      FROM menu_section_tier_constraints
      WHERE tier_id IN (
        SELECT id FROM menu_section_tiers WHERE section_id = %(section_id)s
      )
      ORDER BY tier_id ASC, id ASC;
      """,
            {"section_id": normalized_section_id},
        )
        tier_constraints_by_tier = {}
        for row in tier_constraints:
            tier_constraints_by_tier.setdefault(row.get("tier_id"), []).append(
                {
                    "id": row.get("id"),
                    "constraint_key": row.get("constraint_key"),
                    "min_select": row.get("min_select"),
                    "max_select": row.get("max_select"),
                    "is_active": bool(row.get("is_active", 0)),
                }
            )

        return {
            "id": section.get("id"),
            "catalog_id": section.get("catalog_id"),
            "catalog_key": section.get("catalog_key"),
            "section_key": section.get("section_key"),
            "section_type": section.get("section_type"),
            "title": section.get("title"),
            "description": section.get("description"),
            "price": section.get("price"),
            "category": section.get("category"),
            "course_type": section.get("course_type"),
            "display_order": section.get("display_order"),
            "is_active": bool(section.get("is_active", 0)),
            "include_groups": [
                {
                    "id": row.get("id"),
                    "group_id": row.get("group_id"),
                    "option_key": row.get("option_key"),
                    "group_title": row.get("group_title"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in include_groups
            ],
            "constraints": [
                {
                    "id": row.get("id"),
                    "constraint_key": row.get("constraint_key"),
                    "min_select": row.get("min_select"),
                    "max_select": row.get("max_select"),
                    "is_active": bool(row.get("is_active", 0)),
                }
                for row in constraints
            ],
            "tiers": [
                {
                    "id": row.get("id"),
                    "tier_title": row.get("tier_title"),
                    "price": row.get("price"),
                    "display_order": row.get("display_order"),
                    "is_active": bool(row.get("is_active", 0)),
                    "constraints": tier_constraints_by_tier.get(row.get("id"), []),
                }
                for row in tiers
            ],
        }

    @classmethod
    def update_section(cls, section_id, payload):
        normalized_section_id = cls._to_int(section_id, minimum=1)
        if not normalized_section_id:
            return {"error": "Invalid section id."}, 400

        existing = cls.get_section_detail(normalized_section_id)
        if not existing:
            return {"error": "Section not found."}, 404

        with db_transaction() as connection:
            next_title = str(
                (payload or {}).get("title") if "title" in (payload or {}) else existing["title"] or ""
            ).strip()
            if not next_title:
                return {"error": "title cannot be empty."}, 400

            next_display_order = cls._to_int(
                (payload or {}).get("display_order"),
                default=existing["display_order"],
                minimum=1,
            )
            next_is_active = cls._to_bool((payload or {}).get("is_active"), default=existing["is_active"])

            query_db(
                """
        UPDATE menu_sections
        SET
          title = %(title)s,
          description = %(description)s,
          price = %(price)s,
          section_type = %(section_type)s,
          category = %(category)s,
          course_type = %(course_type)s,
          display_order = %(display_order)s,
          is_active = %(is_active)s,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = %(id)s;
        """,
                {
                    "id": normalized_section_id,
                    "title": next_title,
                    "description": (
                        str((payload or {}).get("description") or "").strip()
                        if "description" in (payload or {})
                        else existing["description"]
                    ),
                    "price": (
                        str((payload or {}).get("price") or "").strip()
                        if "price" in (payload or {})
                        else existing["price"]
                    ),
                    "section_type": (
                        str((payload or {}).get("section_type") or "").strip() or None
                        if "section_type" in (payload or {})
                        else existing["section_type"]
                    ),
                    "category": (
                        str((payload or {}).get("category") or "").strip() or None
                        if "category" in (payload or {})
                        else existing["category"]
                    ),
                    "course_type": (
                        str((payload or {}).get("course_type") or "").strip() or None
                        if "course_type" in (payload or {})
                        else existing["course_type"]
                    ),
                    "display_order": next_display_order,
                    "is_active": 1 if next_is_active else 0,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

            if "include_group_ids" in (payload or {}):
                query_db(
                    """
          UPDATE menu_section_include_groups
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE section_id = %(section_id)s;
          """,
                    {"section_id": normalized_section_id},
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
                for index, group_id_value in enumerate((payload or {}).get("include_group_ids") or [], start=1):
                    group_id = cls._to_int(group_id_value, minimum=1)
                    if not group_id:
                        continue
                    query_db(
                        """
            INSERT INTO menu_section_include_groups (section_id, group_id, display_order, is_active)
            VALUES (%(section_id)s, %(group_id)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              display_order = VALUES(display_order),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {
                            "section_id": normalized_section_id,
                            "group_id": group_id,
                            "display_order": index,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )
                cls._resequence_display_order(
                    table_name="menu_section_include_groups",
                    scope_column="section_id",
                    scope_id=normalized_section_id,
                    preferred_rank_by_row_id={},
                    connection=connection,
                )

            if "constraints" in (payload or {}):
                query_db(
                    """
          UPDATE menu_section_constraints
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE section_id = %(section_id)s;
          """,
                    {"section_id": normalized_section_id},
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
                for constraint in (payload or {}).get("constraints") or []:
                    if not isinstance(constraint, dict):
                        continue
                    constraint_key = str(constraint.get("constraint_key") or "").strip()
                    if not constraint_key:
                        continue
                    min_select = cls._to_int(constraint.get("min_select"), default=0, minimum=0)
                    max_select = cls._to_int(constraint.get("max_select"), default=min_select, minimum=0)
                    if max_select < min_select:
                        max_select = min_select
                    query_db(
                        """
            INSERT INTO menu_section_constraints (
              section_id,
              constraint_key,
              min_select,
              max_select,
              is_active
            )
            VALUES (%(section_id)s, %(constraint_key)s, %(min_select)s, %(max_select)s, 1)
            ON DUPLICATE KEY UPDATE
              min_select = VALUES(min_select),
              max_select = VALUES(max_select),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {
                            "section_id": normalized_section_id,
                            "constraint_key": constraint_key,
                            "min_select": min_select,
                            "max_select": max_select,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )

            if "tiers" in (payload or {}):
                for tier in (payload or {}).get("tiers") or []:
                    if not isinstance(tier, dict):
                        continue
                    tier_id = cls._to_int(tier.get("id"), minimum=1)
                    if not tier_id:
                        continue

                    query_db(
                        """
            UPDATE menu_section_tiers
            SET
              tier_title = %(tier_title)s,
              price = %(price)s,
              display_order = %(display_order)s,
              is_active = %(is_active)s,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = %(id)s
              AND section_id = %(section_id)s;
            """,
                        {
                            "id": tier_id,
                            "section_id": normalized_section_id,
                            "tier_title": str(tier.get("tier_title") or "").strip(),
                            "price": (str(tier.get("price") or "").strip() or None),
                            "display_order": cls._to_int(tier.get("display_order"), default=1, minimum=1),
                            "is_active": 1 if cls._to_bool(tier.get("is_active"), default=True) else 0,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )

                    if "constraints" in tier:
                        query_db(
                            """
              UPDATE menu_section_tier_constraints
              SET is_active = 0, updated_at = CURRENT_TIMESTAMP
              WHERE tier_id = %(tier_id)s;
              """,
                            {"tier_id": tier_id},
                            fetch="none",
                            connection=connection,
                            auto_commit=False,
                        )
                        for constraint in tier.get("constraints") or []:
                            if not isinstance(constraint, dict):
                                continue
                            constraint_key = str(constraint.get("constraint_key") or "").strip()
                            if not constraint_key:
                                continue
                            min_select = cls._to_int(constraint.get("min_select"), default=0, minimum=0)
                            max_select = cls._to_int(constraint.get("max_select"), default=min_select, minimum=0)
                            if max_select < min_select:
                                max_select = min_select
                            query_db(
                                """
                INSERT INTO menu_section_tier_constraints (
                  tier_id,
                  constraint_key,
                  min_select,
                  max_select,
                  constraint_value,
                  is_active
                )
                VALUES (
                  %(tier_id)s,
                  %(constraint_key)s,
                  %(min_select)s,
                  %(max_select)s,
                  NULL,
                  1
                )
                ON DUPLICATE KEY UPDATE
                  min_select = VALUES(min_select),
                  max_select = VALUES(max_select),
                  constraint_value = NULL,
                  is_active = 1,
                  updated_at = CURRENT_TIMESTAMP;
                """,
                                {
                                    "tier_id": tier_id,
                                    "constraint_key": constraint_key,
                                    "min_select": min_select,
                                    "max_select": max_select,
                                },
                                fetch="none",
                                connection=connection,
                                auto_commit=False,
                            )

            cls._resequence_sections_for_catalog(existing["catalog_id"], connection=connection)
            cls._resequence_tiers_for_section(normalized_section_id, connection=connection)

        updated = cls.get_section_detail(normalized_section_id)
        return {"section": updated}, 200
