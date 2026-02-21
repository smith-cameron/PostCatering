import json
import os
import re
from copy import deepcopy
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

from flask_api.config.mysqlconnection import connect_to_mysql, db_transaction, query_db, query_db_many
from flask_api.models.menu import Menu


class MenuService:
    LEGACY_TABLES = (
        "menu_section_tier_bullets",
        "menu_section_tier_constraints",
        "menu_section_tiers",
        "menu_section_include_groups",
        "menu_section_rows",
        "menu_section_columns",
        "menu_section_constraints",
        "menu_sections",
        "menu_intro_bullets",
        "menu_intro_blocks",
        "menu_catalogs",
        "formal_plan_option_constraints",
        "formal_plan_option_details",
        "formal_plan_options",
        "menu_option_group_items",
        "menu_option_groups",
        "menu_items",
    )

    SIMPLIFIED_TABLES = (
        "formal_menu_items",
        "general_menu_items",
        "formal_menu_groups",
        "general_menu_groups",
    )

    NORMALIZED_TABLES = LEGACY_TABLES + SIMPLIFIED_TABLES

    GENERAL_GROUPS = (
        {"key": "entree", "name": "Entree", "sort_order": 1},
        {"key": "signature_protein", "name": "Signature Protein", "sort_order": 2},
        {"key": "side", "name": "Side", "sort_order": 3},
        {"key": "salad", "name": "Salad", "sort_order": 4},
    )

    FORMAL_GROUPS = (
        {"key": "passed_appetizers", "name": "Passed Appetizers", "sort_order": 1},
        {"key": "starter", "name": "Starter", "sort_order": 2},
        {"key": "sides", "name": "Sides", "sort_order": 3},
        {"key": "entrees", "name": "Entrees", "sort_order": 4},
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
    def _load_schema_sql():
        schema_path = Path(__file__).resolve().parents[2] / "sql" / "schema.sql"
        if not schema_path.exists():
            return None
        return schema_path.read_text(encoding="utf-8")

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
    def _is_ignorable_alter_error(exc, normalized_statement):
        if not normalized_statement.startswith("alter table"):
            return False
        error_code = getattr(exc, "args", [None])[0]
        return error_code in {1060, 1061, 1091}

    @classmethod
    def _apply_schema(cls):
        sql_text = cls._load_schema_sql()
        if not sql_text:
            raise FileNotFoundError("schema.sql not found.")

        statements = cls._split_sql_statements(sql_text)
        if not statements:
            return 0

        connection = connect_to_mysql()
        executed = 0
        try:
            with connection.cursor() as cursor:
                for statement in statements:
                    normalized = " ".join(statement.strip().split()).lower()
                    if normalized.startswith("insert into slides "):
                        continue
                    try:
                        cursor.execute(statement)
                        executed += 1
                    except Exception as exc:
                        if cls._is_ignorable_alter_error(exc, normalized):
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
    def _truncate_normalized_tables(cls):
        connection = connect_to_mysql()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
                for table_name in cls.NORMALIZED_TABLES:
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
        if not text or text in {"-", "—"}:
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
        value = Decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if value == value.to_integral():
            return f"${int(value):,}"
        return f"${value:,.2f}"

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
            return "passed_appetizers"
        if "starter" in source:
            return "starter"
        if "side" in source:
            return "sides"
        return "entrees"

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
            group_key = cls._general_group_from_legacy(section.get("category"), None, section.get("sectionId"))
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
    def sync_simplified_from_legacy_payload(cls, payload=None):
        source_payload = payload or Menu.get_config_payload() or cls._load_seed_payload()
        if not source_payload:
            return {"ok": False, "error": "No legacy payload available for simplified migration."}

        general_rows, formal_rows = cls._extract_simplified_items_from_payload(source_payload)
        general_rows = cls._assign_unique_keys(general_rows)
        formal_rows = cls._assign_unique_keys(formal_rows)

        with db_transaction() as connection:
            for group in cls.GENERAL_GROUPS:
                query_db(
                    """
          INSERT INTO general_menu_groups (`key`, name, sort_order, is_active)
          VALUES (%(key)s, %(name)s, %(sort_order)s, 1)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            sort_order = VALUES(sort_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                    group,
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
            for group in cls.FORMAL_GROUPS:
                query_db(
                    """
          INSERT INTO formal_menu_groups (`key`, name, sort_order, is_active)
          VALUES (%(key)s, %(name)s, %(sort_order)s, 1)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            sort_order = VALUES(sort_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                    group,
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )

            general_group_rows = query_db(
                "SELECT id, `key` FROM general_menu_groups;",
                connection=connection,
                auto_commit=False,
            )
            formal_group_rows = query_db(
                "SELECT id, `key` FROM formal_menu_groups;",
                connection=connection,
                auto_commit=False,
            )
            general_group_ids = {row["key"]: row["id"] for row in general_group_rows}
            formal_group_ids = {row["key"]: row["id"] for row in formal_group_rows}

            query_db("DELETE FROM general_menu_items;", fetch="none", connection=connection, auto_commit=False)
            query_db("DELETE FROM formal_menu_items;", fetch="none", connection=connection, auto_commit=False)

            general_insert_rows = [
                {
                    "name": row["name"],
                    "key": row["key"],
                    "is_active": 1,
                    "group_id": general_group_ids.get(row["group_key"]),
                    "half_tray_price": str(row["half_tray_price"]),
                    "full_tray_price": str(row["full_tray_price"]),
                }
                for row in general_rows
                if general_group_ids.get(row["group_key"])
            ]
            formal_insert_rows = [
                {
                    "name": row["name"],
                    "key": row["key"],
                    "is_active": 1,
                    "group_id": formal_group_ids.get(row["group_key"]),
                }
                for row in formal_rows
                if formal_group_ids.get(row["group_key"])
            ]

            query_db_many(
                """
        INSERT INTO general_menu_items (`key`, name, is_active, group_id, half_tray_price, full_tray_price)
        VALUES (%(key)s, %(name)s, %(is_active)s, %(group_id)s, %(half_tray_price)s, %(full_tray_price)s);
        """,
                general_insert_rows,
                connection=connection,
                auto_commit=False,
            )
            query_db_many(
                """
        INSERT INTO formal_menu_items (`key`, name, is_active, group_id)
        VALUES (%(key)s, %(name)s, %(is_active)s, %(group_id)s);
        """,
                formal_insert_rows,
                connection=connection,
                auto_commit=False,
            )

        return {
            "ok": True,
            "general_item_count": len(general_rows),
            "formal_item_count": len(formal_rows),
        }

    @staticmethod
    def _list_general_groups(active_only=True):
        where_clause = "WHERE is_active = 1" if active_only else ""
        rows = query_db(
            f"""
      SELECT id, name, `key`, is_active, sort_order
      FROM general_menu_groups
      {where_clause}
      ORDER BY sort_order ASC, name ASC, id ASC;
      """
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "key": row["key"],
                "is_active": bool(row["is_active"]),
                "sort_order": row["sort_order"],
            }
            for row in rows
        ]

    @staticmethod
    def _list_formal_groups(active_only=True):
        where_clause = "WHERE is_active = 1" if active_only else ""
        rows = query_db(
            f"""
      SELECT id, name, `key`, is_active, sort_order
      FROM formal_menu_groups
      {where_clause}
      ORDER BY sort_order ASC, name ASC, id ASC;
      """
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "key": row["key"],
                "is_active": bool(row["is_active"]),
                "sort_order": row["sort_order"],
            }
            for row in rows
        ]

    @staticmethod
    def _list_general_items(group_key="", active_only=True):
        conditions = []
        payload = {}
        if active_only:
            conditions.append("i.is_active = 1")
            conditions.append("g.is_active = 1")
        if str(group_key or "").strip():
            payload["group_key"] = str(group_key).strip().lower()
            conditions.append("g.`key` = %(group_key)s")
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = query_db(
            f"""
      SELECT
        i.id, i.name, i.`key`, i.is_active, i.half_tray_price, i.full_tray_price,
        g.id AS group_id, g.name AS group_name, g.`key` AS group_key, g.sort_order
      FROM general_menu_items i
      JOIN general_menu_groups g ON g.id = i.group_id
      {where_clause}
      ORDER BY g.sort_order ASC, i.name ASC, i.id ASC;
      """,
            payload,
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "key": row["key"],
                "is_active": bool(row["is_active"]),
                "group": {"id": row["group_id"], "name": row["group_name"], "key": row["group_key"]},
                "half_tray_price": float(row["half_tray_price"]),
                "full_tray_price": float(row["full_tray_price"]),
            }
            for row in rows
        ]

    @staticmethod
    def _list_formal_items(group_key="", active_only=True):
        conditions = []
        payload = {}
        if active_only:
            conditions.append("i.is_active = 1")
            conditions.append("g.is_active = 1")
        if str(group_key or "").strip():
            payload["group_key"] = str(group_key).strip().lower()
            conditions.append("g.`key` = %(group_key)s")
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = query_db(
            f"""
      SELECT
        i.id, i.name, i.`key`, i.is_active,
        g.id AS group_id, g.name AS group_name, g.`key` AS group_key, g.sort_order
      FROM formal_menu_items i
      JOIN formal_menu_groups g ON g.id = i.group_id
      {where_clause}
      ORDER BY g.sort_order ASC, i.name ASC, i.id ASC;
      """,
            payload,
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "key": row["key"],
                "is_active": bool(row["is_active"]),
                "group": {"id": row["group_id"], "name": row["group_name"], "key": row["group_key"]},
            }
            for row in rows
        ]

    @classmethod
    def get_general_groups(cls):
        return {"groups": cls._list_general_groups(active_only=True)}, 200

    @classmethod
    def get_general_items(cls, group_key=""):
        return {"items": cls._list_general_items(group_key=group_key, active_only=True)}, 200

    @classmethod
    def get_formal_groups(cls):
        return {"groups": cls._list_formal_groups(active_only=True)}, 200

    @classmethod
    def get_formal_items(cls, group_key=""):
        return {"items": cls._list_formal_items(group_key=group_key, active_only=True)}, 200

    @classmethod
    def _build_catalog_payload_from_simplified_tables(cls):
        general_groups = cls._list_general_groups(active_only=True)
        formal_groups = cls._list_formal_groups(active_only=True)
        general_items = cls._list_general_items(active_only=True)
        formal_items = cls._list_formal_items(active_only=True)

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
                    cls._format_price_display(item["half_tray_price"]),
                    cls._format_price_display(item["full_tray_price"]),
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
            "passed_appetizers": {
                "sectionId": "formal_passed",
                "courseType": "passed",
                "title": "Passed Appetizers (Choose Two)",
            },
            "starter": {"sectionId": "formal_starter", "courseType": "starter", "title": "Starter (Choose One)"},
            "entrees": {"sectionId": "formal_entrees", "courseType": "entree", "title": "Entree (Choose One or Two)"},
            "sides": {"sectionId": "formal_sides", "courseType": "sides", "title": "Sides"},
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
        for key in ("passed_appetizers", "starter", "entrees", "sides"):
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
                        {"title": "Tray Sizes", "bullets": ["Half Tray: Serves 8-10", "Full Tray: Serves 16-20"]}
                    ],
                    "sections": togo_sections,
                },
                "community": {
                    "pageTitle": "Community & Crew Catering (Per Person)",
                    "subtitle": "Drop-off or buffet setup • Minimums apply",
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
            cls._truncate_normalized_tables()
            steps.append("reset_normalized_tables")

        if apply_schema or reset:
            Menu.clear_cached_config_payload()
            steps.append("invalidated_menu_cache")

        if seed:
            payload = cls._load_seed_payload()
            if not payload:
                return {"error": "Menu seed payload not found.", "steps": steps}, 500
            Menu.seed_from_payload(payload)
            steps.append("seeded_from_payload")
            refreshed_payload = Menu.get_config_payload()
            if refreshed_payload:
                Menu.upsert_cached_config_payload(refreshed_payload)
                steps.append("refreshed_menu_cache")

        migration_result = cls.sync_simplified_from_legacy_payload()
        if migration_result.get("ok"):
            steps.append(
                f"synced_simplified_tables:g{migration_result.get('general_item_count', 0)}:f{migration_result.get('formal_item_count', 0)}"
            )
        else:
            steps.append("simplified_sync_skipped")

        return {"ok": True, "steps": steps}, 200

    @classmethod
    def get_catalog(cls):
        source = (os.getenv("MENU_DATA_SOURCE") or "db").strip().lower()

        if source == "db":
            payload = cls._build_catalog_payload_from_simplified_tables()
            if not payload:
                cls.sync_simplified_from_legacy_payload()
                payload = cls._build_catalog_payload_from_simplified_tables()
            if payload:
                return {"source": "simplified-db", **cls._normalize_menu_payload_for_api(payload)}, 200

            legacy_payload = Menu.get_config_payload()
            if legacy_payload:
                return {"source": "legacy-db", **cls._normalize_menu_payload_for_api(legacy_payload)}, 200

            return {"error": "Menu config not found in DB. Run admin menu sync endpoint or script."}, 500

        fallback = cls._load_seed_payload()
        if fallback:
            return {"source": "seed-file", **cls._normalize_menu_payload_for_api(fallback)}, 200
        return {"error": "Menu seed payload not found."}, 500
