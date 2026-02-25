import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask_api.config.mysqlconnection import db_transaction, query_db, query_db_many


class AdminMenuService:
    ITEM_KEY_PATTERN = re.compile(r"[^a-z0-9]+")
    _FORMAL_ID_OFFSET = 1_000_000

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
    def _slugify_item_key(cls, value):
        normalized = cls.ITEM_KEY_PATTERN.sub("_", str(value or "").strip().lower()).strip("_")
        return normalized[:128] if normalized else ""

    @classmethod
    def _encode_item_id(cls, menu_type, row_id):
        numeric_id = cls._to_int(row_id, minimum=1)
        if not numeric_id:
            return None
        return numeric_id + cls._FORMAL_ID_OFFSET if menu_type == "formal" else numeric_id

    @classmethod
    def _decode_item_id(cls, encoded_item_id):
        numeric_id = cls._to_int(encoded_item_id, minimum=1)
        if not numeric_id:
            return None, None
        if numeric_id > cls._FORMAL_ID_OFFSET:
            return "formal", numeric_id - cls._FORMAL_ID_OFFSET
        return "regular", numeric_id

    @classmethod
    def _encode_group_id(cls, menu_type, row_id):
        numeric_id = cls._to_int(row_id, minimum=1)
        if not numeric_id:
            return None
        return numeric_id + cls._FORMAL_ID_OFFSET if menu_type == "formal" else numeric_id

    @classmethod
    def _decode_group_id(cls, encoded_group_id, menu_type=None):
        numeric_id = cls._to_int(encoded_group_id, minimum=1)
        if not numeric_id:
            return None, None

        if menu_type == "formal":
            raw_id = numeric_id - cls._FORMAL_ID_OFFSET if numeric_id > cls._FORMAL_ID_OFFSET else numeric_id
            return "formal", raw_id
        if menu_type == "regular":
            raw_id = numeric_id if numeric_id <= cls._FORMAL_ID_OFFSET else numeric_id - cls._FORMAL_ID_OFFSET
            return "regular", raw_id

        if numeric_id > cls._FORMAL_ID_OFFSET:
            return "formal", numeric_id - cls._FORMAL_ID_OFFSET
        return "regular", numeric_id

    @staticmethod
    def _normalize_menu_type_request(menu_type):
        include_regular = False
        include_formal = False

        if isinstance(menu_type, (list, tuple, set)):
            candidates = [str(value or "").strip().lower() for value in menu_type]
        else:
            candidates = [str(menu_type or "").strip().lower()]

        for candidate in candidates:
            if candidate == "both":
                include_regular = True
                include_formal = True
            elif candidate == "formal":
                include_formal = True
            elif candidate == "regular":
                include_regular = True

        if not include_regular and not include_formal:
            include_regular = True

        ordered = []
        if include_regular:
            ordered.append("regular")
        if include_formal:
            ordered.append("formal")
        return ordered

    @staticmethod
    def _to_iso(value):
        return value.isoformat() if hasattr(value, "isoformat") else None

    @staticmethod
    def _serialize_price(value):
        if value is None:
            return None
        try:
            normalized = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return format(normalized, "f")
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _to_price_decimal(value, default=Decimal("0.00")):
        if value is None:
            return default
        text = str(value).strip()
        if not text:
            return default
        cleaned = text.replace("$", "").replace(",", "")
        try:
            amount = Decimal(cleaned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except (InvalidOperation, ValueError):
            return default
        if amount < 0:
            return default
        return amount

    @classmethod
    def _build_option_group_row(cls, row, menu_type):
        return {
            "id": cls._encode_group_id(menu_type, row.get("id")),
            "option_key": f"{menu_type}_{row.get('key')}",
            "option_id": f"{menu_type}:{row.get('key')}",
            "category": menu_type,
            "title": row.get("name"),
            "display_order": row.get("sort_order"),
            "is_active": bool(row.get("is_active", 0)),
            "menu_type": menu_type,
            "group_key": row.get("key"),
            "source_group_id": row.get("id"),
        }

    @classmethod
    def get_reference_data(cls):
        rows = query_db(
            """
      SELECT
        g.id,
        g.group_key AS `key`,
        g.group_name AS name,
        tg.display_order AS sort_order,
        g.is_active,
        t.type_key AS menu_type
      FROM menu_type_groups tg
      JOIN menu_types t ON t.id = tg.menu_type_id
      JOIN menu_groups g ON g.id = tg.menu_group_id
      ORDER BY t.sort_order ASC, tg.display_order ASC, g.id ASC;
      """
        )

        option_groups = []
        for row in rows:
            option_groups.append(cls._build_option_group_row(row, row.get("menu_type")))

        return {
            "catalogs": [
                {
                    "id": 1,
                    "catalog_key": "regular",
                    "page_title": "Regular Menu",
                    "display_order": 1,
                    "is_active": True,
                },
                {"id": 2, "catalog_key": "formal", "page_title": "Formal Menu", "display_order": 2, "is_active": True},
            ],
            "option_groups": option_groups,
            "sections": [],
            "tiers": [],
        }

    @classmethod
    def list_menu_items(cls, search="", is_active=None, limit=250):
        normalized_limit = cls._to_int(limit, default=250, minimum=1, maximum=1000)
        normalized_search = str(search or "").strip().lower()
        is_active_filter = cls._decode_is_active_filter(is_active)

        rows = query_db(
            """
      SELECT
        i.id,
        mt.type_key AS menu_type,
        i.item_key,
        i.item_name,
        i.is_active,
        i.tray_price_half,
        i.tray_price_full,
        i.created_at,
        i.updated_at,
        g.id AS group_id,
        g.group_key,
        g.group_name AS group_title
      FROM menu_items i
      LEFT JOIN menu_item_type_groups mitg ON mitg.menu_item_id = i.id AND mitg.is_active = 1
      LEFT JOIN menu_types mt ON mt.id = mitg.menu_type_id
      LEFT JOIN menu_groups g ON g.id = mitg.menu_group_id
      ORDER BY i.item_name ASC, i.id ASC, mt.sort_order ASC, mt.id ASC;
      """
        )

        filtered = []
        for row in rows:
            menu_type = str(row.get("menu_type") or "").strip().lower()
            is_active_value = bool(row.get("is_active", 0))
            half_price = row.get("tray_price_half")
            if half_price is None:
                half_price = row.get("half_tray_price")
            full_price = row.get("tray_price_full")
            if full_price is None:
                full_price = row.get("full_tray_price")
            if is_active_filter is not None and int(is_active_value) != is_active_filter:
                continue
            if normalized_search:
                haystack = f"{row.get('item_name', '')} {row.get('item_key', '')}".lower()
                if normalized_search not in haystack:
                    continue

            normalized_type = menu_type if menu_type in ("regular", "formal") else None
            encoded_item_id = cls._encode_item_id(normalized_type or "regular", row.get("id"))
            encoded_group_id = (
                cls._encode_group_id(normalized_type, row.get("group_id"))
                if normalized_type and row.get("group_id")
                else None
            )
            filtered.append(
                {
                    "id": encoded_item_id,
                    "menu_type": normalized_type,
                    "menu_types": [normalized_type] if normalized_type else [],
                    "item_key": row.get("item_key"),
                    "item_name": row.get("item_name"),
                    "is_active": is_active_value,
                    "group_id": encoded_group_id,
                    "group_key": row.get("group_key"),
                    "group_title": row.get("group_title"),
                    "tray_price_half": (cls._serialize_price(half_price) if normalized_type == "regular" else None),
                    "tray_price_full": (cls._serialize_price(full_price) if normalized_type == "regular" else None),
                    "option_group_count": 1 if row.get("group_id") else 0,
                    "section_row_count": 0,
                    "tier_bullet_count": 0,
                    "created_at": cls._to_iso(row.get("created_at")),
                    "updated_at": cls._to_iso(row.get("updated_at")),
                }
            )

        return filtered[:normalized_limit]

    @classmethod
    def _build_unassigned_item_detail(cls, menu_type, row_id, raw_row):
        return {
            "id": cls._encode_item_id(menu_type or "regular", row_id),
            "menu_type": menu_type,
            "menu_types": [],
            "item_key": raw_row.get("item_key"),
            "item_name": raw_row.get("item_name"),
            "item_type": raw_row.get("item_type"),
            "item_category": raw_row.get("item_category"),
            "is_active": bool(raw_row.get("is_active", 0)),
            "group_id": None,
            "group_key": None,
            "group_title": None,
            "tray_price_half": cls._serialize_price(raw_row.get("tray_price_half")),
            "tray_price_full": cls._serialize_price(raw_row.get("tray_price_full")),
            "option_group_assignments": [],
            "section_row_assignments": [],
            "tier_bullet_assignments": [],
        }

    @classmethod
    def _fetch_item_types(cls, row_id, connection=None):
        rows = query_db(
            """
      SELECT mt.type_key
      FROM menu_item_type_groups mitg
      JOIN menu_types mt ON mt.id = mitg.menu_type_id
      WHERE mitg.menu_item_id = %(row_id)s
        AND mitg.is_active = 1
      ORDER BY mt.sort_order ASC, mt.id ASC;
      """,
            {"row_id": row_id},
            connection=connection,
            auto_commit=False if connection is not None else True,
        )
        return [str(row.get("type_key") or "").strip().lower() for row in rows if row.get("type_key")]

    @classmethod
    def _fetch_item_assignments(cls, row_id, connection=None):
        rows = query_db(
            """
      SELECT
        mt.type_key AS menu_type,
        g.id AS group_id,
        g.group_key,
        g.group_name AS group_title,
        mitg.is_active
      FROM menu_item_type_groups mitg
      JOIN menu_types mt ON mt.id = mitg.menu_type_id
      JOIN menu_groups g ON g.id = mitg.menu_group_id
      WHERE mitg.menu_item_id = %(row_id)s
      ORDER BY mt.sort_order ASC, mt.id ASC;
      """,
            {"row_id": row_id},
            connection=connection,
            auto_commit=False if connection is not None else True,
        )

        assignments = {}
        for row in rows:
            type_key = str(row.get("menu_type") or "").strip().lower()
            if not type_key:
                continue
            raw_group_id = row.get("group_id")
            assignments[type_key] = {
                "raw_group_id": raw_group_id,
                "encoded_group_id": cls._encode_group_id(type_key, raw_group_id),
                "group_key": row.get("group_key"),
                "group_title": row.get("group_title"),
                "is_active": bool(row.get("is_active", 0)),
            }
        return assignments

    @classmethod
    def _fetch_item_row(cls, menu_type, row_id):
        normalized_type = "formal" if str(menu_type or "").strip().lower() == "formal" else "regular"
        row = query_db(
            """
      SELECT
        i.id,
        i.item_key,
        i.item_name,
        i.item_type,
        i.item_category,
        i.is_active,
        i.tray_price_half,
        i.tray_price_full,
        i.created_at,
        i.updated_at,
        g.id AS group_id,
        g.group_key,
        g.group_name AS group_title
      FROM menu_items i
      JOIN menu_item_type_groups mitg ON mitg.menu_item_id = i.id
      JOIN menu_types mt ON mt.id = mitg.menu_type_id
      JOIN menu_groups g ON g.id = mitg.menu_group_id
      WHERE i.id = %(id)s
        AND mt.type_key = %(menu_type)s
        AND mitg.is_active = 1
      LIMIT 1;
      """,
            {"id": row_id, "menu_type": normalized_type},
            fetch="one",
        )
        if not row:
            return None

        return {
            "id": cls._encode_item_id(normalized_type, row.get("id")),
            "menu_type": normalized_type,
            "item_key": row.get("item_key"),
            "item_name": row.get("item_name"),
            "item_type": row.get("item_type"),
            "item_category": row.get("item_category"),
            "is_active": bool(row.get("is_active", 0)),
            "group_id": cls._encode_group_id(normalized_type, row.get("group_id")),
            "group_key": row.get("group_key"),
            "group_title": row.get("group_title"),
            "tray_price_half": (
                cls._serialize_price(row.get("tray_price_half")) if normalized_type == "regular" else None
            ),
            "tray_price_full": (
                cls._serialize_price(row.get("tray_price_full")) if normalized_type == "regular" else None
            ),
            "created_at": cls._to_iso(row.get("created_at")),
            "updated_at": cls._to_iso(row.get("updated_at")),
            "_raw_row_id": row.get("id"),
        }

    @classmethod
    def get_menu_item_detail(cls, item_id):
        menu_type, row_id = cls._decode_item_id(item_id)
        if not menu_type or not row_id:
            return None

        item = cls._fetch_item_row(menu_type, row_id)
        if not item:
            raw_row = cls._fetch_raw_item_row(row_id=row_id, connection=None)
            if not raw_row:
                return None
            return cls._build_unassigned_item_detail(menu_type, row_id, raw_row)

        menu_types = cls._fetch_item_types(row_id)
        assignments_by_type = cls._fetch_item_assignments(row_id)
        ordered_types = [type_key for type_key in menu_types if type_key in assignments_by_type]
        if not ordered_types:
            ordered_types = list(assignments_by_type.keys())

        response_item = {k: v for k, v in item.items() if not k.startswith("_")}
        response_item["menu_types"] = menu_types

        option_group_assignments = []
        for index, type_key in enumerate(ordered_types):
            assignment = assignments_by_type.get(type_key)
            if not assignment:
                continue
            option_group_assignments.append(
                {
                    "id": assignment.get("encoded_group_id"),
                    "group_id": assignment.get("encoded_group_id"),
                    "option_key": assignment.get("group_key"),
                    "group_title": assignment.get("group_title"),
                    "menu_type": type_key,
                    "category": type_key,
                    "display_order": index + 1,
                    "is_active": bool(assignment.get("is_active", 0)),
                }
            )

        if not option_group_assignments:
            option_group_assignments = [
                {
                    "id": response_item.get("group_id"),
                    "group_id": response_item.get("group_id"),
                    "option_key": response_item.get("group_key"),
                    "group_title": response_item.get("group_title"),
                    "menu_type": response_item.get("menu_type"),
                    "category": response_item.get("menu_type"),
                    "display_order": 1,
                    "is_active": True,
                }
            ]

        return {
            **response_item,
            "option_group_assignments": option_group_assignments,
            "section_row_assignments": [],
            "tier_bullet_assignments": [],
        }

    @classmethod
    def _fetch_type_id_map(cls, connection):
        rows = query_db(
            "SELECT id, type_key FROM menu_types WHERE is_active = 1;",
            connection=connection,
            auto_commit=False,
        )
        return {str(row.get("type_key") or "").strip().lower(): row.get("id") for row in rows}

    @classmethod
    def _resolve_group_for_type(cls, type_key, group_id_value, connection):
        _, raw_group_id = cls._decode_group_id(group_id_value, menu_type=type_key)
        if not raw_group_id:
            return None

        row = query_db(
            """
      SELECT
        g.id,
        g.group_key,
        g.group_name
      FROM menu_types mt
      JOIN menu_type_groups tg ON tg.menu_type_id = mt.id AND tg.is_active = 1
      JOIN menu_groups g ON g.id = tg.menu_group_id AND g.is_active = 1
      WHERE mt.type_key = %(type_key)s
        AND mt.is_active = 1
        AND g.id = %(group_id)s
      LIMIT 1;
      """,
            {"type_key": type_key, "group_id": raw_group_id},
            fetch="one",
            connection=connection,
            auto_commit=False,
        )
        if not row:
            return None

        return {
            "type_key": type_key,
            "group_id": row.get("id"),
            "group_key": row.get("group_key"),
            "group_title": row.get("group_name"),
            "encoded_group_id": cls._encode_group_id(type_key, row.get("id")),
        }

    @classmethod
    def _extract_requested_group_map(
        cls,
        type_keys,
        body,
        existing_assignments=None,
        default_type=None,
        fan_out_untyped=False,
    ):
        requested = {}
        for type_key in type_keys:
            if existing_assignments and existing_assignments.get(type_key):
                requested[type_key] = existing_assignments[type_key].get("raw_group_id")

        untyped_group_values = []

        for assignment in body.get("option_group_assignments") or []:
            if not isinstance(assignment, dict):
                continue
            if cls._to_bool(assignment.get("is_active"), default=True) is False:
                continue

            group_id_value = assignment.get("group_id") or assignment.get("id")
            if not group_id_value:
                continue

            assignment_type = str(assignment.get("menu_type") or assignment.get("category") or "").strip().lower()
            if assignment_type in ("regular", "formal") and assignment_type in type_keys:
                requested[assignment_type] = group_id_value
            elif assignment_type in ("regular", "formal"):
                continue
            else:
                untyped_group_values.append(group_id_value)

        top_level_group = body.get("group_id")
        if top_level_group not in (None, ""):
            untyped_group_values.append(top_level_group)

        if untyped_group_values:
            untyped_value = untyped_group_values[0]
            if len(type_keys) == 1:
                requested[type_keys[0]] = untyped_group_values[-1]
            elif default_type in type_keys:
                requested[default_type] = untyped_value
                if fan_out_untyped:
                    for type_key in type_keys:
                        requested.setdefault(type_key, untyped_value)
            elif fan_out_untyped:
                for type_key in type_keys:
                    requested.setdefault(type_key, untyped_value)

        return requested

    @classmethod
    def _resolve_group_assignments(cls, type_keys, requested_group_map, connection):
        resolved = {}
        for type_key in type_keys:
            group_id_value = requested_group_map.get(type_key)
            if group_id_value in (None, ""):
                return None, f"A valid active group is required for {type_key} menu type."

            resolved_group = cls._resolve_group_for_type(type_key, group_id_value, connection=connection)
            if not resolved_group:
                return None, f"Group assignment is not valid for {type_key} menu type."

            resolved[type_key] = resolved_group

        return resolved, None

    @classmethod
    def _validate_group_conflicts(cls, resolved_assignments, connection):
        type_keys = sorted(resolved_assignments.keys())
        for left_index in range(len(type_keys)):
            left_type = type_keys[left_index]
            left_group = resolved_assignments[left_type]
            for right_index in range(left_index + 1, len(type_keys)):
                right_type = type_keys[right_index]
                right_group = resolved_assignments[right_type]

                group_a = min(int(left_group["group_id"]), int(right_group["group_id"]))
                group_b = max(int(left_group["group_id"]), int(right_group["group_id"]))
                conflict = query_db(
                    """
          SELECT id
          FROM menu_group_conflicts
          WHERE group_a_id = %(group_a_id)s
            AND group_b_id = %(group_b_id)s
          LIMIT 1;
          """,
                    {"group_a_id": group_a, "group_b_id": group_b},
                    fetch="one",
                    connection=connection,
                    auto_commit=False,
                )
                if conflict:
                    return (
                        f"Group combination is not allowed: "
                        f"{left_group['group_title']} ({left_type}) + {right_group['group_title']} ({right_type})."
                    )
        return None

    @classmethod
    def _set_item_type_assignments(cls, row_id, assignments_by_type, type_id_map, connection):
        query_db(
            "DELETE FROM menu_item_type_groups WHERE menu_item_id = %(row_id)s;",
            {"row_id": row_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )

        insert_rows = []
        for type_key, assignment in assignments_by_type.items():
            type_id = type_id_map.get(type_key)
            group_id = assignment.get("group_id") if isinstance(assignment, dict) else None
            if not type_id or not group_id:
                continue
            insert_rows.append(
                {
                    "menu_item_id": row_id,
                    "menu_type_id": type_id,
                    "menu_group_id": group_id,
                    "is_active": 1,
                }
            )

        if insert_rows:
            query_db_many(
                """
      INSERT INTO menu_item_type_groups (menu_item_id, menu_type_id, menu_group_id, is_active)
      VALUES (%(menu_item_id)s, %(menu_type_id)s, %(menu_group_id)s, %(is_active)s);
      """,
                insert_rows,
                connection=connection,
                auto_commit=False,
            )

    @classmethod
    def _has_item_name_conflict(cls, item_name, type_keys, connection, exclude_row_id=None):
        normalized_name = str(item_name or "").strip()
        if not normalized_name:
            return False

        payload = {"item_name": normalized_name}
        if exclude_row_id:
            payload["exclude_row_id"] = exclude_row_id

        key_tokens = []
        for index, type_key in enumerate(type_keys):
            token = f"type_{index}"
            key_tokens.append(token)
            payload[token] = type_key
        in_clause = ", ".join([f"%({token})s" for token in key_tokens]) or "'regular'"

        exclude_sql = "AND i.id <> %(exclude_row_id)s" if exclude_row_id else ""
        existing = query_db(
            f"""
      SELECT i.id
      FROM menu_items i
      JOIN menu_item_type_groups mitg ON mitg.menu_item_id = i.id
      JOIN menu_types mt ON mt.id = mitg.menu_type_id
      WHERE LOWER(TRIM(i.item_name)) = LOWER(TRIM(%(item_name)s))
        AND mt.type_key IN ({in_clause})
        AND mitg.is_active = 1
        {exclude_sql}
      LIMIT 1;
      """,
            payload,
            fetch="one",
            connection=connection,
            auto_commit=False,
        )
        return bool(existing)

    @classmethod
    def _has_global_item_name_conflict(cls, item_name, connection, exclude_row_id=None):
        normalized_name = str(item_name or "").strip()
        if not normalized_name:
            return False

        existing = query_db(
            """
      SELECT id
      FROM menu_items
      WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(%(item_name)s))
        AND (%(exclude_row_id)s IS NULL OR id <> %(exclude_row_id)s)
      LIMIT 1;
      """,
            {
                "item_name": normalized_name,
                "exclude_row_id": exclude_row_id,
            },
            fetch="one",
            connection=connection,
            auto_commit=False,
        )
        return bool(existing)

    @classmethod
    def _generate_unique_item_key(cls, item_name, provided_key, connection, exclude_row_id=None):
        base_key = cls._slugify_item_key(provided_key or item_name) or "item"
        candidate = base_key
        suffix = 2
        while query_db(
            """
      SELECT id
      FROM menu_items
      WHERE item_key = %(item_key)s
        AND (%(exclude_row_id)s IS NULL OR id <> %(exclude_row_id)s)
      LIMIT 1;
      """,
            {"item_key": candidate, "exclude_row_id": exclude_row_id},
            fetch="one",
            connection=connection,
            auto_commit=False,
        ):
            candidate = f"{base_key}_{suffix}"
            suffix += 1
        return candidate[:128]

    @classmethod
    def _fetch_raw_item_row(cls, row_id, connection):
        return query_db(
            """
      SELECT id, item_key, item_name, item_type, item_category, tray_price_half, tray_price_full, is_active
      FROM menu_items
      WHERE id = %(row_id)s
      LIMIT 1;
      """,
            {"row_id": row_id},
            fetch="one",
            connection=connection,
            auto_commit=False,
        )

    @classmethod
    def create_menu_item(cls, payload):
        body = payload or {}
        item_name = str(body.get("item_name") or "").strip()
        if not item_name:
            return {"error": "item_name is required."}, 400

        explicit_empty_type_selection = (
            body.get("menu_type") in (None, "")
            or (isinstance(body.get("menu_type"), (list, tuple, set)) and len(body.get("menu_type")) == 0)
        )
        type_keys = [] if explicit_empty_type_selection else cls._normalize_menu_type_request(body.get("menu_type"))
        requested_group_map = cls._extract_requested_group_map(
            type_keys=type_keys,
            body=body,
            existing_assignments=None,
            default_type=type_keys[0] if type_keys else None,
            fan_out_untyped=True,
        )

        with db_transaction() as connection:
            if cls._has_global_item_name_conflict(item_name, connection):
                return {"error": "Item name must be unique."}, 409

            if type_keys:
                type_id_map = cls._fetch_type_id_map(connection=connection)
                if any(type_id_map.get(type_key) is None for type_key in type_keys):
                    return {"error": "Invalid menu_type supplied."}, 400

                resolved_assignments, assignment_error = cls._resolve_group_assignments(
                    type_keys=type_keys,
                    requested_group_map=requested_group_map,
                    connection=connection,
                )
                if assignment_error:
                    return {"error": assignment_error}, 400

                conflict_error = cls._validate_group_conflicts(resolved_assignments, connection=connection)
                if conflict_error:
                    return {"error": conflict_error}, 400

                if cls._has_item_name_conflict(item_name, type_keys, connection):
                    return {"error": "Item name must be unique within this menu type."}, 409
            else:
                type_id_map = {}
                resolved_assignments = {}

            is_active = cls._to_bool(body.get("is_active"), default=True)
            if not type_keys:
                is_active = False
            item_type = str(body.get("item_type") or "").strip() or None
            item_category = str(body.get("item_category") or "").strip() or None
            item_key = cls._generate_unique_item_key(
                item_name=item_name,
                provided_key=body.get("item_key"),
                connection=connection,
            )

            has_regular = "regular" in type_keys
            half_price = cls._to_price_decimal(
                body.get("tray_price_half"),
                default=Decimal("0.00") if has_regular else None,
            )
            full_price = cls._to_price_decimal(
                body.get("tray_price_full"),
                default=Decimal("0.00") if has_regular else None,
            )

            inserted_row_id = query_db(
                """
        INSERT INTO menu_items (item_key, item_name, item_type, item_category, is_active, tray_price_half, tray_price_full)
        VALUES (%(item_key)s, %(item_name)s, %(item_type)s, %(item_category)s, %(is_active)s, %(tray_price_half)s, %(tray_price_full)s);
        """,
                {
                    "item_key": item_key,
                    "item_name": item_name,
                    "item_type": item_type,
                    "item_category": item_category,
                    "is_active": 1 if is_active else 0,
                    "tray_price_half": cls._serialize_price(half_price),
                    "tray_price_full": cls._serialize_price(full_price),
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            cls._set_item_type_assignments(
                row_id=inserted_row_id,
                assignments_by_type=resolved_assignments,
                type_id_map=type_id_map,
                connection=connection,
            )

        primary_menu_type = "formal" if type_keys == ["formal"] else "regular"
        encoded_id = cls._encode_item_id(primary_menu_type, inserted_row_id)
        created = cls.get_menu_item_detail(encoded_id)
        return {"item": created}, 201

    @classmethod
    def update_menu_item(cls, item_id, payload):
        menu_type, row_id = cls._decode_item_id(item_id)
        if not menu_type or not row_id:
            return {"error": "Invalid menu item id."}, 400

        current = cls._fetch_item_row(menu_type, row_id)
        if not current:
            raw_row = cls._fetch_raw_item_row(row_id=row_id, connection=None)
            if not raw_row:
                return {"error": "Menu item not found."}, 404
            current = {
                "id": cls._encode_item_id(menu_type or "regular", row_id),
                "menu_type": menu_type,
                "item_key": raw_row.get("item_key"),
                "item_name": raw_row.get("item_name"),
                "item_type": raw_row.get("item_type"),
                "item_category": raw_row.get("item_category"),
                "is_active": bool(raw_row.get("is_active", 0)),
                "group_id": None,
                "group_key": None,
                "group_title": None,
                "tray_price_half": cls._serialize_price(raw_row.get("tray_price_half")),
                "tray_price_full": cls._serialize_price(raw_row.get("tray_price_full")),
                "_raw_row_id": row_id,
            }

        body = payload or {}
        next_name = str(body.get("item_name") if "item_name" in body else current["item_name"] or "").strip()
        if not next_name:
            return {"error": "item_name cannot be empty."}, 400

        next_is_active = cls._to_bool(body.get("is_active"), default=current["is_active"])
        existing_type_keys = cls._fetch_item_types(row_id)
        explicit_empty_type_selection = isinstance(body.get("menu_type"), (list, tuple, set)) and len(body.get("menu_type")) == 0
        next_type_keys = (
            [] if explicit_empty_type_selection else (
                cls._normalize_menu_type_request(body.get("menu_type"))
                if "menu_type" in body
                else (existing_type_keys or [menu_type])
            )
        )
        if not next_type_keys:
            next_is_active = False

        with db_transaction() as connection:
            if cls._has_global_item_name_conflict(next_name, connection, exclude_row_id=row_id):
                return {"error": "Item name must be unique."}, 409

            if next_type_keys:
                type_id_map = cls._fetch_type_id_map(connection=connection)
                if any(type_id_map.get(type_key) is None for type_key in next_type_keys):
                    return {"error": "Invalid menu_type supplied."}, 400

                existing_assignments = cls._fetch_item_assignments(row_id=row_id, connection=connection)
                fan_out_untyped = str(body.get("menu_type") or "").strip().lower() == "both"
                requested_group_map = cls._extract_requested_group_map(
                    type_keys=next_type_keys,
                    body=body,
                    existing_assignments=existing_assignments,
                    default_type=menu_type,
                    fan_out_untyped=fan_out_untyped,
                )

                missing_type_keys = [
                    type_key
                    for type_key in next_type_keys
                    if requested_group_map.get(type_key) in (None, "")
                ]
                if missing_type_keys and requested_group_map:
                    fallback_group = next(
                        (
                            requested_group_map.get(type_key)
                            for type_key in next_type_keys
                            if requested_group_map.get(type_key) not in (None, "")
                        ),
                        None,
                    )
                    if fallback_group not in (None, ""):
                        for type_key in missing_type_keys:
                            requested_group_map[type_key] = fallback_group

                resolved_assignments, assignment_error = cls._resolve_group_assignments(
                    type_keys=next_type_keys,
                    requested_group_map=requested_group_map,
                    connection=connection,
                )
                if assignment_error:
                    return {"error": assignment_error}, 400

                conflict_error = cls._validate_group_conflicts(resolved_assignments, connection=connection)
                if conflict_error:
                    return {"error": conflict_error}, 400

                if cls._has_item_name_conflict(next_name, next_type_keys, connection, exclude_row_id=row_id):
                    return {"error": "Item name must be unique within this menu type."}, 409
            else:
                type_id_map = {}
                resolved_assignments = {}

            next_key = cls._generate_unique_item_key(
                item_name=next_name,
                provided_key=body.get("item_key") or next_name,
                connection=connection,
                exclude_row_id=row_id,
            )

            raw_row = cls._fetch_raw_item_row(row_id=row_id, connection=connection)
            next_item_type = (
                str(body.get("item_type") if "item_type" in body else raw_row.get("item_type") or "").strip() or None
            )
            next_item_category = (
                str(body.get("item_category") if "item_category" in body else raw_row.get("item_category") or "").strip()
                or None
            )
            has_regular = "regular" in next_type_keys
            half_input = body.get("tray_price_half")
            full_input = body.get("tray_price_full")

            next_half = cls._to_price_decimal(
                half_input if half_input is not None else raw_row.get("tray_price_half"),
                default=None if not has_regular else Decimal("0.00"),
            )
            next_full = cls._to_price_decimal(
                full_input if full_input is not None else raw_row.get("tray_price_full"),
                default=None if not has_regular else Decimal("0.00"),
            )

            query_db(
                """
        UPDATE menu_items
        SET
          item_key = %(item_key)s,
          item_name = %(item_name)s,
          item_type = %(item_type)s,
          item_category = %(item_category)s,
          is_active = %(is_active)s,
          tray_price_half = %(tray_price_half)s,
          tray_price_full = %(tray_price_full)s,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = %(id)s;
        """,
                {
                    "id": row_id,
                    "item_key": next_key,
                    "item_name": next_name,
                    "item_type": next_item_type,
                    "item_category": next_item_category,
                    "is_active": 1 if next_is_active else 0,
                    "tray_price_half": cls._serialize_price(next_half),
                    "tray_price_full": cls._serialize_price(next_full),
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            cls._set_item_type_assignments(
                row_id=row_id,
                assignments_by_type=resolved_assignments,
                type_id_map=type_id_map,
                connection=connection,
            )

        if not next_type_keys:
            raw_row = cls._fetch_raw_item_row(row_id=row_id, connection=None) or {}
            updated = cls._build_unassigned_item_detail(menu_type, row_id, raw_row)
            return {"item": updated}, 200

        response_type = menu_type if menu_type in next_type_keys else ("regular" if "regular" in next_type_keys else "formal")
        updated = cls.get_menu_item_detail(cls._encode_item_id(response_type, row_id))
        return {"item": updated}, 200

    @classmethod
    def delete_menu_item(cls, item_id):
        menu_type, row_id = cls._decode_item_id(item_id)
        if not menu_type or not row_id:
            return {"error": "Invalid menu item id."}, 400

        with db_transaction() as connection:
            raw_row = cls._fetch_raw_item_row(row_id=row_id, connection=connection)
            if not raw_row:
                return {"error": "Menu item not found."}, 404

            query_db(
                """
        DELETE FROM menu_items
        WHERE id = %(id)s
        LIMIT 1;
        """,
                {"id": row_id},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        return {
            "ok": True,
            "deleted_item_id": item_id,
            "item_name": str(raw_row.get("item_name") or "").strip(),
        }, 200

    @classmethod
    def list_sections(cls, search="", catalog_key="", is_active=None, limit=250):
        return []

    @classmethod
    def get_section_detail(cls, section_id):
        return None

    @classmethod
    def update_section(cls, section_id, payload):
        return {"error": "Section management is not available in the simplified menu schema."}, 404
