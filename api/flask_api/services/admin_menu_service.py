import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask_api.config.mysqlconnection import db_transaction, query_db


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
            return "formal", numeric_id - cls._FORMAL_ID_OFFSET if numeric_id > cls._FORMAL_ID_OFFSET else numeric_id
        if menu_type == "regular":
            return "regular", numeric_id if numeric_id <= cls._FORMAL_ID_OFFSET else numeric_id - cls._FORMAL_ID_OFFSET

        if numeric_id > cls._FORMAL_ID_OFFSET:
            return "formal", numeric_id - cls._FORMAL_ID_OFFSET
        return "regular", numeric_id

    @staticmethod
    def _table_names_for_menu_type(menu_type):
        normalized = str(menu_type or "").strip().lower()
        if normalized == "formal":
            return "formal_menu_items", "formal_menu_groups", "formal"
        return "general_menu_items", "general_menu_groups", "regular"

    @classmethod
    def _generate_unique_item_key(cls, item_name, provided_key, items_table, connection):
        base_key = cls._slugify_item_key(provided_key or item_name) or "item"
        candidate = base_key
        suffix = 2
        while query_db(
            f"SELECT id FROM {items_table} WHERE `key` = %(item_key)s LIMIT 1;",
            {"item_key": candidate},
            fetch="one",
            connection=connection,
            auto_commit=False,
        ):
            candidate = f"{base_key}_{suffix}"
            suffix += 1
        return candidate[:128]

    @classmethod
    def _has_item_name_conflict(cls, items_table, item_name, connection, exclude_row_id=None):
        normalized_name = str(item_name or "").strip()
        if not normalized_name:
            return False

        payload = {"item_name": normalized_name}
        where_clause = "LOWER(TRIM(name)) = LOWER(TRIM(%(item_name)s))"
        if exclude_row_id:
            where_clause += " AND id <> %(exclude_row_id)s"
            payload["exclude_row_id"] = exclude_row_id

        existing = query_db(
            f"""
      SELECT id
      FROM {items_table}
      WHERE {where_clause}
      LIMIT 1;
      """,
            payload,
            fetch="one",
            connection=connection,
            auto_commit=False,
        )
        return bool(existing)

    @staticmethod
    def _to_price_decimal(value, default=Decimal("0.00")):
        text = str(value or "").strip()
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
        general_groups = query_db(
            """
      SELECT id, `key`, name, sort_order, is_active
      FROM general_menu_groups
      ORDER BY sort_order ASC, id ASC;
      """
        )
        formal_groups = query_db(
            """
      SELECT id, `key`, name, sort_order, is_active
      FROM formal_menu_groups
      ORDER BY sort_order ASC, id ASC;
      """
        )

        option_groups = [cls._build_option_group_row(row, "regular") for row in general_groups]
        option_groups.extend(cls._build_option_group_row(row, "formal") for row in formal_groups)

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

        general_rows = query_db(
            """
      SELECT
        i.id,
        i.`key` AS item_key,
        i.name AS item_name,
        i.is_active,
        i.half_tray_price,
        i.full_tray_price,
        i.created_at,
        i.updated_at,
        g.id AS group_id,
        g.`key` AS group_key,
        g.name AS group_title
      FROM general_menu_items i
      JOIN general_menu_groups g ON g.id = i.group_id
      ORDER BY i.name ASC, i.id ASC;
      """
        )
        formal_rows = query_db(
            """
      SELECT
        i.id,
        i.`key` AS item_key,
        i.name AS item_name,
        i.is_active,
        i.created_at,
        i.updated_at,
        g.id AS group_id,
        g.`key` AS group_key,
        g.name AS group_title
      FROM formal_menu_items i
      JOIN formal_menu_groups g ON g.id = i.group_id
      ORDER BY i.name ASC, i.id ASC;
      """
        )

        combined = []
        for row in general_rows:
            combined.append(
                {
                    "id": cls._encode_item_id("regular", row.get("id")),
                    "menu_type": "regular",
                    "item_key": row.get("item_key"),
                    "item_name": row.get("item_name"),
                    "is_active": bool(row.get("is_active", 0)),
                    "group_id": cls._encode_group_id("regular", row.get("group_id")),
                    "group_key": row.get("group_key"),
                    "group_title": row.get("group_title"),
                    "tray_price_half": cls._serialize_price(row.get("half_tray_price")),
                    "tray_price_full": cls._serialize_price(row.get("full_tray_price")),
                    "option_group_count": 1,
                    "section_row_count": 0,
                    "tier_bullet_count": 0,
                    "created_at": cls._to_iso(row.get("created_at")),
                    "updated_at": cls._to_iso(row.get("updated_at")),
                }
            )

        for row in formal_rows:
            combined.append(
                {
                    "id": cls._encode_item_id("formal", row.get("id")),
                    "menu_type": "formal",
                    "item_key": row.get("item_key"),
                    "item_name": row.get("item_name"),
                    "is_active": bool(row.get("is_active", 0)),
                    "group_id": cls._encode_group_id("formal", row.get("group_id")),
                    "group_key": row.get("group_key"),
                    "group_title": row.get("group_title"),
                    "tray_price_half": None,
                    "tray_price_full": None,
                    "option_group_count": 1,
                    "section_row_count": 0,
                    "tier_bullet_count": 0,
                    "created_at": cls._to_iso(row.get("created_at")),
                    "updated_at": cls._to_iso(row.get("updated_at")),
                }
            )

        filtered = []
        for row in combined:
            if is_active_filter is not None and int(row["is_active"]) != is_active_filter:
                continue
            if normalized_search:
                haystack = f"{row.get('item_name', '')} {row.get('item_key', '')}".lower()
                if normalized_search not in haystack:
                    continue
            filtered.append(row)

        filtered.sort(key=lambda item: (str(item.get("item_name") or "").lower(), item.get("id") or 0))
        return filtered[:normalized_limit]

    @classmethod
    def _fetch_item_row(cls, menu_type, row_id):
        items_table, groups_table, normalized_type = cls._table_names_for_menu_type(menu_type)
        select_prices = "i.half_tray_price, i.full_tray_price," if normalized_type == "regular" else ""
        row = query_db(
            f"""
      SELECT
        i.id,
        i.`key` AS item_key,
        i.name AS item_name,
        i.is_active,
        {select_prices}
        i.created_at,
        i.updated_at,
        g.id AS group_id,
        g.`key` AS group_key,
        g.name AS group_title
      FROM {items_table} i
      JOIN {groups_table} g ON g.id = i.group_id
      WHERE i.id = %(id)s
      LIMIT 1;
      """,
            {"id": row_id},
            fetch="one",
        )
        if not row:
            return None
        return {
            "id": cls._encode_item_id(normalized_type, row.get("id")),
            "menu_type": normalized_type,
            "item_key": row.get("item_key"),
            "item_name": row.get("item_name"),
            "is_active": bool(row.get("is_active", 0)),
            "group_id": cls._encode_group_id(normalized_type, row.get("group_id")),
            "group_key": row.get("group_key"),
            "group_title": row.get("group_title"),
            "tray_price_half": (
                cls._serialize_price(row.get("half_tray_price")) if normalized_type == "regular" else None
            ),
            "tray_price_full": (
                cls._serialize_price(row.get("full_tray_price")) if normalized_type == "regular" else None
            ),
            "created_at": cls._to_iso(row.get("created_at")),
            "updated_at": cls._to_iso(row.get("updated_at")),
        }

    @classmethod
    def get_menu_item_detail(cls, item_id):
        menu_type, row_id = cls._decode_item_id(item_id)
        if not menu_type or not row_id:
            return None

        item = cls._fetch_item_row(menu_type, row_id)
        if not item:
            return None

        return {
            **item,
            "option_group_assignments": [
                {
                    "id": item["group_id"],
                    "group_id": item["group_id"],
                    "option_key": item["group_key"],
                    "group_title": item["group_title"],
                    "display_order": 1,
                    "is_active": True,
                }
            ],
            "section_row_assignments": [],
            "tier_bullet_assignments": [],
        }

    @classmethod
    def _resolve_group_for_menu_type(cls, menu_type, encoded_group_id, connection):
        decoded_menu_type, raw_group_id = cls._decode_group_id(encoded_group_id, menu_type=menu_type)
        if decoded_menu_type != menu_type or not raw_group_id:
            return None
        groups_table = "formal_menu_groups" if menu_type == "formal" else "general_menu_groups"
        return query_db(
            f"SELECT id, `key`, name, is_active FROM {groups_table} WHERE id = %(id)s LIMIT 1;",
            {"id": raw_group_id},
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

        requested_menu_type = str(body.get("menu_type") or "regular").strip().lower()
        menu_type = "formal" if requested_menu_type == "formal" else "regular"
        items_table, _groups_table, _normalized_type = cls._table_names_for_menu_type(menu_type)

        group_id_value = body.get("group_id")
        if not group_id_value:
            for assignment in body.get("option_group_assignments") or []:
                if isinstance(assignment, dict) and cls._to_bool(assignment.get("is_active"), default=True):
                    group_id_value = assignment.get("group_id")
                    if group_id_value:
                        break

        with db_transaction() as connection:
            group_row = cls._resolve_group_for_menu_type(menu_type, group_id_value, connection=connection)
            if not group_row or not bool(group_row.get("is_active", 0)):
                return {"error": "A valid active group is required."}, 400

            if cls._has_item_name_conflict(items_table, item_name, connection):
                return {"error": "Item name must be unique within this menu type."}, 409

            is_active = cls._to_bool(body.get("is_active"), default=True)
            item_key = cls._generate_unique_item_key(
                item_name=item_name,
                provided_key=None,
                items_table=items_table,
                connection=connection,
            )

            if menu_type == "formal":
                inserted_row_id = query_db(
                    """
          INSERT INTO formal_menu_items (`key`, name, is_active, group_id)
          VALUES (%(item_key)s, %(item_name)s, %(is_active)s, %(group_id)s);
          """,
                    {
                        "item_key": item_key,
                        "item_name": item_name,
                        "is_active": 1 if is_active else 0,
                        "group_id": group_row.get("id"),
                    },
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
                encoded_id = cls._encode_item_id("formal", inserted_row_id)
            else:
                tray_half = cls._to_price_decimal(body.get("tray_price_half"))
                tray_full = cls._to_price_decimal(body.get("tray_price_full"))
                inserted_row_id = query_db(
                    """
          INSERT INTO general_menu_items (`key`, name, is_active, group_id, half_tray_price, full_tray_price)
          VALUES (%(item_key)s, %(item_name)s, %(is_active)s, %(group_id)s, %(half_tray_price)s, %(full_tray_price)s);
          """,
                    {
                        "item_key": item_key,
                        "item_name": item_name,
                        "is_active": 1 if is_active else 0,
                        "group_id": group_row.get("id"),
                        "half_tray_price": str(tray_half),
                        "full_tray_price": str(tray_full),
                    },
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
                encoded_id = cls._encode_item_id("regular", inserted_row_id)

        created = cls.get_menu_item_detail(encoded_id)
        return {"item": created}, 201

    @classmethod
    def update_menu_item(cls, item_id, payload):
        menu_type, row_id = cls._decode_item_id(item_id)
        if not menu_type or not row_id:
            return {"error": "Invalid menu item id."}, 400

        current = cls._fetch_item_row(menu_type, row_id)
        if not current:
            return {"error": "Menu item not found."}, 404

        body = payload or {}
        items_table, _groups_table, normalized_type = cls._table_names_for_menu_type(menu_type)
        next_name = str(body.get("item_name") if "item_name" in body else current["item_name"] or "").strip()
        if not next_name:
            return {"error": "item_name cannot be empty."}, 400

        next_is_active = cls._to_bool(body.get("is_active"), default=current["is_active"])
        next_group_id_value = body.get("group_id") or current["group_id"]

        option_assignments = body.get("option_group_assignments")
        if isinstance(option_assignments, list):
            for assignment in option_assignments:
                if isinstance(assignment, dict) and cls._to_bool(assignment.get("is_active"), default=True):
                    next_group_id_value = assignment.get("group_id") or next_group_id_value
                    break

        with db_transaction() as connection:
            group_row = cls._resolve_group_for_menu_type(menu_type, next_group_id_value, connection=connection)
            if not group_row or not bool(group_row.get("is_active", 0)):
                return {"error": "A valid active group is required."}, 400

            if cls._has_item_name_conflict(items_table, next_name, connection, exclude_row_id=row_id):
                return {"error": "Item name must be unique within this menu type."}, 409

            next_key = cls._slugify_item_key(next_name) or "item"
            collision = query_db(
                f"SELECT id FROM {items_table} WHERE `key` = %(item_key)s AND id <> %(id)s LIMIT 1;",
                {"item_key": next_key, "id": row_id},
                fetch="one",
                connection=connection,
                auto_commit=False,
            )
            if collision:
                next_key = cls._generate_unique_item_key(
                    item_name=next_name,
                    provided_key=next_key,
                    items_table=items_table,
                    connection=connection,
                )

            if normalized_type == "formal":
                query_db(
                    """
          UPDATE formal_menu_items
          SET
            `key` = %(item_key)s,
            name = %(item_name)s,
            is_active = %(is_active)s,
            group_id = %(group_id)s,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = %(id)s;
          """,
                    {
                        "id": row_id,
                        "item_key": next_key,
                        "item_name": next_name,
                        "is_active": 1 if next_is_active else 0,
                        "group_id": group_row.get("id"),
                    },
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
            else:
                tray_half = body.get("tray_price_half")
                tray_full = body.get("tray_price_full")
                if tray_half is None or tray_full is None:
                    section_rows = body.get("section_row_assignments") or []
                    if section_rows and isinstance(section_rows[0], dict):
                        tray_half = section_rows[0].get("value_1", tray_half)
                        tray_full = section_rows[0].get("value_2", tray_full)

                next_half = cls._to_price_decimal(
                    tray_half if tray_half is not None else current.get("tray_price_half"), default=Decimal("0.00")
                )
                next_full = cls._to_price_decimal(
                    tray_full if tray_full is not None else current.get("tray_price_full"), default=Decimal("0.00")
                )
                query_db(
                    """
          UPDATE general_menu_items
          SET
            `key` = %(item_key)s,
            name = %(item_name)s,
            is_active = %(is_active)s,
            group_id = %(group_id)s,
            half_tray_price = %(half_tray_price)s,
            full_tray_price = %(full_tray_price)s,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = %(id)s;
          """,
                    {
                        "id": row_id,
                        "item_key": next_key,
                        "item_name": next_name,
                        "is_active": 1 if next_is_active else 0,
                        "group_id": group_row.get("id"),
                        "half_tray_price": str(next_half),
                        "full_tray_price": str(next_full),
                    },
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )

        updated = cls.get_menu_item_detail(item_id)
        return {"item": updated}, 200

    @classmethod
    def list_sections(cls, search="", catalog_key="", is_active=None, limit=250):
        return []

    @classmethod
    def get_section_detail(cls, section_id):
        return None

    @classmethod
    def update_section(cls, section_id, payload):
        return {"error": "Section management is not available in the simplified menu schema."}, 404
