import json
import os
import re
from copy import deepcopy
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

from flask_api.config.mysqlconnection import connect_to_mysql, db_transaction, query_db, query_db_many


class MenuService:
    SIMPLIFIED_TABLES = (
        "menu_item_type_groups",
        "menu_group_conflicts",
        "menu_type_groups",
        "menu_groups",
        "menu_types",
    )

    MENU_TYPES = (
        {"type_key": "regular", "type_name": "Regular", "sort_order": 1},
        {"type_key": "formal", "type_name": "Formal", "sort_order": 2},
    )

    MENU_GROUPS = (
        {"group_key": "entree", "group_name": "Entree", "sort_order": 1},
        {"group_key": "signature_protein", "group_name": "Signature Protein", "sort_order": 2},
        {"group_key": "side", "group_name": "Side", "sort_order": 3},
        {"group_key": "salad", "group_name": "Salad", "sort_order": 4},
        {"group_key": "passed_appetizer", "group_name": "Passed Appetizer", "sort_order": 5},
        {"group_key": "starter", "group_name": "Starter", "sort_order": 6},
    )

    MENU_TYPE_GROUP_LINKS = (
        {"type_key": "regular", "group_key": "entree", "display_order": 1},
        {"type_key": "regular", "group_key": "signature_protein", "display_order": 2},
        {"type_key": "regular", "group_key": "side", "display_order": 3},
        {"type_key": "regular", "group_key": "salad", "display_order": 4},
        {"type_key": "formal", "group_key": "passed_appetizer", "display_order": 1},
        {"type_key": "formal", "group_key": "starter", "display_order": 2},
        {"type_key": "formal", "group_key": "entree", "display_order": 3},
        {"type_key": "formal", "group_key": "side", "display_order": 4},
    )

    FORMAL_PLAN_OPTIONS = (
        {
            "id": "formal:2-course",
            "level": "package",
            "title": "Two-Course Dinner",
            "price": "$65-$90 per person",
            "details": ["1 Starter", "1 Entree", "Bread"],
            "constraints": {"starter": {"min": 1, "max": 1}, "entree": {"min": 1, "max": 1}},
        },
        {
            "id": "formal:3-course",
            "level": "package",
            "title": "Three-Course Dinner",
            "price": "$75-$110+ per person",
            "details": ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"],
            "constraints": {
                "passed": {"min": 2, "max": 2},
                "starter": {"min": 1, "max": 1},
                "entree": {"min": 1, "max": 2},
            },
        },
    )

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
    def _to_snake_case(value):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", str(value)).lower()

    @classmethod
    def _to_snake_case_keys(cls, value):
        if isinstance(value, list):
            return [cls._to_snake_case_keys(item) for item in value]
        if isinstance(value, dict):
            return {cls._to_snake_case(key): cls._to_snake_case_keys(item) for key, item in value.items()}
        return value

    @classmethod
    def _normalize_menu_payload_for_api(cls, payload):
        menu_options = payload.get("menu_options", {})
        formal_plan_options = payload.get("formal_plan_options", [])
        menu = payload.get("menu", {})

        normalized_menu_options = {key: cls._to_snake_case_keys(option) for key, option in menu_options.items()}
        normalized_menu = {key: cls._to_snake_case_keys(catalog) for key, catalog in menu.items()}

        return {
            "menu_options": normalized_menu_options,
            "formal_plan_options": cls._to_snake_case_keys(formal_plan_options),
            "menu": normalized_menu,
        }

    @staticmethod
    def _load_seed_payload():
        seed_path = Path(__file__).resolve().parents[2] / "sql" / "menu_seed_payload.json"
        if not seed_path.exists():
            return None
        with seed_path.open("r", encoding="utf-8") as fp:
            raw = json.load(fp)
        return {
            "menu_options": raw.get("MENU_OPTIONS", {}),
            "formal_plan_options": raw.get("FORMAL_PLAN_OPTIONS", []),
            "menu": raw.get("MENU", {}),
        }

    @staticmethod
    def _load_sql_file(path):
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    @staticmethod
    def _get_schema_paths():
        sql_root = Path(__file__).resolve().parents[2] / "sql"
        return [
            sql_root / "schema.sql",
            sql_root / "migrations" / "20260221_menu_drop_legacy_tables.sql",
            sql_root / "migrations" / "20260222_menu_unified_item_model.sql",
        ]

    @staticmethod
    def _split_sql_statements(sql_text):
        statements = []
        current = []
        in_single_quote = False
        in_double_quote = False

        for char in sql_text:
            if char == "'" and not in_double_quote:
                in_single_quote = not in_single_quote
            elif char == '"' and not in_single_quote:
                in_double_quote = not in_double_quote

            if char == ";" and not in_single_quote and not in_double_quote:
                stmt = "".join(current).strip()
                if stmt:
                    statements.append(stmt)
                current = []
            else:
                current.append(char)

        tail = "".join(current).strip()
        if tail:
            statements.append(tail)
        return statements

    @staticmethod
    def _is_ignorable_schema_error(exc, normalized_statement):
        error_code = getattr(exc, "args", [None])[0]
        if normalized_statement.startswith("alter table"):
            return error_code in {1060, 1061, 1091, 1826}
        if normalized_statement.startswith("insert into slides"):
            return error_code == 1062
        return False

    @classmethod
    def _apply_schema(cls):
        statement_batches = []
        for path in cls._get_schema_paths():
            sql_text = cls._load_sql_file(path)
            if not sql_text:
                if path.name == "schema.sql":
                    raise FileNotFoundError("api/sql/schema.sql not found.")
                continue
            statements = cls._split_sql_statements(sql_text)
            if statements:
                statement_batches.append(statements)

        if not statement_batches:
            return 0

        connection = connect_to_mysql()
        executed = 0
        try:
            with connection.cursor() as cursor:
                for statements in statement_batches:
                    for statement in statements:
                        normalized = " ".join(statement.strip().split()).lower()
                        try:
                            cursor.execute(statement)
                            executed += 1
                        except Exception as exc:
                            if cls._is_ignorable_schema_error(exc, normalized):
                                continue
                            raise
            connection.commit()
            return executed
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @classmethod
    def _truncate_simplified_tables(cls):
        connection = connect_to_mysql()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
                for table_name in cls.SIMPLIFIED_TABLES:
                    cursor.execute(f"TRUNCATE TABLE `{table_name}`;")
                cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _slug_key(value):
        slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
        return slug[:120] if slug else "item"

    @staticmethod
    def _parse_price_decimal(value):
        text = str(value or "").strip()
        if not text or text in {"-", "--"}:
            return None
        match = re.search(r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text.replace("$", ""))
        if not match:
            return None
        try:
            return Decimal(match.group(1).replace(",", "")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _format_price_display(amount):
        if amount is None:
            return None
        value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if value == value.to_integral():
            return f"${int(value):,}"
        return f"${value:,.2f}"

    @staticmethod
    def _price_to_float(value):
        parsed = MenuService._parse_price_decimal(value)
        if parsed is None:
            return None
        return float(parsed)

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
    def _general_group_from_legacy(cls, category, item_name, type_hint):
        normalized_category = str(category or "").strip().lower().replace(" ", "_")
        normalized_type = str(type_hint or "").strip().lower().replace(" ", "_")
        normalized_name = str(item_name or "").strip().lower()

        if "signature" in normalized_type:
            return "signature_protein"
        if normalized_category in {"signature_protein", "signature_proteins"}:
            return "signature_protein"
        if normalized_category in {"salad", "salads"}:
            return "salad"
        if normalized_category in {"side", "sides", "sides_salads"}:
            return "salad" if "salad" in normalized_name else "side"
        if normalized_category in {"entree", "entrees", "protein", "proteins"}:
            return "entree"
        return "entree"

    @staticmethod
    def _formal_group_from_legacy(course_type, section_id):
        source = f"{course_type or ''} {section_id or ''}".lower()
        if "passed" in source:
            return "passed_appetizer"
        if "starter" in source:
            return "starter"
        if "side" in source:
            return "side"
        return "entree"

    @classmethod
    def _extract_simplified_items_from_payload(cls, payload):
        menu_options = payload.get("menu_options") or {}
        menu = payload.get("menu") or {}

        general_by_name = {}
        formal_by_name = {}

        def ensure_general(name, group_key=None, half=None, full=None):
            item_name = str(name or "").strip()
            if not item_name:
                return
            current = general_by_name.setdefault(
                item_name, {"name": item_name, "group_key": "entree", "half": None, "full": None}
            )
            if group_key:
                current["group_key"] = group_key
            if half is not None:
                current["half"] = half
            if full is not None:
                current["full"] = full

        for option_key, group in (menu_options or {}).items():
            if not isinstance(group, dict):
                continue
            category = group.get("category")
            for item_name in group.get("items", []) or []:
                ensure_general(
                    item_name,
                    cls._general_group_from_legacy(category, item_name, option_key),
                )

        togo_sections = ((menu or {}).get("togo") or {}).get("sections") or []
        for section in togo_sections:
            if not isinstance(section, dict):
                continue
            for row in section.get("rows", []) or []:
                if not isinstance(row, list) or not row:
                    continue
                name = row[0]
                half = cls._parse_price_decimal(row[1] if len(row) > 1 else None)
                full = cls._parse_price_decimal(row[2] if len(row) > 2 else None)
                ensure_general(
                    name,
                    group_key=cls._general_group_from_legacy(section.get("category"), name, section.get("sectionId")),
                    half=half,
                    full=full,
                )

        formal_sections = ((menu or {}).get("formal") or {}).get("sections") or []
        for section in formal_sections:
            if not isinstance(section, dict):
                continue
            if str(section.get("type") or "").strip().lower() != "tiers":
                continue
            group_key = cls._formal_group_from_legacy(section.get("courseType"), section.get("sectionId"))
            for tier in section.get("tiers", []) or []:
                if not isinstance(tier, dict):
                    continue
                for bullet in tier.get("bullets", []) or []:
                    item_name = str(bullet or "").strip()
                    if not item_name:
                        continue
                    formal_by_name.setdefault(item_name, {"name": item_name, "group_key": group_key})

        general_rows = []
        for row in sorted(general_by_name.values(), key=lambda item: item["name"].lower()):
            half = row.get("half")
            full = row.get("full")
            if half is None and full is None:
                half = Decimal("0.00")
                full = Decimal("0.00")
            elif half is None:
                half = full
            elif full is None:
                full = half
            half = max(half, Decimal("0.00"))
            full = max(full, Decimal("0.00"))
            general_rows.append(
                {
                    "name": row["name"],
                    "group_key": row["group_key"],
                    "half_tray_price": half,
                    "full_tray_price": full,
                }
            )

        formal_rows = sorted(formal_by_name.values(), key=lambda item: item["name"].lower())
        return general_rows, formal_rows

    @classmethod
    def _assign_unique_keys(cls, rows):
        key_counts = {}
        output = []
        for row in rows:
            base = cls._slug_key(row.get("name"))
            count = key_counts.get(base, 0) + 1
            key_counts[base] = count
            key = base if count == 1 else f"{base}-{count}"
            output.append({**row, "key": key[:128]})
        return output

    @classmethod
    def _merge_simplified_rows(cls, general_rows, formal_rows):
        merged = {}

        def merge_row(name, group_key, half, full, type_key, source_priority):
            normalized_name = str(name or "").strip()
            if not normalized_name:
                return
            bucket_key = normalized_name.lower()
            current = merged.setdefault(
                bucket_key,
                {
                    "name": normalized_name,
                    "type_groups": {},
                    "half_tray_price": None,
                    "full_tray_price": None,
                    "group_priority": {},
                },
            )

            current["type_groups"].setdefault(type_key, None)
            existing_priority = current["group_priority"].get(type_key, 99)
            if group_key and source_priority < existing_priority:
                current["type_groups"][type_key] = group_key
                current["group_priority"][type_key] = source_priority

            if half is not None and current["half_tray_price"] is None:
                current["half_tray_price"] = half
            if full is not None and current["full_tray_price"] is None:
                current["full_tray_price"] = full

        for row in general_rows:
            merge_row(
                name=row.get("name"),
                group_key=row.get("group_key"),
                half=row.get("half_tray_price"),
                full=row.get("full_tray_price"),
                type_key="regular",
                source_priority=1,
            )
        for row in formal_rows:
            merge_row(
                name=row.get("name"),
                group_key=row.get("group_key"),
                half=None,
                full=None,
                type_key="formal",
                source_priority=2,
            )

        rows = []
        for value in merged.values():
            type_groups = value["type_groups"]
            type_keys = sorted(type_groups.keys())
            half = value["half_tray_price"]
            full = value["full_tray_price"]

            if "regular" in type_keys:
                if half is None and full is None:
                    half = Decimal("0.00")
                    full = Decimal("0.00")
                elif half is None:
                    half = full
                elif full is None:
                    full = half

            rows.append(
                {
                    "name": value["name"],
                    "half_tray_price": half,
                    "full_tray_price": full,
                    "menu_types": type_keys,
                    "type_groups": {type_key: (type_groups.get(type_key) or "entree") for type_key in type_keys},
                }
            )

        rows.sort(key=lambda row: row["name"].lower())
        return cls._assign_unique_keys(rows)

    @classmethod
    def _ensure_reference_tables(cls, connection):
        for menu_type in cls.MENU_TYPES:
            query_db(
                """
          INSERT INTO menu_types (type_key, type_name, sort_order, is_active)
          VALUES (%(type_key)s, %(type_name)s, %(sort_order)s, 1)
          ON DUPLICATE KEY UPDATE
            type_name = VALUES(type_name),
            sort_order = VALUES(sort_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                menu_type,
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        for group in cls.MENU_GROUPS:
            query_db(
                """
          INSERT INTO menu_groups (group_key, group_name, sort_order, is_active)
          VALUES (%(group_key)s, %(group_name)s, %(sort_order)s, 1)
          ON DUPLICATE KEY UPDATE
            group_name = VALUES(group_name),
            sort_order = VALUES(sort_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                group,
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        type_rows = query_db(
            "SELECT id, type_key FROM menu_types;",
            connection=connection,
            auto_commit=False,
        )
        group_rows = query_db(
            "SELECT id, group_key FROM menu_groups;",
            connection=connection,
            auto_commit=False,
        )
        type_ids = {row["type_key"]: row["id"] for row in type_rows}
        group_ids = {row["group_key"]: row["id"] for row in group_rows}

        for link in cls.MENU_TYPE_GROUP_LINKS:
            menu_type_id = type_ids.get(link["type_key"])
            menu_group_id = group_ids.get(link["group_key"])
            if not menu_type_id or not menu_group_id:
                continue
            query_db(
                """
          INSERT INTO menu_type_groups (menu_type_id, menu_group_id, display_order, is_active)
          VALUES (%(menu_type_id)s, %(menu_group_id)s, %(display_order)s, 1)
          ON DUPLICATE KEY UPDATE
            display_order = VALUES(display_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                {
                    "menu_type_id": menu_type_id,
                    "menu_group_id": menu_group_id,
                    "display_order": link["display_order"],
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        side_id = group_ids.get("side")
        salad_id = group_ids.get("salad")
        if side_id and salad_id:
            query_db(
                """
          INSERT INTO menu_group_conflicts (group_a_id, group_b_id)
          VALUES (%(group_a_id)s, %(group_b_id)s)
          ON DUPLICATE KEY UPDATE
            group_a_id = VALUES(group_a_id),
            group_b_id = VALUES(group_b_id);
          """,
                {
                    "group_a_id": min(side_id, salad_id),
                    "group_b_id": max(side_id, salad_id),
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )

        return type_ids, group_ids

    @classmethod
    def _generate_unique_item_key(cls, item_name, provided_key=None, connection=None, exclude_row_id=None):
        base_key = cls._slug_key(provided_key or item_name) or "item"
        candidate = base_key
        suffix = 2

        while True:
            payload = {"item_key": candidate}
            where_clause = "item_key = %(item_key)s"
            if exclude_row_id:
                payload["exclude_row_id"] = exclude_row_id
                where_clause += " AND id <> %(exclude_row_id)s"

            existing = query_db(
                f"SELECT id FROM menu_items WHERE {where_clause} LIMIT 1;",
                payload,
                fetch="one",
                connection=connection,
                auto_commit=False,
            )
            if not existing:
                return candidate[:128]

            candidate = f"{base_key}-{suffix}"
            suffix += 1

    @classmethod
    def sync_simplified_from_payload(cls, payload=None):
        source_payload = payload or cls._load_seed_payload()
        if not source_payload:
            return {"ok": False, "error": "No payload available for simplified migration."}

        general_rows, formal_rows = cls._extract_simplified_items_from_payload(source_payload)
        merged_rows = cls._merge_simplified_rows(general_rows=general_rows, formal_rows=formal_rows)

        with db_transaction() as connection:
            type_ids, group_ids = cls._ensure_reference_tables(connection=connection)
            query_db("DELETE FROM menu_item_type_groups;", fetch="none", connection=connection, auto_commit=False)

            assignment_rows = []
            for row in merged_rows:
                item_name = str(row.get("name") or "").strip()
                if not item_name:
                    continue

                existing = query_db(
                    """
          SELECT id
          FROM menu_items
          WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(%(item_name)s))
          LIMIT 1;
          """,
                    {"item_name": item_name},
                    fetch="one",
                    connection=connection,
                    auto_commit=False,
                )

                half_serialized = cls._serialize_price(row.get("half_tray_price"))
                full_serialized = cls._serialize_price(row.get("full_tray_price"))

                if existing:
                    row_id = existing["id"]
                    item_key = cls._generate_unique_item_key(
                        item_name=item_name,
                        provided_key=row.get("key"),
                        connection=connection,
                        exclude_row_id=row_id,
                    )
                    query_db(
                        """
            UPDATE menu_items
            SET
              item_key = %(item_key)s,
              item_name = %(item_name)s,
              tray_price_half = %(tray_price_half)s,
              tray_price_full = %(tray_price_full)s,
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = %(id)s;
            """,
                        {
                            "id": row_id,
                            "item_key": item_key,
                            "item_name": item_name,
                            "tray_price_half": half_serialized,
                            "tray_price_full": full_serialized,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )
                else:
                    item_key = cls._generate_unique_item_key(
                        item_name=item_name,
                        provided_key=row.get("key"),
                        connection=connection,
                    )
                    row_id = query_db(
                        """
            INSERT INTO menu_items (item_key, item_name, tray_price_half, tray_price_full, is_active)
            VALUES (%(item_key)s, %(item_name)s, %(tray_price_half)s, %(tray_price_full)s, 1);
            """,
                        {
                            "item_key": item_key,
                            "item_name": item_name,
                            "tray_price_half": half_serialized,
                            "tray_price_full": full_serialized,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )

                for type_key in row.get("menu_types", []):
                    type_id = type_ids.get(type_key)
                    group_id = group_ids.get((row.get("type_groups") or {}).get(type_key))
                    if not type_id or not group_id:
                        continue
                    assignment_rows.append(
                        {
                            "menu_item_id": row_id,
                            "menu_type_id": type_id,
                            "menu_group_id": group_id,
                            "is_active": 1,
                        }
                    )

            query_db_many(
                """
        INSERT INTO menu_item_type_groups (menu_item_id, menu_type_id, menu_group_id, is_active)
        VALUES (%(menu_item_id)s, %(menu_type_id)s, %(menu_group_id)s, %(is_active)s)
        ON DUPLICATE KEY UPDATE
          menu_group_id = VALUES(menu_group_id),
          is_active = VALUES(is_active),
          updated_at = CURRENT_TIMESTAMP;
        """,
                assignment_rows,
                connection=connection,
                auto_commit=False,
            )

        return {
            "ok": True,
            "item_count": len(merged_rows),
            "assignment_count": len(assignment_rows),
        }

    @staticmethod
    def _list_groups_by_type(type_key, active_only=True):
        conditions = ["t.type_key = %(type_key)s"]
        payload = {"type_key": str(type_key or "").strip().lower()}
        if active_only:
            conditions.extend(["t.is_active = 1", "g.is_active = 1", "tg.is_active = 1"])
        where_clause = f"WHERE {' AND '.join(conditions)}"

        rows = query_db(
            f"""
      SELECT
        g.id,
        g.group_name AS name,
        g.group_key AS `key`,
        g.is_active,
        tg.display_order
      FROM menu_type_groups tg
      JOIN menu_types t ON t.id = tg.menu_type_id
      JOIN menu_groups g ON g.id = tg.menu_group_id
      {where_clause}
      ORDER BY tg.display_order ASC, g.sort_order ASC, g.id ASC;
      """,
            payload,
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "key": row["key"],
                "is_active": bool(row["is_active"]),
                "sort_order": row["display_order"],
            }
            for row in rows
        ]

    @classmethod
    def _list_items_by_type(cls, type_key, group_key="", active_only=True):
        conditions = ["t.type_key = %(type_key)s"]
        payload = {"type_key": str(type_key or "").strip().lower()}

        if active_only:
            conditions.extend(["i.is_active = 1", "mitg.is_active = 1", "t.is_active = 1", "g.is_active = 1", "tg.is_active = 1"])
        if str(group_key or "").strip():
            payload["group_key"] = str(group_key).strip().lower()
            conditions.append("g.group_key = %(group_key)s")

        where_clause = f"WHERE {' AND '.join(conditions)}"

        rows = query_db(
            f"""
      SELECT
        i.id,
        i.item_name AS name,
        i.item_key AS `key`,
        i.is_active,
        i.tray_price_half,
        i.tray_price_full,
        g.id AS group_id,
        g.group_name AS group_name,
        g.group_key AS group_key,
        tg.display_order AS group_order
      FROM menu_item_type_groups mitg
      JOIN menu_types t ON t.id = mitg.menu_type_id
      JOIN menu_items i ON i.id = mitg.menu_item_id
      JOIN menu_groups g ON g.id = mitg.menu_group_id
      JOIN menu_type_groups tg ON tg.menu_type_id = mitg.menu_type_id AND tg.menu_group_id = mitg.menu_group_id
      {where_clause}
      ORDER BY tg.display_order ASC, i.item_name ASC, i.id ASC;
      """,
            payload,
        )

        return [
            {
                "id": row["id"],
                "name": row["name"],
                "key": row["key"],
                "is_active": bool(row["is_active"]),
                "group": {
                    "id": row["group_id"],
                    "name": row["group_name"],
                    "key": row["group_key"],
                },
                "half_tray_price": cls._price_to_float(row.get("tray_price_half")),
                "full_tray_price": cls._price_to_float(row.get("tray_price_full")),
            }
            for row in rows
        ]

    @classmethod
    def get_general_groups(cls):
        return {"groups": cls._list_groups_by_type("regular", active_only=True)}, 200

    @classmethod
    def get_general_items(cls, group_key=""):
        return {"items": cls._list_items_by_type("regular", group_key=group_key, active_only=True)}, 200

    @classmethod
    def get_formal_groups(cls):
        return {"groups": cls._list_groups_by_type("formal", active_only=True)}, 200

    @classmethod
    def get_formal_items(cls, group_key=""):
        items = cls._list_items_by_type("formal", group_key=group_key, active_only=True)
        for row in items:
            row.pop("half_tray_price", None)
            row.pop("full_tray_price", None)
        return {"items": items}, 200

    @classmethod
    def _build_catalog_payload_from_simplified_tables(cls):
        general_groups = cls._list_groups_by_type("regular", active_only=True)
        formal_groups = cls._list_groups_by_type("formal", active_only=True)
        general_items = cls._list_items_by_type("regular", active_only=True)
        formal_items = cls._list_items_by_type("formal", active_only=True)

        if not general_groups or not formal_groups:
            return None

        general_by_group = {}
        for item in general_items:
            general_by_group.setdefault(item["group"]["key"], []).append(item)

        formal_by_group = {}
        for item in formal_items:
            formal_by_group.setdefault(item["group"]["key"], []).append(item)

        general_group_titles = {group["key"]: group["name"] for group in general_groups}

        menu_options = {
            "entree": {
                "id": "entree",
                "category": "entree",
                "title": general_group_titles.get("entree", "Entree"),
                "items": [item["name"] for item in general_by_group.get("entree", [])],
            },
            "signature_protein": {
                "id": "signature_protein",
                "category": "entree",
                "title": general_group_titles.get("signature_protein", "Signature Protein"),
                "items": [item["name"] for item in general_by_group.get("signature_protein", [])],
            },
            "side": {
                "id": "side",
                "category": "sides",
                "title": general_group_titles.get("side", "Side"),
                "items": [item["name"] for item in general_by_group.get("side", [])],
            },
            "salad": {
                "id": "salad",
                "category": "salads",
                "title": general_group_titles.get("salad", "Salad"),
                "items": [item["name"] for item in general_by_group.get("salad", [])],
            },
        }

        togo_sections = []
        for key, title, category in (
            ("entree", "Entrees", "entree"),
            ("signature_protein", "Signature Proteins", "entree"),
            ("side", "Sides", "sides"),
            ("salad", "Salads", "salads"),
        ):
            rows = [
                [
                    item["name"],
                    cls._format_price_display(item.get("half_tray_price")),
                    cls._format_price_display(item.get("full_tray_price")),
                ]
                for item in general_by_group.get(key, [])
            ]
            if not rows:
                continue
            togo_sections.append(
                {
                    "sectionId": f"togo_{key}",
                    "category": category,
                    "title": title,
                    "columns": ["Item", "Half Tray", "Full Tray"],
                    "rows": rows,
                }
            )

        formal_section_meta = {
            "passed_appetizer": {
                "sectionId": "formal_passed",
                "courseType": "passed",
                "title": "Passed Appetizers (Choose Two)",
            },
            "starter": {
                "sectionId": "formal_starter",
                "courseType": "starter",
                "title": "Starter (Choose One)",
            },
            "entree": {
                "sectionId": "formal_entrees",
                "courseType": "entree",
                "title": "Entree (Choose One or Two)",
            },
            "side": {
                "sectionId": "formal_sides",
                "courseType": "sides",
                "title": "Sides",
            },
        }

        formal_sections = [
            {
                "sectionId": "formal_pricing",
                "type": "package",
                "title": "Three-Course Dinner Pricing",
                "description": "Per person pricing (final depends on selections and service details).",
                "price": "$75-$110+ per person",
            }
        ]

        for key in ("passed_appetizer", "starter", "entree", "side"):
            bullets = [item["name"] for item in formal_by_group.get(key, [])]
            if not bullets:
                continue
            meta = formal_section_meta[key]
            formal_sections.append(
                {
                    "sectionId": meta["sectionId"],
                    "courseType": meta["courseType"],
                    "type": "tiers",
                    "title": meta["title"],
                    "tiers": [{"tierTitle": "Options", "price": "", "bullets": bullets}],
                }
            )

        return {
            "menu_options": menu_options,
            "formal_plan_options": deepcopy(list(cls.FORMAL_PLAN_OPTIONS)),
            "menu": {
                "togo": {
                    "pageTitle": "To-Go & Take-and-Bake Trays",
                    "subtitle": "Served hot or chilled to reheat",
                    "introBlocks": [
                        {
                            "title": "Tray Sizes",
                            "bullets": ["Half Tray: Serves 8-10", "Full Tray: Serves 16-20"],
                        }
                    ],
                    "sections": togo_sections,
                },
                "community": {
                    "pageTitle": "Community & Crew Catering (Per Person)",
                    "subtitle": "Drop-off or buffet setup - Minimums apply",
                    "sections": [
                        {
                            "sectionId": "community_taco_bar",
                            "type": "package",
                            "title": "Taco Bar",
                            "description": "Includes Spanish rice, refried beans, tortillas, toppings",
                            "constraints": {"entree": {"min": 1, "max": 1}},
                            "price": "$18-$25 per person",
                        },
                        {
                            "sectionId": "community_homestyle",
                            "type": "package",
                            "title": "Hearty Homestyle Packages",
                            "description": "Choose 1 protein + 2 sides + bread",
                            "constraints": {"entree": {"min": 1, "max": 1}, "sides": {"min": 2, "max": 2}},
                            "price": "$20-$28 per person",
                        },
                        {
                            "sectionId": "community_buffet_tiers",
                            "type": "tiers",
                            "title": "Event Catering - Buffet Style",
                            "tiers": [
                                {
                                    "tierTitle": "Tier 1: Casual Buffet",
                                    "constraints": {
                                        "entree": {"min": 2, "max": 2},
                                        "sides": {"min": 2, "max": 2},
                                        "salads": {"min": 1, "max": 1},
                                    },
                                    "price": "$30-$40 per person",
                                    "bullets": ["2 Entrees", "2 Sides", "1 Salad", "Bread"],
                                },
                                {
                                    "tierTitle": "Tier 2: Elevated Buffet / Family-Style",
                                    "constraints": {
                                        "entree": {"min": 2, "max": 3},
                                        "sides": {"min": 3, "max": 3},
                                        "salads": {"min": 2, "max": 2},
                                    },
                                    "price": "$45-$65 per person",
                                    "bullets": ["2-3 Entrees", "3 Sides", "2 Salads", "Bread"],
                                },
                            ],
                        },
                        {
                            "sectionId": "community_menu_options",
                            "type": "includeMenu",
                            "title": "Menu Options",
                            "includeKeys": ["entree", "signature_protein", "side", "salad"],
                        },
                    ],
                },
                "formal": {
                    "pageTitle": "Formal Events - Plated & Full Service",
                    "subtitle": "Three-course dinner",
                    "sections": formal_sections,
                },
            },
        }

    @classmethod
    def run_menu_admin_task(cls, apply_schema=False, reset=False, seed=True):
        steps = []
        if apply_schema:
            count = cls._apply_schema()
            steps.append(f"applied_schema_statements:{count}")

        if reset:
            cls._truncate_simplified_tables()
            steps.append("reset_simplified_tables")

        if seed:
            payload = cls._load_seed_payload()
            if not payload:
                return {"error": "Menu seed payload not found.", "steps": steps}, 500
            migration_result = cls.sync_simplified_from_payload(payload=payload)
        else:
            migration_result = {"ok": True, "item_count": 0, "assignment_count": 0}

        if migration_result.get("ok"):
            steps.append(
                f"seeded_simplified_tables:i{migration_result.get('item_count', 0)}:a{migration_result.get('assignment_count', 0)}"
            )
        else:
            steps.append("simplified_seed_skipped")

        return {"ok": True, "steps": steps}, 200

    @classmethod
    def get_catalog(cls):
        source = (os.getenv("MENU_DATA_SOURCE") or "db").strip().lower()

        if source == "db":
            payload = cls._build_catalog_payload_from_simplified_tables()
            if payload:
                return {"source": "simplified-db", **cls._normalize_menu_payload_for_api(payload)}, 200

            return {
                "error": "Simplified menu tables are empty. Run admin menu sync endpoint or script with seed enabled."
            }, 500

        fallback = cls._load_seed_payload()
        if fallback:
            return {"source": "seed-file", **cls._normalize_menu_payload_for_api(fallback)}, 200
        return {"error": "Menu seed payload not found."}, 500

    @classmethod
    def upsert_non_formal_catalog_items(cls, payload):
        body = payload or {}
        rows = body.get("items") if isinstance(body.get("items"), list) else [body]
        normalized_rows = [row for row in rows if isinstance(row, dict)]
        if not normalized_rows:
            return {"error": "No items supplied."}, 400

        updated = []
        with db_transaction() as connection:
            type_ids, group_ids = cls._ensure_reference_tables(connection=connection)
            regular_type_id = type_ids.get("regular")

            for row in normalized_rows:
                item_name = str(row.get("item_name") or row.get("name") or "").strip()
                if not item_name:
                    continue

                group_key = cls._general_group_from_legacy(
                    row.get("item_category") or row.get("category"),
                    item_name,
                    row.get("item_type") or row.get("type"),
                )
                group_id = group_ids.get(group_key)
                if not group_id:
                    continue

                half_price = cls._parse_price_decimal(row.get("tray_price_half"))
                full_price = cls._parse_price_decimal(row.get("tray_price_full"))
                if half_price is None and full_price is not None:
                    half_price = full_price
                if full_price is None and half_price is not None:
                    full_price = half_price

                is_active = cls._to_bool(row.get("is_active"), default=True)

                existing = query_db(
                    """
          SELECT id
          FROM menu_items
          WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(%(item_name)s))
          LIMIT 1;
          """,
                    {"item_name": item_name},
                    fetch="one",
                    connection=connection,
                    auto_commit=False,
                )

                if existing:
                    item_id = existing["id"]
                    item_key = cls._generate_unique_item_key(
                        item_name=item_name,
                        provided_key=row.get("item_key") or row.get("key"),
                        connection=connection,
                        exclude_row_id=item_id,
                    )
                    query_db(
                        """
            UPDATE menu_items
            SET
              item_key = %(item_key)s,
              item_name = %(item_name)s,
              tray_price_half = %(tray_price_half)s,
              tray_price_full = %(tray_price_full)s,
              is_active = %(is_active)s,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = %(id)s;
            """,
                        {
                            "id": item_id,
                            "item_key": item_key,
                            "item_name": item_name,
                            "tray_price_half": cls._serialize_price(half_price),
                            "tray_price_full": cls._serialize_price(full_price),
                            "is_active": 1 if is_active else 0,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )
                else:
                    item_key = cls._generate_unique_item_key(
                        item_name=item_name,
                        provided_key=row.get("item_key") or row.get("key"),
                        connection=connection,
                    )
                    item_id = query_db(
                        """
            INSERT INTO menu_items (item_key, item_name, tray_price_half, tray_price_full, is_active)
            VALUES (%(item_key)s, %(item_name)s, %(tray_price_half)s, %(tray_price_full)s, %(is_active)s);
            """,
                        {
                            "item_key": item_key,
                            "item_name": item_name,
                            "tray_price_half": cls._serialize_price(half_price),
                            "tray_price_full": cls._serialize_price(full_price),
                            "is_active": 1 if is_active else 0,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )

                if regular_type_id:
                    query_db(
                        """
            INSERT INTO menu_item_type_groups (menu_item_id, menu_type_id, menu_group_id, is_active)
            VALUES (%(menu_item_id)s, %(menu_type_id)s, %(menu_group_id)s, 1)
            ON DUPLICATE KEY UPDATE
              menu_group_id = VALUES(menu_group_id),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {
                            "menu_item_id": item_id,
                            "menu_type_id": regular_type_id,
                            "menu_group_id": group_id,
                        },
                        fetch="none",
                        connection=connection,
                        auto_commit=False,
                    )

                updated.append({"id": item_id, "item_name": item_name, "group_key": group_key})

        return {"ok": True, "items": updated, "count": len(updated)}, 200
