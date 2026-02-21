import json
import os
import re
from pathlib import Path

from flask_api.config.mysqlconnection import connect_to_mysql
from flask_api.models.menu import Menu


class MenuService:
    NORMALIZED_TABLES = (
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
        shared_non_formal_items = payload.get("shared_non_formal_items", payload.get("sharedNonFormalItems", []))

        # Keep catalog/menu option IDs as-is; only normalize schema field names.
        normalized_menu_options = {key: cls._to_snake_case_keys(option) for key, option in menu_options.items()}
        normalized_menu = {key: cls._to_snake_case_keys(catalog) for key, catalog in menu.items()}

        return {
            "menu_options": normalized_menu_options,
            "formal_plan_options": cls._to_snake_case_keys(formal_plan_options),
            "menu": normalized_menu,
            "shared_non_formal_items": cls._to_snake_case_keys(shared_non_formal_items),
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
            "shared_non_formal_items": raw.get("NON_FORMAL_ITEMS", raw.get("SHARED_NON_FORMAL_ITEMS", [])),
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
                        # Keep schema application idempotent across MySQL variants that do
                        # not support IF NOT EXISTS in ALTER COLUMN syntax.
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

    @staticmethod
    def _is_ignorable_alter_error(exc, normalized_statement):
        if not normalized_statement.startswith("alter table"):
            return False
        error_code = getattr(exc, "args", [None])[0]
        # 1060: duplicate column name, 1061: duplicate key name, 1091: can't drop/check that doesn't exist
        return error_code in {1060, 1061, 1091}

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

        return {"ok": True, "steps": steps}, 200

    @classmethod
    def get_catalog(cls):
        source = (os.getenv("MENU_DATA_SOURCE") or "db").strip().lower()

        if source == "db":
            cached_payload = Menu.get_cached_config_payload()
            if cached_payload:
                return {"source": "db-cache", **cls._normalize_menu_payload_for_api(cached_payload)}, 200

            payload = Menu.get_config_payload()
            if payload:
                Menu.upsert_cached_config_payload(payload)
                return {"source": "db", **cls._normalize_menu_payload_for_api(payload)}, 200

            return {"error": "Menu config not found in DB. Run admin menu seed/migration endpoint or script."}, 500

        fallback = cls._load_seed_payload()
        if fallback:
            return {"source": "seed-file", **cls._normalize_menu_payload_for_api(fallback)}, 200
        return {"error": "Menu seed payload not found."}, 500

    @classmethod
    def upsert_non_formal_catalog_items(cls, payload):
        return Menu.upsert_non_formal_catalog_items(payload)
