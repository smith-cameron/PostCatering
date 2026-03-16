import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import pymysql

from flask_api.config.mysqlconnection import db_transaction, query_db, query_db_many


class AdminServicePlanService:
    VALID_CATALOG_KEYS = ("catering", "formal")
    VALID_SELECTION_MODES = ("menu_groups", "custom_options", "none", "hybrid")
    KEY_SEGMENT_PATTERN = re.compile(r"[^a-z0-9]+")
    CATERING_CONSTRAINT_KEY_ALIASES = {
        "entree_signature_protein": "entree_signature_protein",
        "entree_signature_proteins": "entree_signature_protein",
        "entrees_signature_protein": "entree_signature_protein",
        "entrees_signature_proteins": "entree_signature_protein",
        "entree": "entree",
        "entrees": "entree",
        "protein": "signature_protein",
        "proteins": "signature_protein",
        "signature_protein": "signature_protein",
        "signature_proteins": "signature_protein",
        "side": "sides",
        "sides": "sides",
        "salad": "salads",
        "salads": "salads",
        "sides_salads": "sides_salads",
    }
    FORMAL_CONSTRAINT_KEY_ALIASES = {
        "passed": "passed",
        "passed_appetizer": "passed",
        "passed_appetizers": "passed",
        "starter": "starter",
        "starters": "starter",
        "entree": "entree",
        "entrees": "entree",
        "side": "side",
        "sides": "side",
    }
    CONSTRAINT_SORT_ORDER = {
        "passed": 1,
        "starter": 2,
        "entree_signature_protein": 3,
        "entree": 4,
        "signature_protein": 5,
        "sides_salads": 6,
        "sides": 7,
        "salads": 8,
        "side": 7,
        "salad": 8,
    }
    CONSTRAINT_DETAIL_KEYWORDS = {
        "catering": {
            "entree_signature_protein": (
                "entree",
                "entrees",
                "protein",
                "proteins",
                "signature protein",
                "signature proteins",
            ),
            "entree": ("entree", "entrees"),
            "signature_protein": ("protein", "proteins", "signature protein", "signature proteins"),
            "sides": ("side", "sides"),
            "salads": ("salad", "salads"),
            "sides_salads": ("side", "sides", "salad", "salads"),
        },
        "formal": {
            "passed": ("passed appetizer", "passed appetizers", "passed"),
            "starter": ("starter", "starters"),
            "entree": ("entree", "entrees"),
            "side": ("side", "sides"),
        },
    }
    MISSING_TABLES_ERROR = (
        "Service plan tables are not installed. Run admin menu sync with apply_schema enabled, "
        "or apply the service plan migrations in api/sql/migrations."
    )

    @classmethod
    def _is_missing_service_plan_tables_error(cls, exc):
        error_code = getattr(exc, "args", [None])[0]
        message = str(exc or "").lower()
        return bool(error_code == 1146 and ("service_plan_" in message or "service_section_menu_groups" in message))

    @classmethod
    def _missing_tables_response(cls):
        return {"error": cls.MISSING_TABLES_ERROR}, 503

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
    def _to_iso(value):
        return value.isoformat() if hasattr(value, "isoformat") else None

    @classmethod
    def _slugify(cls, value, separator="-"):
        normalized = cls.KEY_SEGMENT_PATTERN.sub(separator, str(value or "").strip().lower()).strip(separator)
        return normalized[:64] if normalized else ""

    @classmethod
    def _normalize_catalog_key(cls, value):
        normalized = str(value or "").strip().lower()
        return normalized if normalized in cls.VALID_CATALOG_KEYS else ""

    @classmethod
    def _normalize_selection_mode(cls, value, default="menu_groups"):
        normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
        return normalized if normalized in cls.VALID_SELECTION_MODES else default

    @classmethod
    def _normalize_selection_key(cls, value):
        return cls._slugify(value, separator="_")

    @staticmethod
    def _serialize_decimal(value):
        if value in (None, ""):
            return None
        try:
            normalized = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except (InvalidOperation, ValueError):
            return None
        return format(normalized, "f")

    @classmethod
    def _resolve_plan_active_flag(cls, payload, default=True):
        body = payload if isinstance(payload, dict) else {}
        return cls._to_bool(body.get("is_active"), default=default)

    @classmethod
    def _build_plan_key(cls, catalog_key, provided_key="", title=""):
        normalized_catalog = cls._normalize_catalog_key(catalog_key) or "catering"
        candidate = str(provided_key or "").strip().lower()
        if candidate:
            if ":" in candidate:
                left, right = candidate.split(":", 1)
                left_key = cls._slugify(left, separator="-")
                right_key = cls._slugify(right, separator="-")
                if left_key and right_key:
                    return f"{left_key}:{right_key}"
            else:
                right_key = cls._slugify(candidate, separator="-")
                if right_key:
                    return f"{normalized_catalog}:{right_key}"
        title_key = cls._slugify(title, separator="-") or "plan"
        return f"{normalized_catalog}:{title_key}"

    @classmethod
    def _canonicalize_constraint_key(cls, value, catalog_key=""):
        normalized_key = cls._normalize_selection_key(value)
        if not normalized_key:
            return ""

        normalized_catalog = cls._normalize_catalog_key(catalog_key)
        if normalized_catalog == "catering":
            return cls.CATERING_CONSTRAINT_KEY_ALIASES.get(normalized_key, normalized_key)
        if normalized_catalog == "formal":
            return cls.FORMAL_CONSTRAINT_KEY_ALIASES.get(normalized_key, normalized_key)
        return normalized_key

    @classmethod
    def _normalize_constraint_rows(cls, value, catalog_key=""):
        rows = {}
        if isinstance(value, dict):
            iterator = value.items()
        elif isinstance(value, list):
            iterator = [
                (
                    row.get("selection_key") or row.get("key"),
                    {"min": row.get("min_select", row.get("min")), "max": row.get("max_select", row.get("max"))},
                )
                for row in value
                if isinstance(row, dict)
            ]
        else:
            return []

        for key, raw_rule in iterator:
            selection_key = cls._canonicalize_constraint_key(key, catalog_key=catalog_key)
            if not selection_key:
                continue
            if isinstance(raw_rule, int):
                min_select = raw_rule
                max_select = raw_rule
            elif isinstance(raw_rule, dict):
                min_select = cls._to_int(raw_rule.get("min"), minimum=0)
                max_select = cls._to_int(raw_rule.get("max"), minimum=0)
            else:
                continue
            if min_select is None and max_select is None:
                continue
            if min_select is None:
                min_select = max_select
            if max_select is None:
                max_select = min_select
            if max_select is not None and min_select is not None and max_select < min_select:
                min_select, max_select = max_select, min_select
            existing = rows.get(selection_key)
            if existing:
                existing["min_select"] = (existing.get("min_select") or 0) + (min_select or 0)
                existing["max_select"] = (existing.get("max_select") or 0) + (max_select or 0)
            else:
                rows[selection_key] = {
                    "selection_key": selection_key,
                    "min_select": min_select,
                    "max_select": max_select,
                }
        return sorted(
            rows.values(),
            key=lambda row: (
                cls.CONSTRAINT_SORT_ORDER.get(row.get("selection_key"), 99),
                row.get("selection_key") or "",
            ),
        )

    @classmethod
    def _normalize_detail_rows(cls, value):
        rows = []
        if not isinstance(value, list):
            return rows
        for index, row in enumerate(value, start=1):
            if isinstance(row, str):
                detail_text = row.strip()
                sort_order = index
            elif isinstance(row, dict):
                detail_text = str(row.get("detail_text") or row.get("text") or "").strip()
                sort_order = cls._to_int(row.get("sort_order"), default=index, minimum=1)
            else:
                continue
            if not detail_text:
                continue
            rows.append({"detail_text": detail_text[:255], "sort_order": sort_order})
        return rows

    @staticmethod
    def _normalize_match_text(value):
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").strip().lower())).strip()

    @classmethod
    def _normalize_selection_group_rows(cls, value):
        rows = []
        if not isinstance(value, list):
            return rows

        for index, row in enumerate(value, start=1):
            if not isinstance(row, dict):
                continue

            group_key = cls._normalize_selection_key(
                row.get("group_key") or row.get("selection_key") or row.get("menu_group_key")
            )
            if not group_key:
                continue

            group_title = str(row.get("group_title") or row.get("title") or "").strip()
            source_type = str(row.get("source_type") or "").strip().lower().replace("-", "_").replace(" ", "_")
            if source_type not in {"menu_group", "custom_options"}:
                source_type = "custom_options"

            options = []
            for option_index, option_row in enumerate(row.get("options") or [], start=1):
                if not isinstance(option_row, dict):
                    continue
                option_label = str(
                    option_row.get("option_label") or option_row.get("label") or option_row.get("name") or ""
                ).strip()
                option_key = cls._slugify(
                    option_row.get("option_key") or option_label,
                    separator="_",
                )
                if not option_key or not option_label:
                    continue
                options.append(
                    {
                        "option_key": option_key,
                        "option_label": option_label[:150],
                        "menu_item_id": cls._to_int(option_row.get("menu_item_id"), minimum=1),
                        "sort_order": cls._to_int(option_row.get("sort_order"), default=option_index, minimum=1),
                        "is_active": 1 if cls._to_bool(option_row.get("is_active"), default=True) else 0,
                    }
                )

            rows.append(
                {
                    "group_key": group_key,
                    "group_title": (group_title or group_key.replace("_", " ").title())[:150],
                    "source_type": source_type,
                    "menu_group_key": cls._normalize_selection_key(row.get("menu_group_key")) or None,
                    "min_select": cls._to_int(row.get("min_select", row.get("min")), minimum=0),
                    "max_select": cls._to_int(row.get("max_select", row.get("max")), minimum=0),
                    "sort_order": cls._to_int(row.get("sort_order"), default=index, minimum=1),
                    "is_active": 1 if cls._to_bool(row.get("is_active"), default=True) else 0,
                    "options": options,
                }
            )
        return rows

    @classmethod
    def _detail_duplicates_constraint_choice(cls, detail_text, selection_key, catalog_key=""):
        if not re.search(r"\d", str(detail_text or "")):
            return False
        normalized_catalog = cls._normalize_catalog_key(catalog_key)
        keywords = cls.CONSTRAINT_DETAIL_KEYWORDS.get(normalized_catalog, {}).get(selection_key, ())
        if not keywords:
            return False
        normalized_detail = f" {cls._normalize_match_text(detail_text)} "
        return any(f" {keyword} " in normalized_detail for keyword in keywords)

    @classmethod
    def _detail_duplicates_selection_group(cls, detail_text, selection_group):
        normalized_detail = cls._normalize_match_text(detail_text)
        if not normalized_detail:
            return False

        group_title = cls._normalize_match_text(
            selection_group.get("group_title") or selection_group.get("title") or ""
        )
        option_labels = [
            cls._normalize_match_text(option.get("option_label") or option.get("label") or option.get("name") or "")
            for option in selection_group.get("options") or []
            if isinstance(option, dict)
        ]
        option_labels = [label for label in option_labels if label]

        if group_title and normalized_detail == group_title:
            return True

        if group_title and option_labels:
            summary_text = cls._normalize_match_text(f"{group_title} {' '.join(option_labels)}")
            if normalized_detail == summary_text:
                return True

        if not option_labels:
            return False

        matched_option_count = sum(1 for label in option_labels if label in normalized_detail)
        if len(option_labels) == 1:
            return normalized_detail == option_labels[0]
        if matched_option_count >= 2:
            return True
        return bool(group_title and group_title in normalized_detail and matched_option_count >= 1)

    @classmethod
    def _validate_detail_choice_conflicts(cls, details, constraints, selection_groups, catalog_key=""):
        normalized_details = cls._normalize_detail_rows(details)
        normalized_constraints = cls._normalize_constraint_rows(constraints, catalog_key=catalog_key)
        normalized_selection_groups = cls._normalize_selection_group_rows(selection_groups)
        if not normalized_details:
            return None

        conflicts = []
        for detail_row in normalized_details:
            detail_text = detail_row.get("detail_text")
            if not detail_text:
                continue

            duplicates_selection_group = any(
                cls._detail_duplicates_selection_group(detail_text, selection_group)
                for selection_group in normalized_selection_groups
            )
            duplicates_constraint_choice = any(
                cls._detail_duplicates_constraint_choice(
                    detail_text,
                    constraint_row.get("selection_key"),
                    catalog_key=catalog_key,
                )
                for constraint_row in normalized_constraints
            )
            if duplicates_selection_group or duplicates_constraint_choice:
                conflicts.append(detail_text)

        if not conflicts:
            return None

        conflict_preview = ", ".join(conflicts[:3])
        if len(conflicts) > 3:
            conflict_preview = f"{conflict_preview}, ..."
        return (
            "Included items should only list fixed inclusions. Move customer-choice text out of "
            f"Included Items: {conflict_preview}"
        )

    @classmethod
    def _fetch_plan_constraints(cls, plan_ids):
        normalized_ids = [cls._to_int(plan_id, minimum=1) for plan_id in plan_ids or []]
        normalized_ids = [plan_id for plan_id in normalized_ids if plan_id]
        if not normalized_ids:
            return {}

        payload = {}
        tokens = []
        for index, plan_id in enumerate(normalized_ids):
            token = f"plan_id_{index}"
            payload[token] = plan_id
            tokens.append(f"%({token})s")
        rows = query_db(
            f"""
      SELECT service_plan_id, selection_key, min_select, max_select
      FROM service_plan_constraints
      WHERE service_plan_id IN ({", ".join(tokens)})
      ORDER BY service_plan_id ASC, selection_key ASC;
      """,
            payload,
        )
        grouped = {}
        for row in rows:
            grouped.setdefault(row.get("service_plan_id"), []).append(
                {
                    "selection_key": row.get("selection_key"),
                    "min_select": cls._to_int(row.get("min_select"), minimum=0),
                    "max_select": cls._to_int(row.get("max_select"), minimum=0),
                }
            )
        return grouped

    @classmethod
    def _fetch_plan_details(cls, plan_ids):
        normalized_ids = [cls._to_int(plan_id, minimum=1) for plan_id in plan_ids or []]
        normalized_ids = [plan_id for plan_id in normalized_ids if plan_id]
        if not normalized_ids:
            return {}

        payload = {}
        tokens = []
        for index, plan_id in enumerate(normalized_ids):
            token = f"plan_id_{index}"
            payload[token] = plan_id
            tokens.append(f"%({token})s")
        rows = query_db(
            f"""
      SELECT service_plan_id, detail_text, sort_order
      FROM service_plan_details
      WHERE service_plan_id IN ({", ".join(tokens)})
      ORDER BY service_plan_id ASC, sort_order ASC, id ASC;
      """,
            payload,
        )
        grouped = {}
        for row in rows:
            grouped.setdefault(row.get("service_plan_id"), []).append(
                {
                    "detail_text": str(row.get("detail_text") or "").strip(),
                    "sort_order": cls._to_int(row.get("sort_order"), default=0, minimum=0),
                }
            )
        return grouped

    @classmethod
    def _fetch_plan_selection_groups(cls, plan_ids):
        normalized_ids = [cls._to_int(plan_id, minimum=1) for plan_id in plan_ids or []]
        normalized_ids = [plan_id for plan_id in normalized_ids if plan_id]
        if not normalized_ids:
            return {}

        payload = {}
        tokens = []
        for index, plan_id in enumerate(normalized_ids):
            token = f"plan_id_{index}"
            payload[token] = plan_id
            tokens.append(f"%({token})s")
        rows = query_db(
            f"""
      SELECT
        g.id AS group_id,
        g.service_plan_id,
        g.group_key,
        g.group_title,
        g.source_type,
        g.menu_group_key,
        g.min_select,
        g.max_select,
        g.sort_order,
        g.is_active,
        o.id AS option_id,
        o.option_key,
        o.option_label,
        o.menu_item_id,
        o.sort_order AS option_sort_order,
        o.is_active AS option_is_active
      FROM service_plan_selection_groups g
      LEFT JOIN service_plan_selection_options o ON o.selection_group_id = g.id
      WHERE g.service_plan_id IN ({", ".join(tokens)})
      ORDER BY g.service_plan_id ASC, g.sort_order ASC, g.id ASC, o.sort_order ASC, o.id ASC;
      """,
            payload,
        )
        grouped = {}
        group_index = {}
        for row in rows:
            service_plan_id = row.get("service_plan_id")
            if not service_plan_id:
                continue
            grouped.setdefault(service_plan_id, [])
            current_group = group_index.get(row.get("group_id"))
            if current_group is None:
                current_group = {
                    "group_key": row.get("group_key"),
                    "group_title": str(row.get("group_title") or "").strip(),
                    "source_type": str(row.get("source_type") or "").strip() or "custom_options",
                    "menu_group_key": str(row.get("menu_group_key") or "").strip() or None,
                    "min_select": cls._to_int(row.get("min_select"), minimum=0),
                    "max_select": cls._to_int(row.get("max_select"), minimum=0),
                    "sort_order": cls._to_int(row.get("sort_order"), default=0, minimum=0),
                    "is_active": bool(row.get("is_active", 0)),
                    "options": [],
                }
                grouped[service_plan_id].append(current_group)
                group_index[row.get("group_id")] = current_group
            if row.get("option_id"):
                current_group["options"].append(
                    {
                        "option_key": row.get("option_key"),
                        "option_label": str(row.get("option_label") or "").strip(),
                        "menu_item_id": cls._to_int(row.get("menu_item_id"), minimum=1),
                        "sort_order": cls._to_int(row.get("option_sort_order"), default=0, minimum=0),
                        "is_active": bool(row.get("option_is_active", 0)),
                    }
                )
        return grouped

    @classmethod
    def _fetch_include_keys(cls, section_ids):
        normalized_ids = [cls._to_int(section_id, minimum=1) for section_id in section_ids or []]
        normalized_ids = [section_id for section_id in normalized_ids if section_id]
        if not normalized_ids:
            return {}

        payload = {}
        tokens = []
        for index, section_id in enumerate(normalized_ids):
            token = f"section_id_{index}"
            payload[token] = section_id
            tokens.append(f"%({token})s")
        rows = query_db(
            f"""
      SELECT section_id, menu_group_key, sort_order
      FROM service_section_menu_groups
      WHERE section_id IN ({", ".join(tokens)})
      ORDER BY section_id ASC, sort_order ASC, id ASC;
      """,
            payload,
        )
        grouped = {}
        for row in rows:
            grouped.setdefault(row.get("section_id"), []).append(row.get("menu_group_key"))
        return grouped

    @classmethod
    def _serialize_plan_row(cls, row, constraints=None, details=None, selection_groups=None):
        is_active = bool(row.get("is_active", 0))
        price_meta = {
            "amount_min": cls._serialize_decimal(row.get("price_amount_min")),
            "amount_max": cls._serialize_decimal(row.get("price_amount_max")),
            "currency": str(row.get("price_currency") or "").strip().upper() or None,
            "unit": str(row.get("price_unit") or "").strip().lower() or None,
        }
        if not any(price_meta.values()):
            price_meta = None
        return {
            "id": row.get("id"),
            "section_id": row.get("section_id"),
            "section_key": row.get("section_key"),
            "catalog_key": row.get("catalog_key"),
            "plan_key": row.get("plan_key"),
            "title": str(row.get("title") or "").strip(),
            "price": str(row.get("price_display") or "").strip() or None,
            "price_meta": price_meta,
            "selection_mode": cls._normalize_selection_mode(row.get("selection_mode")),
            "sort_order": cls._to_int(row.get("sort_order"), default=0, minimum=0),
            "is_active": is_active,
            "created_at": cls._to_iso(row.get("created_at")),
            "updated_at": cls._to_iso(row.get("updated_at")),
            "constraints": cls._normalize_constraint_rows(constraints or [], catalog_key=row.get("catalog_key")),
            "details": details or [],
            "selection_groups": selection_groups or [],
        }

    @classmethod
    def _get_section_row(cls, section_id, connection=None):
        normalized_section_id = cls._to_int(section_id, minimum=1)
        if not normalized_section_id:
            return None
        return query_db(
            """
      SELECT
        id,
        catalog_key,
        section_key,
        section_type,
        public_section_id,
        title,
        note,
        sort_order,
        is_active
      FROM service_plan_sections
      WHERE id = %(section_id)s
      LIMIT 1;
      """,
            {"section_id": normalized_section_id},
            fetch="one",
            connection=connection,
            auto_commit=False if connection is not None else True,
        )

    @classmethod
    def _get_plan_row(cls, plan_id, connection=None):
        normalized_plan_id = cls._to_int(plan_id, minimum=1)
        if not normalized_plan_id:
            return None
        return query_db(
            """
      SELECT
        p.id,
        p.section_id,
        p.plan_key,
        p.title,
        p.price_display,
        p.price_amount_min,
        p.price_amount_max,
        p.price_currency,
        p.price_unit,
        p.selection_mode,
        p.sort_order,
        p.is_active,
        p.created_at,
        p.updated_at,
        s.catalog_key,
        s.section_key,
        s.section_type
      FROM service_plans p
      JOIN service_plan_sections s ON s.id = p.section_id
      WHERE p.id = %(plan_id)s
      LIMIT 1;
      """,
            {"plan_id": normalized_plan_id},
            fetch="one",
            connection=connection,
            auto_commit=False if connection is not None else True,
        )

    @classmethod
    def _get_plan_by_key(cls, plan_key, connection=None):
        normalized_key = str(plan_key or "").strip().lower()
        if not normalized_key:
            return None
        return query_db(
            """
      SELECT id, plan_key
      FROM service_plans
      WHERE LOWER(plan_key) = LOWER(%(plan_key)s)
      LIMIT 1;
      """,
            {"plan_key": normalized_key},
            fetch="one",
            connection=connection,
            auto_commit=False if connection is not None else True,
        )

    @classmethod
    def _next_plan_sort_order(cls, section_id, connection):
        row = query_db(
            """
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM service_plans
      WHERE section_id = %(section_id)s;
      """,
            {"section_id": section_id},
            fetch="one",
            connection=connection,
            auto_commit=False,
        )
        return cls._to_int((row or {}).get("next_sort_order"), default=1, minimum=1)

    @classmethod
    def _replace_plan_constraints(cls, plan_id, constraints, catalog_key, connection):
        query_db(
            "DELETE FROM service_plan_constraints WHERE service_plan_id = %(plan_id)s;",
            {"plan_id": plan_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )
        rows = cls._normalize_constraint_rows(constraints, catalog_key=catalog_key)
        if not rows:
            return
        query_db_many(
            """
      INSERT INTO service_plan_constraints (service_plan_id, selection_key, min_select, max_select)
      VALUES (%(service_plan_id)s, %(selection_key)s, %(min_select)s, %(max_select)s);
      """,
            [{"service_plan_id": plan_id, **row} for row in rows],
            connection=connection,
            auto_commit=False,
        )

    @classmethod
    def _replace_plan_details(cls, plan_id, details, connection):
        query_db(
            "DELETE FROM service_plan_details WHERE service_plan_id = %(plan_id)s;",
            {"plan_id": plan_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )
        rows = cls._normalize_detail_rows(details)
        if not rows:
            return
        query_db_many(
            """
      INSERT INTO service_plan_details (service_plan_id, detail_text, sort_order)
      VALUES (%(service_plan_id)s, %(detail_text)s, %(sort_order)s);
      """,
            [{"service_plan_id": plan_id, **row} for row in rows],
            connection=connection,
            auto_commit=False,
        )

    @classmethod
    def _replace_plan_selection_groups(cls, plan_id, selection_groups, connection):
        existing_group_rows = query_db(
            "SELECT id FROM service_plan_selection_groups WHERE service_plan_id = %(plan_id)s;",
            {"plan_id": plan_id},
            connection=connection,
            auto_commit=False,
        )
        existing_group_ids = [row.get("id") for row in existing_group_rows if row.get("id")]
        if existing_group_ids:
            query_db_many(
                "DELETE FROM service_plan_selection_options WHERE selection_group_id = %(selection_group_id)s;",
                [{"selection_group_id": group_id} for group_id in existing_group_ids],
                connection=connection,
                auto_commit=False,
            )
        query_db(
            "DELETE FROM service_plan_selection_groups WHERE service_plan_id = %(plan_id)s;",
            {"plan_id": plan_id},
            fetch="none",
            connection=connection,
            auto_commit=False,
        )

        rows = cls._normalize_selection_group_rows(selection_groups)
        for row in rows:
            inserted_group_id = query_db(
                """
      INSERT INTO service_plan_selection_groups (
        service_plan_id,
        group_key,
        group_title,
        source_type,
        menu_group_key,
        min_select,
        max_select,
        sort_order,
        is_active
      )
      VALUES (
        %(service_plan_id)s,
        %(group_key)s,
        %(group_title)s,
        %(source_type)s,
        %(menu_group_key)s,
        %(min_select)s,
        %(max_select)s,
        %(sort_order)s,
        %(is_active)s
      );
      """,
                {"service_plan_id": plan_id, **{key: value for key, value in row.items() if key != "options"}},
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            if row.get("options"):
                query_db_many(
                    """
        INSERT INTO service_plan_selection_options (
          selection_group_id,
          option_key,
          option_label,
          menu_item_id,
          sort_order,
          is_active
        )
        VALUES (
          %(selection_group_id)s,
          %(option_key)s,
          %(option_label)s,
          %(menu_item_id)s,
          %(sort_order)s,
          %(is_active)s
        );
        """,
                    [
                        {"selection_group_id": inserted_group_id, **option_row}
                        for option_row in row.get("options") or []
                    ],
                    connection=connection,
                    auto_commit=False,
                )

    @classmethod
    def list_service_plan_sections(cls, catalog_key="", include_inactive=True):
        try:
            normalized_catalog = cls._normalize_catalog_key(catalog_key)
            conditions = []
            payload = {}
            if normalized_catalog:
                conditions.append("s.catalog_key = %(catalog_key)s")
                payload["catalog_key"] = normalized_catalog
            if not cls._to_bool(include_inactive, default=True):
                conditions.extend(["s.is_active = 1", "(p.id IS NULL OR p.is_active = 1)"])
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            rows = query_db(
                f"""
      SELECT
        s.id AS section_id,
        s.catalog_key,
        s.section_key,
        s.section_type,
        s.public_section_id,
        s.title AS section_title,
        s.note AS section_note,
        s.sort_order AS section_sort_order,
        s.is_active AS section_is_active,
        p.id,
        p.plan_key,
        p.title,
        p.price_display,
        p.price_amount_min,
        p.price_amount_max,
        p.price_currency,
        p.price_unit,
        p.selection_mode,
        p.sort_order,
        p.is_active,
        p.created_at,
        p.updated_at
      FROM service_plan_sections s
      LEFT JOIN service_plans p ON p.section_id = s.id
      {where_clause}
      ORDER BY s.catalog_key ASC, s.sort_order ASC, p.sort_order ASC, p.id ASC;
      """,
                payload,
            )

            section_map = {}
            section_ids = [row.get("section_id") for row in rows if row.get("section_id")]
            plan_ids = [row.get("id") for row in rows if row.get("id")]
            constraints_by_plan_id = cls._fetch_plan_constraints(plan_ids)
            details_by_plan_id = cls._fetch_plan_details(plan_ids)
            selection_groups_by_plan_id = cls._fetch_plan_selection_groups(plan_ids)
            include_keys_by_section_id = cls._fetch_include_keys(section_ids)
            for row in rows:
                section_id = row.get("section_id")
                section = section_map.setdefault(
                    section_id,
                    {
                        "id": section_id,
                        "catalog_key": row.get("catalog_key"),
                        "section_key": row.get("section_key"),
                        "section_type": row.get("section_type"),
                        "public_section_id": row.get("public_section_id"),
                        "title": row.get("section_title"),
                        "note": str(row.get("section_note") or "").strip() or None,
                        "sort_order": row.get("section_sort_order"),
                        "is_active": bool(row.get("section_is_active", 0)),
                        "include_keys": include_keys_by_section_id.get(section_id, []),
                        "plans": [],
                    },
                )
                if not row.get("id"):
                    continue
                plan_id = row.get("id")
                section["plans"].append(
                    cls._serialize_plan_row(
                        row,
                        constraints=constraints_by_plan_id.get(plan_id, []),
                        details=details_by_plan_id.get(plan_id, []),
                        selection_groups=selection_groups_by_plan_id.get(plan_id, []),
                    )
                )
            return {"sections": list(section_map.values())}, 200
        except pymysql.err.ProgrammingError as exc:
            if cls._is_missing_service_plan_tables_error(exc):
                return cls._missing_tables_response()
            raise

    @classmethod
    def get_service_plan_detail(cls, plan_id):
        plan_row = cls._get_plan_row(plan_id)
        if not plan_row:
            return None
        plan_id_value = plan_row.get("id")
        return cls._serialize_plan_row(
            plan_row,
            constraints=cls._fetch_plan_constraints([plan_id_value]).get(plan_id_value, []),
            details=cls._fetch_plan_details([plan_id_value]).get(plan_id_value, []),
            selection_groups=cls._fetch_plan_selection_groups([plan_id_value]).get(plan_id_value, []),
        )

    @classmethod
    def create_service_plan(cls, payload):
        body = payload or {}
        section_id = cls._to_int(body.get("section_id"), minimum=1)
        if not section_id:
            return {"error": "section_id is required."}, 400

        with db_transaction() as connection:
            section_row = cls._get_section_row(section_id, connection=connection)
            if not section_row:
                return {"error": "Service plan section not found."}, 404
            if section_row.get("section_type") == "include_menu":
                return {"error": "Cannot create plans in an include_menu section."}, 400

            title = str(body.get("title") or "").strip()
            if not title:
                return {"error": "title is required."}, 400

            plan_key = cls._build_plan_key(section_row.get("catalog_key"), body.get("plan_key"), title)
            if cls._get_plan_by_key(plan_key, connection=connection):
                return {"error": "plan_key must be unique."}, 409
            is_active = cls._resolve_plan_active_flag(body, default=True)
            normalized_constraints = cls._normalize_constraint_rows(
                body.get("constraints"),
                catalog_key=section_row.get("catalog_key"),
            )
            normalized_details = cls._normalize_detail_rows(body.get("details"))
            normalized_selection_groups = cls._normalize_selection_group_rows(body.get("selection_groups"))
            conflict_error = cls._validate_detail_choice_conflicts(
                normalized_details,
                normalized_constraints,
                normalized_selection_groups,
                catalog_key=section_row.get("catalog_key"),
            )
            if conflict_error:
                return {"error": conflict_error}, 400

            inserted_plan_id = query_db(
                """
        INSERT INTO service_plans (
          section_id,
          plan_key,
          title,
          price_display,
          price_amount_min,
          price_amount_max,
          price_currency,
          price_unit,
          selection_mode,
          sort_order,
          is_active
        )
        VALUES (
          %(section_id)s,
          %(plan_key)s,
          %(title)s,
          %(price_display)s,
          %(price_amount_min)s,
          %(price_amount_max)s,
          %(price_currency)s,
          %(price_unit)s,
          %(selection_mode)s,
          %(sort_order)s,
          %(is_active)s
        );
        """,
                {
                    "section_id": section_id,
                    "plan_key": plan_key,
                    "title": title,
                    "price_display": str(body.get("price") or body.get("price_display") or "").strip() or None,
                    "price_amount_min": cls._serialize_decimal(body.get("price_amount_min")),
                    "price_amount_max": cls._serialize_decimal(body.get("price_amount_max")),
                    "price_currency": str(body.get("price_currency") or "").strip().upper() or None,
                    "price_unit": cls._normalize_selection_key(body.get("price_unit")) or None,
                    "selection_mode": cls._normalize_selection_mode(body.get("selection_mode")),
                    "sort_order": cls._to_int(
                        body.get("sort_order"), default=cls._next_plan_sort_order(section_id, connection), minimum=1
                    ),
                    "is_active": 1 if is_active else 0,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            cls._replace_plan_constraints(
                inserted_plan_id,
                normalized_constraints,
                section_row.get("catalog_key"),
                connection,
            )
            cls._replace_plan_details(inserted_plan_id, normalized_details, connection)
            cls._replace_plan_selection_groups(inserted_plan_id, normalized_selection_groups, connection)

        return {"plan": cls.get_service_plan_detail(inserted_plan_id)}, 201

    @classmethod
    def update_service_plan(cls, plan_id, payload):
        body = payload or {}
        with db_transaction() as connection:
            plan_row = cls._get_plan_row(plan_id, connection=connection)
            if not plan_row:
                return {"error": "Service plan not found."}, 404

            title = str(body.get("title") if "title" in body else plan_row.get("title") or "").strip()
            if not title:
                return {"error": "title is required."}, 400
            if "plan_key" in body and cls._build_plan_key(
                plan_row.get("catalog_key"), body.get("plan_key"), title
            ) != plan_row.get("plan_key"):
                return {"error": "plan_key is immutable once created."}, 400
            is_active = cls._resolve_plan_active_flag(body, default=bool(plan_row.get("is_active", 0)))
            existing_constraints = cls._fetch_plan_constraints([plan_row.get("id")]).get(plan_row.get("id"), [])
            existing_details = cls._fetch_plan_details([plan_row.get("id")]).get(plan_row.get("id"), [])
            existing_selection_groups = cls._fetch_plan_selection_groups([plan_row.get("id")]).get(
                plan_row.get("id"), []
            )
            normalized_constraints = cls._normalize_constraint_rows(
                body.get("constraints") if "constraints" in body else existing_constraints,
                catalog_key=plan_row.get("catalog_key"),
            )
            normalized_details = cls._normalize_detail_rows(
                body.get("details") if "details" in body else existing_details
            )
            normalized_selection_groups = cls._normalize_selection_group_rows(
                body.get("selection_groups") if "selection_groups" in body else existing_selection_groups
            )
            conflict_error = cls._validate_detail_choice_conflicts(
                normalized_details,
                normalized_constraints,
                normalized_selection_groups,
                catalog_key=plan_row.get("catalog_key"),
            )
            if conflict_error:
                return {"error": conflict_error}, 400

            query_db(
                """
        UPDATE service_plans
        SET
          title = %(title)s,
          price_display = %(price_display)s,
          price_amount_min = %(price_amount_min)s,
          price_amount_max = %(price_amount_max)s,
          price_currency = %(price_currency)s,
          price_unit = %(price_unit)s,
          selection_mode = %(selection_mode)s,
          is_active = %(is_active)s,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = %(plan_id)s;
        """,
                {
                    "plan_id": plan_row.get("id"),
                    "title": title,
                    "price_display": str(
                        body.get("price")
                        if "price" in body
                        else (
                            body.get("price_display")
                            if "price_display" in body
                            else plan_row.get("price_display") or ""
                        )
                    ).strip()
                    or None,
                    "price_amount_min": cls._serialize_decimal(
                        body.get("price_amount_min") if "price_amount_min" in body else plan_row.get("price_amount_min")
                    ),
                    "price_amount_max": cls._serialize_decimal(
                        body.get("price_amount_max") if "price_amount_max" in body else plan_row.get("price_amount_max")
                    ),
                    "price_currency": str(
                        body.get("price_currency") if "price_currency" in body else plan_row.get("price_currency") or ""
                    )
                    .strip()
                    .upper()
                    or None,
                    "price_unit": cls._normalize_selection_key(
                        body.get("price_unit") if "price_unit" in body else plan_row.get("price_unit")
                    )
                    or None,
                    "selection_mode": cls._normalize_selection_mode(
                        body.get("selection_mode") if "selection_mode" in body else plan_row.get("selection_mode")
                    ),
                    "is_active": 1 if is_active else 0,
                },
                fetch="none",
                connection=connection,
                auto_commit=False,
            )
            if "constraints" in body:
                cls._replace_plan_constraints(
                    plan_row.get("id"),
                    normalized_constraints,
                    plan_row.get("catalog_key"),
                    connection,
                )
            if "details" in body:
                cls._replace_plan_details(plan_row.get("id"), normalized_details, connection)
            if "selection_groups" in body:
                cls._replace_plan_selection_groups(plan_row.get("id"), normalized_selection_groups, connection)

        return {"plan": cls.get_service_plan_detail(plan_row.get("id"))}, 200

    @classmethod
    def delete_service_plan(cls, plan_id, hard_delete=False):
        normalized_plan_id = cls._to_int(plan_id, minimum=1)
        if not normalized_plan_id:
            return {"error": "Invalid service plan id."}, 400

        with db_transaction() as connection:
            plan_row = cls._get_plan_row(normalized_plan_id, connection=connection)
            if not plan_row:
                return {"error": "Service plan not found."}, 404
            if cls._to_bool(hard_delete, default=False):
                query_db(
                    "DELETE FROM service_plans WHERE id = %(plan_id)s LIMIT 1;",
                    {"plan_id": normalized_plan_id},
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
            else:
                query_db(
                    """
          UPDATE service_plans
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE id = %(plan_id)s;
          """,
                    {"plan_id": normalized_plan_id},
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
        return {"ok": True, "deleted_plan_id": normalized_plan_id, "plan_key": plan_row.get("plan_key")}, 200

    @classmethod
    def reorder_service_plans(cls, section_id, ordered_plan_ids):
        normalized_section_id = cls._to_int(section_id, minimum=1)
        if not normalized_section_id:
            return {"error": "Invalid section id."}, 400

        requested_ids = [cls._to_int(plan_id, minimum=1) for plan_id in ordered_plan_ids or []]
        requested_ids = [plan_id for plan_id in requested_ids if plan_id]
        if not requested_ids:
            return {"error": "ordered_plan_ids is required."}, 400

        with db_transaction() as connection:
            current_rows = query_db(
                """
        SELECT id
        FROM service_plans
        WHERE section_id = %(section_id)s
        ORDER BY sort_order ASC, id ASC;
        """,
                {"section_id": normalized_section_id},
                connection=connection,
                auto_commit=False,
            )
            current_ids = [row.get("id") for row in current_rows]
            if not current_ids:
                return {"error": "Service plan section has no plans to reorder."}, 404

            current_set = set(current_ids)
            ordered_ids = []
            seen = set()
            for plan_id_value in requested_ids + current_ids:
                if plan_id_value in current_set and plan_id_value not in seen:
                    ordered_ids.append(plan_id_value)
                    seen.add(plan_id_value)

            for index, plan_id_value in enumerate(ordered_ids, start=1):
                query_db(
                    "UPDATE service_plans SET sort_order = %(sort_order)s WHERE id = %(plan_id)s;",
                    {"sort_order": 1000000 + index, "plan_id": plan_id_value},
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )
            for index, plan_id_value in enumerate(ordered_ids, start=1):
                query_db(
                    "UPDATE service_plans SET sort_order = %(sort_order)s WHERE id = %(plan_id)s;",
                    {"sort_order": index, "plan_id": plan_id_value},
                    fetch="none",
                    connection=connection,
                    auto_commit=False,
                )

        return {"ok": True, "ordered_plan_ids": ordered_ids}, 200
