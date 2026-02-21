import json
import numbers
import re

from flask_api.config.mysqlconnection import query_db, query_db_many


class Menu:
    CACHE_CONFIG_KEY = "catalog_payload_v1"
    PRICE_TOKEN_REGEX = re.compile(r"\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\+?")
    NON_FORMAL_CATALOG_KEYS = {"togo", "community"}
    ITEM_FALLBACK_TYPE = "general"
    ITEM_FALLBACK_CATEGORY = "other"

    @staticmethod
    def _slug(value):
        slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
        return slug[:120] if slug else None

    @classmethod
    def _normalize_classification_value(cls, value, fallback):
        source = re.sub(r"(?<!^)(?=[A-Z])", "_", str(value or ""))
        normalized = cls._slug(source)
        return normalized or fallback

    @staticmethod
    def _normalize_tray_price_value(value):
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        normalized = str(value).strip()
        return normalized or None

    @staticmethod
    def _coerce_active_flag(value, default=True):
        if value is None:
            return 1 if default else 0
        if isinstance(value, bool):
            return 1 if value else 0
        if isinstance(value, numbers.Number):
            return 1 if int(value) != 0 else 0
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "y", "on"}:
            return 1
        if normalized in {"0", "false", "no", "n", "off"}:
            return 0
        return 1 if default else 0

    @classmethod
    def _build_item_reference_payload(cls, row, half_price=None, full_price=None):
        return {
            "itemId": row.get("item_id"),
            "itemName": row.get("item_name"),
            "itemType": cls._normalize_classification_value(row.get("item_type"), cls.ITEM_FALLBACK_TYPE),
            "itemCategory": cls._normalize_classification_value(row.get("item_category"), cls.ITEM_FALLBACK_CATEGORY),
            "isActive": cls._coerce_active_flag(row.get("item_active"), default=True),
            "trayPrices": {
                "half": cls._normalize_tray_price_value(
                    half_price if half_price is not None else row.get("tray_price_half")
                ),
                "full": cls._normalize_tray_price_value(
                    full_price if full_price is not None else row.get("tray_price_full")
                ),
            },
        }

    @classmethod
    def _extract_non_formal_items_from_payload(cls, payload):
        raw = (
            payload.get("non_formal_items")
            or payload.get("shared_non_formal_items")
            or payload.get("NON_FORMAL_ITEMS")
            or payload.get("SHARED_NON_FORMAL_ITEMS")
            or []
        )
        if not isinstance(raw, list):
            return []

        normalized = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or item.get("item_name") or item.get("itemName") or "").strip()
            if not name:
                continue
            tray_prices = item.get("tray_prices") or item.get("trayPrices") or {}
            if not isinstance(tray_prices, dict):
                tray_prices = {}

            normalized.append(
                {
                    "item_name": name,
                    "item_type": cls._normalize_classification_value(
                        item.get("item_type") or item.get("itemType") or item.get("type"),
                        cls.ITEM_FALLBACK_TYPE,
                    ),
                    "item_category": cls._normalize_classification_value(
                        item.get("item_category") or item.get("itemCategory") or item.get("category"),
                        cls.ITEM_FALLBACK_CATEGORY,
                    ),
                    "is_active": cls._coerce_active_flag(item.get("is_active", item.get("active")), default=True),
                    "tray_price_half": cls._normalize_tray_price_value(
                        tray_prices.get("half")
                        if "half" in tray_prices
                        else tray_prices.get("half_tray", item.get("tray_price_half"))
                    ),
                    "tray_price_full": cls._normalize_tray_price_value(
                        tray_prices.get("full")
                        if "full" in tray_prices
                        else tray_prices.get("full_tray", item.get("tray_price_full"))
                    ),
                }
            )
        return normalized

    @classmethod
    def _collect_item_records_from_payload(cls, menu_options, menu, non_formal_items=None):
        item_records = {}

        def _ensure_item(
            name,
            item_type_hint=None,
            item_category_hint=None,
            is_active=1,
            tray_half=None,
            tray_full=None,
        ):
            item_name = str(name or "").strip()
            if not item_name:
                return None
            existing = item_records.get(item_name)
            if existing is None:
                existing = {
                    "item_name": item_name,
                    "item_key": cls._slug(item_name),
                    "item_type": cls._normalize_classification_value(item_type_hint, cls.ITEM_FALLBACK_TYPE),
                    "item_category": cls._normalize_classification_value(
                        item_category_hint, cls.ITEM_FALLBACK_CATEGORY
                    ),
                    "is_active": cls._coerce_active_flag(is_active, default=True),
                    "tray_price_half": cls._normalize_tray_price_value(tray_half),
                    "tray_price_full": cls._normalize_tray_price_value(tray_full),
                }
                item_records[item_name] = existing
                return existing

            if item_type_hint:
                current_type = cls._normalize_classification_value(
                    existing.get("item_type"),
                    cls.ITEM_FALLBACK_TYPE,
                )
                if current_type == cls.ITEM_FALLBACK_TYPE:
                    existing["item_type"] = cls._normalize_classification_value(
                        item_type_hint,
                        cls.ITEM_FALLBACK_TYPE,
                    )
            if item_category_hint:
                current_category = cls._normalize_classification_value(
                    existing.get("item_category"),
                    cls.ITEM_FALLBACK_CATEGORY,
                )
                if current_category == cls.ITEM_FALLBACK_CATEGORY:
                    existing["item_category"] = cls._normalize_classification_value(
                        item_category_hint,
                        cls.ITEM_FALLBACK_CATEGORY,
                    )

            existing["is_active"] = max(existing.get("is_active", 1), cls._coerce_active_flag(is_active, default=True))
            normalized_half = cls._normalize_tray_price_value(tray_half)
            normalized_full = cls._normalize_tray_price_value(tray_full)
            if normalized_half is not None:
                existing["tray_price_half"] = normalized_half
            if normalized_full is not None:
                existing["tray_price_full"] = normalized_full
            return existing

        for item in non_formal_items or []:
            _ensure_item(
                name=item.get("item_name"),
                item_type_hint=item.get("item_type"),
                item_category_hint=item.get("item_category"),
                is_active=item.get("is_active", 1),
                tray_half=item.get("tray_price_half"),
                tray_full=item.get("tray_price_full"),
            )

        for option_key, option_group in (menu_options or {}).items():
            if not isinstance(option_group, dict):
                continue
            category = option_group.get("category")
            for item_name in option_group.get("items", []):
                _ensure_item(
                    name=item_name,
                    item_type_hint=option_key,
                    item_category_hint=category,
                    is_active=1,
                )

        for catalog_key, catalog in (menu or {}).items():
            if not isinstance(catalog, dict):
                continue
            normalized_catalog_key = str(catalog_key or "").strip().lower()
            is_non_formal_catalog = normalized_catalog_key in cls.NON_FORMAL_CATALOG_KEYS
            for section in catalog.get("sections", []):
                if not isinstance(section, dict):
                    continue
                section_id = section.get("sectionId")
                section_category = section.get("category")
                section_course_type = section.get("courseType")
                for row in section.get("rows", []):
                    if not isinstance(row, list) or not row:
                        continue
                    item_name = row[0]
                    tray_half = (
                        row[1] if len(row) > 1 and is_non_formal_catalog and normalized_catalog_key == "togo" else None
                    )
                    tray_full = (
                        row[2] if len(row) > 2 and is_non_formal_catalog and normalized_catalog_key == "togo" else None
                    )
                    _ensure_item(
                        name=item_name,
                        item_type_hint=section_id if is_non_formal_catalog else section_course_type or section_id,
                        item_category_hint=section_category if is_non_formal_catalog else section_course_type,
                        is_active=1,
                        tray_half=tray_half,
                        tray_full=tray_full,
                    )

                should_materialize_tier_bullets = normalized_catalog_key == "formal" or bool(section_course_type)
                if not should_materialize_tier_bullets:
                    continue

                for tier in section.get("tiers", []):
                    if not isinstance(tier, dict):
                        continue
                    for bullet in tier.get("bullets", []):
                        _ensure_item(
                            name=bullet,
                            item_type_hint=section_course_type or section_id,
                            item_category_hint=section_course_type or section_category,
                            is_active=1,
                        )

        return item_records

    @staticmethod
    def _coerce_price_number(value):
        if value in (None, ""):
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, numbers.Number):
            return round(float(value), 2)
        if not isinstance(value, str):
            return None

        cleaned = value.strip().replace("$", "").replace(",", "")
        if cleaned.endswith("+"):
            cleaned = cleaned[:-1]
        if cleaned.lower().endswith("k"):
            cleaned = cleaned[:-1]
            try:
                return round(float(cleaned) * 1000, 2)
            except ValueError:
                return None

        try:
            return round(float(cleaned), 2)
        except ValueError:
            return None

    @classmethod
    def _extract_price_amounts(cls, text):
        if not isinstance(text, str):
            return []

        values = []
        for match in cls.PRICE_TOKEN_REGEX.finditer(text):
            raw_amount = match.group(1).replace(",", "")
            suffix = (match.group(2) or "").lower()
            try:
                amount = float(raw_amount)
            except ValueError:
                continue
            if suffix == "k":
                amount *= 1000
            values.append(round(amount, 2))
        return values

    @staticmethod
    def _infer_price_currency(text):
        if not isinstance(text, str):
            return None
        lower = text.lower()
        if "$" in text or "usd" in lower:
            return "USD"
        return None

    @staticmethod
    def _infer_price_unit(text):
        if not isinstance(text, str):
            return None
        lower = text.lower()
        if "per person" in lower or "/person" in lower:
            return "per_person"
        if "per tray" in lower or "/tray" in lower:
            return "per_tray"
        if "per hour" in lower or "/hour" in lower:
            return "per_hour"
        if "flat rate" in lower or "flat fee" in lower:
            return "flat"
        return None

    @classmethod
    def _normalize_price_fields(cls, price_value, price_meta=None):
        meta = price_meta if isinstance(price_meta, dict) else {}

        display_price = None
        if isinstance(price_value, str):
            display_price = price_value.strip() or None
        elif isinstance(price_value, bool):
            display_price = None
        elif isinstance(price_value, numbers.Number):
            amount = round(float(price_value), 2)
            display_price = f"${int(amount):,}" if amount.is_integer() else f"${amount:,.2f}".rstrip("0").rstrip(".")
        elif price_value is not None:
            display_price = str(price_value).strip() or None

        amount_min = cls._coerce_price_number(
            meta.get("amountMin")
            if "amountMin" in meta
            else meta.get("amount_min", meta.get("min", meta.get("price_min")))
        )
        amount_max = cls._coerce_price_number(
            meta.get("amountMax")
            if "amountMax" in meta
            else meta.get("amount_max", meta.get("max", meta.get("price_max")))
        )
        currency = (
            str(meta.get("currency") or meta.get("priceCurrency") or meta.get("price_currency") or "").strip().upper()
            or None
        )
        unit = str(meta.get("unit") or meta.get("priceUnit") or meta.get("price_unit") or "").strip().lower() or None
        if unit:
            unit = unit.replace("-", "_").replace(" ", "_")

        parsed_amounts = cls._extract_price_amounts(display_price or "")
        if parsed_amounts:
            parsed_min = min(parsed_amounts)
            parsed_max = max(parsed_amounts)
            if amount_min is None:
                amount_min = parsed_min
            if amount_max is None:
                amount_max = parsed_max

        if amount_min is not None and amount_max is None:
            amount_max = amount_min
        if amount_max is not None and amount_min is None:
            amount_min = amount_max
        if amount_min is not None and amount_max is not None and amount_max < amount_min:
            amount_min, amount_max = amount_max, amount_min

        if not currency:
            currency = cls._infer_price_currency(display_price or "")
        if not currency and (amount_min is not None or amount_max is not None):
            currency = "USD"

        if not unit:
            unit = cls._infer_price_unit(display_price or "")

        return {
            "price": display_price,
            "price_amount_min": amount_min,
            "price_amount_max": amount_max,
            "price_currency": currency,
            "price_unit": unit,
        }

    @classmethod
    def _attach_price_meta_to_payload(cls, target, price_value, price_meta=None):
        normalized = cls._normalize_price_fields(price_value, price_meta=price_meta)
        if normalized["price"] is not None:
            target["price"] = normalized["price"]

        if any(
            normalized[key] is not None
            for key in ("price_amount_min", "price_amount_max", "price_currency", "price_unit")
        ):
            target["priceMeta"] = {
                "amountMin": normalized["price_amount_min"],
                "amountMax": normalized["price_amount_max"],
                "currency": normalized["price_currency"],
                "unit": normalized["price_unit"],
            }

    @staticmethod
    def _normalize_tier_constraints(rows):
        constraints = {}
        for row in rows:
            key = str(row.get("constraint_key") or "").strip()
            if not key:
                continue

            min_select = row.get("min_select")
            max_select = row.get("max_select")
            legacy_value = row.get("constraint_value")

            try:
                min_select = int(min_select) if min_select is not None else None
            except (TypeError, ValueError):
                min_select = None
            try:
                max_select = int(max_select) if max_select is not None else None
            except (TypeError, ValueError):
                max_select = None
            try:
                legacy_value = int(legacy_value) if legacy_value is not None else None
            except (TypeError, ValueError):
                legacy_value = None

            # Backward compatibility for legacy suffix rows.
            if key.endswith("_min") and legacy_value is not None:
                base_key = key[:-4]
                constraints.setdefault(base_key, {"min": 0, "max": 0})["min"] = legacy_value
                continue
            if key.endswith("_max") and legacy_value is not None:
                base_key = key[:-4]
                constraints.setdefault(base_key, {"min": 0, "max": 0})["max"] = legacy_value
                continue

            if legacy_value is not None:
                if min_select is None or (min_select == 0 and (max_select is None or max_select == 0)):
                    min_select = legacy_value
                if max_select is None or (max_select == 0 and (min_select is None or min_select == legacy_value)):
                    max_select = legacy_value

            constraints[key] = {
                "min": int(min_select or 0),
                "max": int(max_select or 0),
            }

        return constraints

    @staticmethod
    def _normalize_min_max_constraints(rows):
        constraints = {}
        for row in rows:
            key = row.get("constraint_key")
            if not key:
                continue
            constraints[str(key)] = {
                "min": int(row.get("min_select") or 0),
                "max": int(row.get("max_select") or 0),
            }
        return constraints

    @classmethod
    def _normalize_payload_constraints(cls, constraints):
        if not isinstance(constraints, dict):
            return {}

        normalized = {}
        for key, value in constraints.items():
            if isinstance(value, int):
                normalized[str(key)] = {"min": value, "max": value}
            elif isinstance(value, dict):
                min_value = value.get("min")
                max_value = value.get("max")
                if isinstance(min_value, int) or isinstance(max_value, int):
                    normalized[str(key)] = {
                        "min": min_value or 0,
                        "max": max_value or 0,
                    }

        if "sides_salads" in normalized and "sides" not in normalized and "salads" not in normalized:
            normalized["sides"] = normalized.pop("sides_salads")
        return normalized

    @classmethod
    def _get_menu_options(cls):
        rows = None
        try:
            rows = query_db(
                """
      SELECT
        g.id AS group_id,
        g.option_key,
        g.option_id,
        g.category,
        g.title,
        g.display_order AS group_order,
        i.id AS item_id,
        i.item_name,
        i.item_type,
        i.item_category,
        i.tray_price_half,
        i.tray_price_full,
        i.is_active AS item_active,
        gi.display_order AS item_order
      FROM menu_option_groups g
      LEFT JOIN menu_option_group_items gi
        ON gi.group_id = g.id AND gi.is_active = 1
      LEFT JOIN menu_items i
        ON i.id = gi.item_id AND i.is_active = 1
      WHERE g.is_active = 1
      ORDER BY g.display_order ASC, g.id ASC, gi.display_order ASC, gi.id ASC;
    """
            )
        except Exception as exc:
            error_text = str(exc).lower()
            if "unknown column" not in error_text:
                raise
            rows = query_db(
                """
      SELECT
        g.id AS group_id,
        g.option_key,
        g.option_id,
        g.category,
        g.title,
        g.display_order AS group_order,
        i.id AS item_id,
        i.item_name,
        gi.display_order AS item_order
      FROM menu_option_groups g
      LEFT JOIN menu_option_group_items gi
        ON gi.group_id = g.id AND gi.is_active = 1
      LEFT JOIN menu_items i
        ON i.id = gi.item_id AND i.is_active = 1
      WHERE g.is_active = 1
      ORDER BY g.display_order ASC, g.id ASC, gi.display_order ASC, gi.id ASC;
    """
            )
        if not rows:
            return {}

        payload = {}
        seen = set()
        for row in rows:
            key = row["option_key"]
            if key not in seen:
                payload[key] = {
                    "id": row["option_id"],
                    "category": row["category"],
                    "title": row["title"],
                    "items": [],
                    "itemRefs": [],
                }
                seen.add(key)

            if row["item_name"]:
                payload[key]["items"].append(row["item_name"])
                payload[key]["itemRefs"].append(cls._build_item_reference_payload(row))

        return payload

    @classmethod
    def _get_formal_plan_options(cls):
        plans = query_db(
            """
      SELECT id, plan_key, option_level, title, price
      FROM formal_plan_options
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC;
      """
        )
        if not plans:
            return []

        details = query_db(
            """
      SELECT plan_option_id, detail_text
      FROM formal_plan_option_details
      WHERE is_active = 1
      ORDER BY plan_option_id ASC, display_order ASC, id ASC;
      """
        )
        constraints = query_db(
            """
      SELECT plan_option_id, constraint_key, min_select, max_select
      FROM formal_plan_option_constraints
      WHERE is_active = 1
      ORDER BY plan_option_id ASC, id ASC;
      """
        )

        details_by_plan = {}
        for row in details:
            details_by_plan.setdefault(row["plan_option_id"], []).append(row["detail_text"])

        constraints_by_plan = {}
        for row in constraints:
            constraints_by_plan.setdefault(row["plan_option_id"], {})[row["constraint_key"]] = {
                "min": row["min_select"],
                "max": row["max_select"],
            }

        payload = []
        for row in plans:
            plan = {
                "id": row["plan_key"],
                "level": row["option_level"],
                "title": row["title"],
                "details": details_by_plan.get(row["id"], []),
                "constraints": constraints_by_plan.get(row["id"], {}),
            }
            cls._attach_price_meta_to_payload(plan, row.get("price"))
            payload.append(plan)
        return payload

    @classmethod
    def _get_menu_catalog(cls):
        catalogs = query_db(
            """
      SELECT id, catalog_key, page_title, subtitle
      FROM menu_catalogs
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC;
      """
        )
        if not catalogs:
            return {}

        payload = {}
        catalog_ids = {}
        for row in catalogs:
            payload[row["catalog_key"]] = {
                "pageTitle": row["page_title"],
                "subtitle": row["subtitle"],
            }
            catalog_ids[row["id"]] = row["catalog_key"]

        intro_rows = query_db(
            """
      SELECT
        b.catalog_id,
        b.id AS block_id,
        b.title AS block_title,
        b.display_order AS block_order,
        ib.bullet_text,
        ib.display_order AS bullet_order
      FROM menu_intro_blocks b
      LEFT JOIN menu_intro_bullets ib
        ON ib.intro_block_id = b.id AND ib.is_active = 1
      WHERE b.is_active = 1
      ORDER BY b.catalog_id ASC, b.display_order ASC, b.id ASC, ib.display_order ASC, ib.id ASC;
      """
        )

        intro_by_catalog = {}
        for row in intro_rows:
            catalog_key = catalog_ids.get(row["catalog_id"])
            if not catalog_key:
                continue

            block_bucket = intro_by_catalog.setdefault(catalog_key, {})
            if row["block_id"] not in block_bucket:
                block_bucket[row["block_id"]] = {"title": row["block_title"], "bullets": []}
            if row["bullet_text"] is not None:
                block_bucket[row["block_id"]]["bullets"].append(row["bullet_text"])

        for catalog_key, blocks in intro_by_catalog.items():
            payload[catalog_key]["introBlocks"] = list(blocks.values())

        section_rows = query_db(
            """
      SELECT
        s.id AS section_id,
        s.catalog_id,
        s.section_key,
        s.section_type,
        s.title,
        s.description,
        s.price,
        s.category,
        s.course_type
      FROM menu_sections s
      WHERE s.is_active = 1
      ORDER BY s.catalog_id ASC, s.display_order ASC, s.id ASC;
      """
        )

        section_by_id = {}
        section_catalog_by_id = {}
        for row in section_rows:
            catalog_key = catalog_ids.get(row["catalog_id"])
            if not catalog_key:
                continue

            section = {"sectionId": row["section_key"]}
            if row["section_type"] is not None:
                section["type"] = row["section_type"]
            if row["course_type"] is not None:
                section["courseType"] = row["course_type"]
            if row["category"] is not None:
                section["category"] = row["category"]
            section["title"] = row["title"]
            if row["description"] is not None:
                section["description"] = row["description"]
            cls._attach_price_meta_to_payload(section, row.get("price"))

            payload[catalog_key].setdefault("sections", []).append(section)
            section_by_id[row["section_id"]] = section
            section_catalog_by_id[row["section_id"]] = catalog_key

        section_columns = query_db(
            """
      SELECT section_id, column_label
      FROM menu_section_columns
      WHERE is_active = 1
      ORDER BY section_id ASC, display_order ASC, id ASC;
      """
        )
        for row in section_columns:
            section = section_by_id.get(row["section_id"])
            if section is None:
                continue
            section.setdefault("columns", []).append(row["column_label"])

        section_pricing_rows = None
        try:
            section_pricing_rows = query_db(
                """
      SELECT
        r.section_id,
        i.id AS item_id,
        i.item_name,
        i.item_type,
        i.item_category,
        i.tray_price_half,
        i.tray_price_full,
        i.is_active AS item_active,
        r.value_1,
        r.value_2
      FROM menu_section_rows r
      JOIN menu_items i ON i.id = r.item_id AND i.is_active = 1
      WHERE r.is_active = 1
      ORDER BY r.section_id ASC, r.display_order ASC, r.id ASC;
      """
            )
        except Exception as exc:
            error_text = str(exc).lower()
            if "unknown column" not in error_text:
                raise
            section_pricing_rows = query_db(
                """
      SELECT r.section_id, i.id AS item_id, i.item_name, r.value_1, r.value_2
      FROM menu_section_rows r
      JOIN menu_items i ON i.id = r.item_id AND i.is_active = 1
      WHERE r.is_active = 1
      ORDER BY r.section_id ASC, r.display_order ASC, r.id ASC;
      """
            )
        for row in section_pricing_rows:
            section = section_by_id.get(row["section_id"])
            if section is None:
                continue
            section_catalog_key = section_catalog_by_id.get(row["section_id"])
            half_price = row.get("value_1")
            full_price = row.get("value_2")
            if section_catalog_key in cls.NON_FORMAL_CATALOG_KEYS and section_catalog_key == "togo":
                half_price = cls._normalize_tray_price_value(row.get("tray_price_half")) or half_price
                full_price = cls._normalize_tray_price_value(row.get("tray_price_full")) or full_price

            section.setdefault("rows", []).append([row["item_name"], half_price, full_price])
            section.setdefault("rowItems", []).append(
                cls._build_item_reference_payload(row, half_price=half_price, full_price=full_price)
            )

        section_constraint_rows = query_db(
            """
      SELECT section_id, constraint_key, min_select, max_select
      FROM menu_section_constraints
      WHERE is_active = 1
      ORDER BY section_id ASC, id ASC;
      """
        )
        constraints_by_section_id = {}
        for row in section_constraint_rows:
            constraints_by_section_id.setdefault(row["section_id"], []).append(row)

        for section_id, rows in constraints_by_section_id.items():
            section = section_by_id.get(section_id)
            if section is None:
                continue
            section["constraints"] = cls._normalize_min_max_constraints(rows)

        include_rows = query_db(
            """
      SELECT ig.section_id, g.option_key
      FROM menu_section_include_groups ig
      JOIN menu_option_groups g
        ON g.id = ig.group_id AND g.is_active = 1
      WHERE ig.is_active = 1
      ORDER BY ig.section_id ASC, ig.display_order ASC, ig.id ASC;
      """
        )
        for row in include_rows:
            section = section_by_id.get(row["section_id"])
            if section is None:
                continue
            section.setdefault("includeKeys", []).append(row["option_key"])

        tier_rows = query_db(
            """
      SELECT id, section_id, tier_title, price
      FROM menu_section_tiers
      WHERE is_active = 1
      ORDER BY section_id ASC, display_order ASC, id ASC;
      """
        )
        tiers_by_id = {}
        for row in tier_rows:
            section = section_by_id.get(row["section_id"])
            if section is None:
                continue
            tier = {"tierTitle": row["tier_title"]}
            cls._attach_price_meta_to_payload(tier, row.get("price"))
            tier["bullets"] = []
            tiers_by_id[row["id"]] = tier
            section.setdefault("tiers", []).append(tier)

        tier_constraint_rows = query_db(
            """
      SELECT tier_id, constraint_key, min_select, max_select, constraint_value
      FROM menu_section_tier_constraints
      WHERE is_active = 1
      ORDER BY tier_id ASC, id ASC;
      """
        )
        tier_constraints_by_id = {}
        for row in tier_constraint_rows:
            tier_constraints_by_id.setdefault(row["tier_id"], []).append(row)

        for tier_id, rows in tier_constraints_by_id.items():
            tier = tiers_by_id.get(tier_id)
            if tier is None:
                continue
            tier["constraints"] = cls._normalize_tier_constraints(rows)

        tier_bullet_rows = None
        try:
            tier_bullet_rows = query_db(
                """
      SELECT
        b.tier_id,
        i.id AS item_id,
        i.item_name,
        i.item_type,
        i.item_category,
        i.tray_price_half,
        i.tray_price_full,
        i.is_active AS item_active,
        COALESCE(i.item_name, b.bullet_text) AS bullet_text
      FROM menu_section_tier_bullets b
      LEFT JOIN menu_items i
        ON i.id = b.item_id AND i.is_active = 1
      WHERE b.is_active = 1
        AND (b.item_id IS NULL OR i.id IS NOT NULL)
      ORDER BY b.tier_id ASC, b.display_order ASC, b.id ASC;
      """
            )
        except Exception as exc:
            error_text = str(exc).lower()
            if "unknown column" not in error_text:
                raise
            tier_bullet_rows = query_db(
                """
      SELECT b.tier_id, i.id AS item_id, i.item_name, COALESCE(i.item_name, b.bullet_text) AS bullet_text
      FROM menu_section_tier_bullets b
      LEFT JOIN menu_items i
        ON i.id = b.item_id AND i.is_active = 1
      WHERE b.is_active = 1
        AND (b.item_id IS NULL OR i.id IS NOT NULL)
      ORDER BY b.tier_id ASC, b.display_order ASC, b.id ASC;
      """
            )
        for row in tier_bullet_rows:
            tier = tiers_by_id.get(row["tier_id"])
            if tier is None:
                continue
            tier.setdefault("bullets", []).append(row["bullet_text"])
            if row.get("item_id") is not None:
                tier.setdefault("bulletItems", []).append(cls._build_item_reference_payload(row))

        return payload

    @classmethod
    def _get_shared_non_formal_items(cls):
        rows = None
        try:
            rows = query_db(
                """
      SELECT DISTINCT
        i.id AS item_id,
        i.item_name,
        i.item_type,
        i.item_category,
        i.tray_price_half,
        i.tray_price_full,
        i.is_active AS item_active
      FROM menu_items i
      JOIN (
        SELECT gi.item_id
        FROM menu_option_group_items gi
        JOIN menu_option_groups g
          ON g.id = gi.group_id
        WHERE gi.is_active = 1
          AND g.is_active = 1
        UNION
        SELECT r.item_id
        FROM menu_section_rows r
        JOIN menu_sections s
          ON s.id = r.section_id AND s.is_active = 1
        JOIN menu_catalogs c
          ON c.id = s.catalog_id AND c.is_active = 1
        WHERE r.is_active = 1
          AND c.catalog_key IN ('togo', 'community')
        UNION
        SELECT b.item_id
        FROM menu_section_tier_bullets b
        JOIN menu_section_tiers t
          ON t.id = b.tier_id AND t.is_active = 1
        JOIN menu_sections s
          ON s.id = t.section_id AND s.is_active = 1
        JOIN menu_catalogs c
          ON c.id = s.catalog_id AND c.is_active = 1
        WHERE b.is_active = 1
          AND b.item_id IS NOT NULL
          AND c.catalog_key IN ('togo', 'community')
      ) linked
        ON linked.item_id = i.id
      WHERE i.is_active = 1
      ORDER BY i.item_name ASC;
      """
            )
        except Exception as exc:
            error_text = str(exc).lower()
            if "unknown column" not in error_text:
                raise
            rows = query_db(
                """
      SELECT DISTINCT
        i.id AS item_id,
        i.item_name
      FROM menu_items i
      JOIN (
        SELECT gi.item_id
        FROM menu_option_group_items gi
        JOIN menu_option_groups g
          ON g.id = gi.group_id
        WHERE gi.is_active = 1
          AND g.is_active = 1
        UNION
        SELECT r.item_id
        FROM menu_section_rows r
        JOIN menu_sections s
          ON s.id = r.section_id AND s.is_active = 1
        JOIN menu_catalogs c
          ON c.id = s.catalog_id AND c.is_active = 1
        WHERE r.is_active = 1
          AND c.catalog_key IN ('togo', 'community')
      ) linked
        ON linked.item_id = i.id
      WHERE i.is_active = 1
      ORDER BY i.item_name ASC;
      """
            )

        return [cls._build_item_reference_payload(row) for row in (rows or [])]

    @classmethod
    def get_config_payload(cls):
        menu_options = cls._get_menu_options()
        formal_plan_options = cls._get_formal_plan_options()
        menu = cls._get_menu_catalog()
        shared_non_formal_items = cls._get_shared_non_formal_items()

        if not menu_options or not formal_plan_options or not menu:
            return None

        return {
            "menu_options": menu_options,
            "formal_plan_options": formal_plan_options,
            "menu": menu,
            "shared_non_formal_items": shared_non_formal_items,
        }

    @classmethod
    def get_cached_config_payload(cls):
        row = query_db(
            """
      SELECT config_json
      FROM menu_config
      WHERE config_key = %(config_key)s
      LIMIT 1;
      """,
            {"config_key": cls.CACHE_CONFIG_KEY},
            fetch="one",
        )
        if not row:
            return None

        cached = row.get("config_json")
        if isinstance(cached, dict):
            return cached
        if isinstance(cached, str):
            try:
                parsed = json.loads(cached)
            except json.JSONDecodeError:
                return None
            return parsed if isinstance(parsed, dict) else None
        return None

    @classmethod
    def upsert_cached_config_payload(cls, payload):
        query_db(
            """
      INSERT INTO menu_config (config_key, config_json)
      VALUES (%(config_key)s, CAST(%(config_json)s AS JSON))
      ON DUPLICATE KEY UPDATE
        config_json = VALUES(config_json),
        updated_at = CURRENT_TIMESTAMP;
      """,
            {
                "config_key": cls.CACHE_CONFIG_KEY,
                "config_json": json.dumps(payload, ensure_ascii=False),
            },
            fetch="none",
        )

    @classmethod
    def clear_cached_config_payload(cls):
        query_db(
            """
      DELETE FROM menu_config
      WHERE config_key = %(config_key)s;
      """,
            {"config_key": cls.CACHE_CONFIG_KEY},
            fetch="none",
        )

    @classmethod
    def get_effective_service_constraints(cls, service_selection):
        if not isinstance(service_selection, dict):
            return {}

        plan_id = str(service_selection.get("id") or "").strip()
        level = str(service_selection.get("level") or "").strip().lower()
        section_key = str(service_selection.get("sectionId") or "").strip()
        title = str(service_selection.get("title") or "").strip()

        if plan_id:
            formal_rows = query_db(
                """
        SELECT c.constraint_key, c.min_select, c.max_select
        FROM formal_plan_options p
        JOIN formal_plan_option_constraints c
          ON c.plan_option_id = p.id AND c.is_active = 1
        WHERE p.is_active = 1
          AND p.plan_key = %(plan_key)s
        ORDER BY c.id ASC;
        """,
                {"plan_key": plan_id},
            )
            formal_constraints = cls._normalize_min_max_constraints(formal_rows or [])
            if formal_constraints:
                return formal_constraints

        if section_key and level == "tier" and title:
            query_payload = {"section_key": section_key, "tier_title": title}
            tier_rows = None
            try:
                tier_rows = query_db(
                    """
          SELECT c.constraint_key, c.min_select, c.max_select, c.constraint_value
          FROM menu_sections s
          JOIN menu_section_tiers t
            ON t.section_id = s.id AND t.is_active = 1
          JOIN menu_section_tier_constraints c
            ON c.tier_id = t.id AND c.is_active = 1
          WHERE s.is_active = 1
            AND s.section_key = %(section_key)s
            AND t.tier_title = %(tier_title)s
          ORDER BY c.id ASC;
          """,
                    query_payload,
                )
            except Exception as exc:
                error_text = str(exc).lower()
                if "unknown column" not in error_text or "min_select" not in error_text:
                    raise
                # Backward compatibility for legacy environments before min/max rollout.
                legacy_rows = query_db(
                    """
          SELECT c.constraint_key, c.constraint_value
          FROM menu_sections s
          JOIN menu_section_tiers t
            ON t.section_id = s.id AND t.is_active = 1
          JOIN menu_section_tier_constraints c
            ON c.tier_id = t.id AND c.is_active = 1
          WHERE s.is_active = 1
            AND s.section_key = %(section_key)s
            AND t.tier_title = %(tier_title)s
          ORDER BY c.id ASC;
          """,
                    query_payload,
                )
                tier_rows = [
                    {
                        "constraint_key": row.get("constraint_key"),
                        "min_select": None,
                        "max_select": None,
                        "constraint_value": row.get("constraint_value"),
                    }
                    for row in (legacy_rows or [])
                ]
            tier_constraints = cls._normalize_tier_constraints(tier_rows or [])
            if tier_constraints:
                return cls._normalize_payload_constraints(tier_constraints)

        if section_key and level == "package":
            package_rows = query_db(
                """
        SELECT c.constraint_key, c.min_select, c.max_select
        FROM menu_sections s
        JOIN menu_section_constraints c
          ON c.section_id = s.id AND c.is_active = 1
        WHERE s.is_active = 1
          AND s.section_key = %(section_key)s
        ORDER BY c.id ASC;
        """,
                {"section_key": section_key},
            )
            package_constraints = cls._normalize_min_max_constraints(package_rows or [])
            if package_constraints:
                return package_constraints

        # Fallback for legacy payloads while clients converge on DB-backed constraints.
        return cls._normalize_payload_constraints(service_selection.get("constraints"))

    @classmethod
    def seed_from_payload(cls, payload):
        menu_options = payload.get("menu_options") or payload.get("MENU_OPTIONS") or {}
        formal_plan_options = payload.get("formal_plan_options") or payload.get("FORMAL_PLAN_OPTIONS") or []
        menu = payload.get("menu") or payload.get("MENU") or {}

        non_formal_items = cls._extract_non_formal_items_from_payload(payload)
        item_records = cls._collect_item_records_from_payload(
            menu_options=menu_options,
            menu=menu,
            non_formal_items=non_formal_items,
        )

        item_rows = [item_records[item_name] for item_name in sorted(item_records.keys())]

        try:
            query_db_many(
                """
      INSERT INTO menu_items (
        item_key,
        item_name,
        item_type,
        item_category,
        tray_price_half,
        tray_price_full,
        is_active
      )
      VALUES (
        %(item_key)s,
        %(item_name)s,
        %(item_type)s,
        %(item_category)s,
        %(tray_price_half)s,
        %(tray_price_full)s,
        %(is_active)s
      )
      ON DUPLICATE KEY UPDATE
        item_key = VALUES(item_key),
        item_type = VALUES(item_type),
        item_category = VALUES(item_category),
        tray_price_half = VALUES(tray_price_half),
        tray_price_full = VALUES(tray_price_full),
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP;
      """,
                item_rows,
            )
        except Exception as exc:
            error_text = str(exc).lower()
            if "unknown column" not in error_text:
                raise
            query_db_many(
                """
      INSERT INTO menu_items (item_key, item_name, is_active)
      VALUES (%(item_key)s, %(item_name)s, %(is_active)s)
      ON DUPLICATE KEY UPDATE
        item_key = VALUES(item_key),
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP;
      """,
                item_rows,
            )

        items = query_db("SELECT id, item_name FROM menu_items;")
        item_ids = {row["item_name"]: row["id"] for row in items}
        option_group_ids = {}

        option_group_item_rows = []
        for idx, (option_key, option_group) in enumerate(menu_options.items(), start=1):
            group_id = query_db(
                """
        INSERT INTO menu_option_groups (option_key, option_id, category, title, display_order, is_active)
        VALUES (%(option_key)s, %(option_id)s, %(category)s, %(title)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          option_id = VALUES(option_id),
          category = VALUES(category),
          title = VALUES(title),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
                {
                    "option_key": option_key,
                    "option_id": option_group.get("id"),
                    "category": option_group.get("category"),
                    "title": option_group.get("title"),
                    "display_order": idx,
                },
                fetch="none",
            )
            if not group_id:
                continue
            option_group_ids[option_key] = group_id
            for item_order, item_name in enumerate(option_group.get("items", []), start=1):
                item_id = item_ids.get(item_name)
                if item_id is None:
                    continue
                option_group_item_rows.append({"group_id": group_id, "item_id": item_id, "display_order": item_order})

        query_db_many(
            """
      INSERT INTO menu_option_group_items (group_id, item_id, display_order, is_active)
      VALUES (%(group_id)s, %(item_id)s, %(display_order)s, 1)
      ON DUPLICATE KEY UPDATE
        display_order = VALUES(display_order),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP;
      """,
            option_group_item_rows,
        )

        formal_detail_rows = []
        formal_constraint_rows = []
        for idx, option in enumerate(formal_plan_options, start=1):
            normalized_option_price = cls._normalize_price_fields(
                option.get("price"),
                option.get("priceMeta") or option.get("price_meta"),
            )
            plan_id = query_db(
                """
        INSERT INTO formal_plan_options (
          plan_key,
          option_level,
          title,
          price,
          price_amount_min,
          price_amount_max,
          price_currency,
          price_unit,
          display_order,
          is_active
        )
        VALUES (
          %(plan_key)s,
          %(option_level)s,
          %(title)s,
          %(price)s,
          %(price_amount_min)s,
          %(price_amount_max)s,
          %(price_currency)s,
          %(price_unit)s,
          %(display_order)s,
          1
        )
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          option_level = VALUES(option_level),
          title = VALUES(title),
          price = VALUES(price),
          price_amount_min = VALUES(price_amount_min),
          price_amount_max = VALUES(price_amount_max),
          price_currency = VALUES(price_currency),
          price_unit = VALUES(price_unit),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
                {
                    "plan_key": option.get("id"),
                    "option_level": option.get("level"),
                    "title": option.get("title"),
                    "price": normalized_option_price["price"],
                    "price_amount_min": normalized_option_price["price_amount_min"],
                    "price_amount_max": normalized_option_price["price_amount_max"],
                    "price_currency": normalized_option_price["price_currency"],
                    "price_unit": normalized_option_price["price_unit"],
                    "display_order": idx,
                },
                fetch="none",
            )
            if not plan_id:
                continue

            for detail_order, detail_text in enumerate(option.get("details", []), start=1):
                formal_detail_rows.append(
                    {"plan_option_id": plan_id, "detail_text": detail_text, "display_order": detail_order}
                )

            for constraint_key, limits in option.get("constraints", {}).items():
                formal_constraint_rows.append(
                    {
                        "plan_option_id": plan_id,
                        "constraint_key": constraint_key,
                        "min_select": limits.get("min", 0),
                        "max_select": limits.get("max", 0),
                    }
                )

        query_db_many(
            """
      INSERT INTO formal_plan_option_details (plan_option_id, detail_text, display_order, is_active)
      VALUES (%(plan_option_id)s, %(detail_text)s, %(display_order)s, 1)
      ON DUPLICATE KEY UPDATE
        detail_text = VALUES(detail_text),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP;
      """,
            formal_detail_rows,
        )
        query_db_many(
            """
      INSERT INTO formal_plan_option_constraints (plan_option_id, constraint_key, min_select, max_select, is_active)
      VALUES (%(plan_option_id)s, %(constraint_key)s, %(min_select)s, %(max_select)s, 1)
      ON DUPLICATE KEY UPDATE
        min_select = VALUES(min_select),
        max_select = VALUES(max_select),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP;
      """,
            formal_constraint_rows,
        )

        for catalog_order, (catalog_key, catalog_data) in enumerate(menu.items(), start=1):
            catalog_id = query_db(
                """
        INSERT INTO menu_catalogs (catalog_key, page_title, subtitle, display_order, is_active)
        VALUES (%(catalog_key)s, %(page_title)s, %(subtitle)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          page_title = VALUES(page_title),
          subtitle = VALUES(subtitle),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
                {
                    "catalog_key": catalog_key,
                    "page_title": catalog_data.get("pageTitle"),
                    "subtitle": catalog_data.get("subtitle"),
                    "display_order": catalog_order,
                },
                fetch="none",
            )
            if not catalog_id:
                continue

            for block_order, block in enumerate(catalog_data.get("introBlocks", []), start=1):
                block_id = query_db(
                    """
          INSERT INTO menu_intro_blocks (catalog_id, title, display_order, is_active)
          VALUES (%(catalog_id)s, %(title)s, %(display_order)s, 1)
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            title = VALUES(title),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                    {"catalog_id": catalog_id, "title": block.get("title"), "display_order": block_order},
                    fetch="none",
                )
                if not block_id:
                    continue
                for bullet_order, bullet in enumerate(block.get("bullets", []), start=1):
                    query_db(
                        """
            INSERT INTO menu_intro_bullets (intro_block_id, bullet_text, display_order, is_active)
            VALUES (%(intro_block_id)s, %(bullet_text)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              bullet_text = VALUES(bullet_text),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {"intro_block_id": block_id, "bullet_text": bullet, "display_order": bullet_order},
                        fetch="none",
                    )

            for section_order, section in enumerate(catalog_data.get("sections", []), start=1):
                normalized_section_price = cls._normalize_price_fields(
                    section.get("price"),
                    section.get("priceMeta") or section.get("price_meta"),
                )
                section_id = query_db(
                    """
          INSERT INTO menu_sections (
            catalog_id,
            section_key,
            section_type,
            title,
            description,
            price,
            price_amount_min,
            price_amount_max,
            price_currency,
            price_unit,
            category,
            course_type,
            display_order,
            is_active
          )
          VALUES (
            %(catalog_id)s,
            %(section_key)s,
            %(section_type)s,
            %(title)s,
            %(description)s,
            %(price)s,
            %(price_amount_min)s,
            %(price_amount_max)s,
            %(price_currency)s,
            %(price_unit)s,
            %(category)s,
            %(course_type)s,
            %(display_order)s,
            1
          )
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            section_type = VALUES(section_type),
            title = VALUES(title),
            description = VALUES(description),
            price = VALUES(price),
            price_amount_min = VALUES(price_amount_min),
            price_amount_max = VALUES(price_amount_max),
            price_currency = VALUES(price_currency),
            price_unit = VALUES(price_unit),
            category = VALUES(category),
            course_type = VALUES(course_type),
            display_order = VALUES(display_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
                    {
                        "catalog_id": catalog_id,
                        "section_key": section.get("sectionId"),
                        "section_type": section.get("type"),
                        "title": section.get("title"),
                        "description": section.get("description"),
                        "price": normalized_section_price["price"],
                        "price_amount_min": normalized_section_price["price_amount_min"],
                        "price_amount_max": normalized_section_price["price_amount_max"],
                        "price_currency": normalized_section_price["price_currency"],
                        "price_unit": normalized_section_price["price_unit"],
                        "category": section.get("category"),
                        "course_type": section.get("courseType"),
                        "display_order": section_order,
                    },
                    fetch="none",
                )
                if not section_id:
                    continue

                for constraint_key, limits in section.get("constraints", {}).items():
                    if isinstance(limits, int):
                        min_select = 0
                        max_select = limits
                    elif isinstance(limits, dict):
                        min_select = limits.get("min", 0)
                        max_select = limits.get("max", 0)
                    else:
                        continue

                    query_db(
                        """
            INSERT INTO menu_section_constraints (section_id, constraint_key, min_select, max_select, is_active)
            VALUES (%(section_id)s, %(constraint_key)s, %(min_select)s, %(max_select)s, 1)
            ON DUPLICATE KEY UPDATE
              min_select = VALUES(min_select),
              max_select = VALUES(max_select),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {
                            "section_id": section_id,
                            "constraint_key": constraint_key,
                            "min_select": min_select,
                            "max_select": max_select,
                        },
                        fetch="none",
                    )

                for col_order, col_label in enumerate(section.get("columns", []), start=1):
                    query_db(
                        """
            INSERT INTO menu_section_columns (section_id, column_label, display_order, is_active)
            VALUES (%(section_id)s, %(column_label)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              column_label = VALUES(column_label),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {"section_id": section_id, "column_label": col_label, "display_order": col_order},
                        fetch="none",
                    )

                for row_order, row_values in enumerate(section.get("rows", []), start=1):
                    if not row_values:
                        continue
                    item_name = row_values[0]
                    item_id = item_ids.get(item_name)
                    if item_id is None:
                        continue
                    value_1 = cls._normalize_tray_price_value(row_values[1]) if len(row_values) > 1 else None
                    value_2 = cls._normalize_tray_price_value(row_values[2]) if len(row_values) > 2 else None

                    if str(catalog_key).strip().lower() == "togo":
                        item_record = item_records.get(item_name, {})
                        value_1 = cls._normalize_tray_price_value(item_record.get("tray_price_half")) or value_1
                        value_2 = cls._normalize_tray_price_value(item_record.get("tray_price_full")) or value_2

                    query_db(
                        """
            INSERT INTO menu_section_rows (section_id, item_id, value_1, value_2, display_order, is_active)
            VALUES (%(section_id)s, %(item_id)s, %(value_1)s, %(value_2)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              value_1 = VALUES(value_1),
              value_2 = VALUES(value_2),
              display_order = VALUES(display_order),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {
                            "section_id": section_id,
                            "item_id": item_id,
                            "value_1": value_1,
                            "value_2": value_2,
                            "display_order": row_order,
                        },
                        fetch="none",
                    )

                for include_order, include_key in enumerate(section.get("includeKeys", []), start=1):
                    group_id = option_group_ids.get(include_key)
                    if group_id is None:
                        group_row = query_db(
                            "SELECT id FROM menu_option_groups WHERE option_key = %(option_key)s;",
                            {"option_key": include_key},
                            fetch="one",
                        )
                        group_id = group_row.get("id") if group_row else None
                        if group_id is not None:
                            option_group_ids[include_key] = group_id
                    if group_id is None:
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
                        {"section_id": section_id, "group_id": group_id, "display_order": include_order},
                        fetch="none",
                    )

                for tier_order, tier in enumerate(section.get("tiers", []), start=1):
                    normalized_tier_price = cls._normalize_price_fields(
                        tier.get("price"),
                        tier.get("priceMeta") or tier.get("price_meta"),
                    )
                    tier_id = query_db(
                        """
            INSERT INTO menu_section_tiers (
              section_id,
              tier_title,
              price,
              price_amount_min,
              price_amount_max,
              price_currency,
              price_unit,
              display_order,
              is_active
            )
            VALUES (
              %(section_id)s,
              %(tier_title)s,
              %(price)s,
              %(price_amount_min)s,
              %(price_amount_max)s,
              %(price_currency)s,
              %(price_unit)s,
              %(display_order)s,
              1
            )
            ON DUPLICATE KEY UPDATE
              id = LAST_INSERT_ID(id),
              tier_title = VALUES(tier_title),
              price = VALUES(price),
              price_amount_min = VALUES(price_amount_min),
              price_amount_max = VALUES(price_amount_max),
              price_currency = VALUES(price_currency),
              price_unit = VALUES(price_unit),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
                        {
                            "section_id": section_id,
                            "tier_title": tier.get("tierTitle"),
                            "price": normalized_tier_price["price"],
                            "price_amount_min": normalized_tier_price["price_amount_min"],
                            "price_amount_max": normalized_tier_price["price_amount_max"],
                            "price_currency": normalized_tier_price["price_currency"],
                            "price_unit": normalized_tier_price["price_unit"],
                            "display_order": tier_order,
                        },
                        fetch="none",
                    )
                    if not tier_id:
                        continue

                    for constraint_key, constraint_value in tier.get("constraints", {}).items():
                        min_select = None
                        max_select = None

                        if isinstance(constraint_value, dict):
                            min_value = constraint_value.get("min")
                            max_value = constraint_value.get("max")
                            if isinstance(min_value, int):
                                min_select = min_value
                            if isinstance(max_value, int):
                                max_select = max_value
                        elif isinstance(constraint_value, int):
                            min_select = constraint_value
                            max_select = constraint_value

                        if min_select is None and max_select is None:
                            continue
                        if min_select is None:
                            min_select = int(max_select)
                        if max_select is None:
                            max_select = int(min_select)

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
                        )

                    for bullet_order, bullet in enumerate(tier.get("bullets", []), start=1):
                        item_id = item_ids.get(bullet)
                        query_db(
                            """
              INSERT INTO menu_section_tier_bullets (tier_id, item_id, bullet_text, display_order, is_active)
              VALUES (%(tier_id)s, %(item_id)s, %(bullet_text)s, %(display_order)s, 1)
              ON DUPLICATE KEY UPDATE
                item_id = VALUES(item_id),
                bullet_text = VALUES(bullet_text),
                is_active = 1,
                updated_at = CURRENT_TIMESTAMP;
              """,
                            {
                                "tier_id": tier_id,
                                "item_id": item_id,
                                "bullet_text": None if item_id is not None else bullet,
                                "display_order": bullet_order,
                            },
                            fetch="none",
                        )

    @classmethod
    def _normalize_non_formal_admin_item(cls, raw_item, index):
        if not isinstance(raw_item, dict):
            return None, f"items[{index}] must be an object."

        item_name = str(raw_item.get("name") or raw_item.get("item_name") or raw_item.get("itemName") or "").strip()
        if not item_name:
            return None, f"items[{index}].name is required."

        item_type = cls._normalize_classification_value(
            raw_item.get("item_type") or raw_item.get("itemType") or raw_item.get("type"),
            cls.ITEM_FALLBACK_TYPE,
        )
        item_category = cls._normalize_classification_value(
            raw_item.get("item_category") or raw_item.get("itemCategory") or raw_item.get("category"),
            cls.ITEM_FALLBACK_CATEGORY,
        )

        tray_prices = raw_item.get("tray_prices") or raw_item.get("trayPrices") or {}
        if not isinstance(tray_prices, dict):
            tray_prices = {}

        return (
            {
                "item_name": item_name,
                "item_key": cls._slug(item_name),
                "item_type": item_type,
                "item_category": item_category,
                "is_active": cls._coerce_active_flag(raw_item.get("is_active", raw_item.get("active")), default=True),
                "tray_price_half": cls._normalize_tray_price_value(
                    tray_prices.get("half")
                    if "half" in tray_prices
                    else tray_prices.get("half_tray", raw_item.get("tray_price_half"))
                ),
                "tray_price_full": cls._normalize_tray_price_value(
                    tray_prices.get("full")
                    if "full" in tray_prices
                    else tray_prices.get("full_tray", raw_item.get("tray_price_full"))
                ),
            },
            None,
        )

    @classmethod
    def _match_score(cls, candidate, target):
        normalized_candidate = cls._normalize_classification_value(candidate, "")
        normalized_target = cls._normalize_classification_value(target, "")
        if not normalized_candidate or not normalized_target:
            return 0
        if normalized_candidate == normalized_target:
            return 100
        if normalized_target in normalized_candidate or normalized_candidate in normalized_target:
            return 50
        return 0

    @staticmethod
    def _category_candidates(item_category):
        category = str(item_category or "").strip().lower()
        candidates = {category}
        if category in {"sides", "salads"}:
            candidates.add("sides_salads")
        if category == "sides_salads":
            candidates.update({"sides", "salads"})
        return {value for value in candidates if value}

    @classmethod
    def _ensure_default_option_group_link(cls, item_id, item_type, item_category):
        option_groups = query_db(
            """
      SELECT id, option_key, option_id, category, title, display_order
      FROM menu_option_groups
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC;
      """
        )
        if not option_groups:
            return

        category_candidates = cls._category_candidates(item_category)
        if category_candidates:
            option_groups = [
                row
                for row in option_groups
                if cls._normalize_classification_value(row.get("category"), "") in category_candidates
            ]
        if not option_groups:
            return

        def _score(row):
            return max(
                cls._match_score(row.get("option_key"), item_type),
                cls._match_score(row.get("option_id"), item_type),
                cls._match_score(row.get("title"), item_type),
            )

        option_groups.sort(key=lambda row: (_score(row) * -1, row.get("display_order", 0), row.get("id", 0)))
        selected_group = option_groups[0]

        existing = query_db(
            """
      SELECT display_order
      FROM menu_option_group_items
      WHERE group_id = %(group_id)s
        AND item_id = %(item_id)s
      LIMIT 1;
      """,
            {"group_id": selected_group["id"], "item_id": item_id},
            fetch="one",
        )
        if existing:
            display_order = existing.get("display_order") or 0
        else:
            max_row = query_db(
                """
        SELECT COALESCE(MAX(display_order), 0) AS max_order
        FROM menu_option_group_items
        WHERE group_id = %(group_id)s;
        """,
                {"group_id": selected_group["id"]},
                fetch="one",
            )
            display_order = int((max_row or {}).get("max_order") or 0) + 1

        query_db(
            """
      INSERT INTO menu_option_group_items (group_id, item_id, display_order, is_active)
      VALUES (%(group_id)s, %(item_id)s, %(display_order)s, 1)
      ON DUPLICATE KEY UPDATE
        display_order = VALUES(display_order),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP;
      """,
            {"group_id": selected_group["id"], "item_id": item_id, "display_order": display_order},
            fetch="none",
        )

    @classmethod
    def _ensure_default_togo_row_link(cls, item_id, item_type, item_category, tray_price_half, tray_price_full):
        sections = query_db(
            """
      SELECT s.id, s.section_key, s.category, s.title, s.display_order
      FROM menu_sections s
      JOIN menu_catalogs c
        ON c.id = s.catalog_id AND c.is_active = 1
      WHERE s.is_active = 1
        AND c.catalog_key = 'togo'
      ORDER BY s.display_order ASC, s.id ASC;
      """
        )
        if not sections:
            return

        category_candidates = cls._category_candidates(item_category)
        if category_candidates:
            sections = [
                row
                for row in sections
                if cls._normalize_classification_value(row.get("category"), "") in category_candidates
            ]
        if not sections:
            return

        def _score(row):
            return max(
                cls._match_score(row.get("section_key"), item_type),
                cls._match_score(row.get("title"), item_type),
            )

        sections.sort(key=lambda row: (_score(row) * -1, row.get("display_order", 0), row.get("id", 0)))
        selected_section = sections[0]

        existing = query_db(
            """
      SELECT display_order
      FROM menu_section_rows
      WHERE section_id = %(section_id)s
        AND item_id = %(item_id)s
      LIMIT 1;
      """,
            {"section_id": selected_section["id"], "item_id": item_id},
            fetch="one",
        )
        if existing:
            display_order = existing.get("display_order") or 0
        else:
            max_row = query_db(
                """
        SELECT COALESCE(MAX(display_order), 0) AS max_order
        FROM menu_section_rows
        WHERE section_id = %(section_id)s;
        """,
                {"section_id": selected_section["id"]},
                fetch="one",
            )
            display_order = int((max_row or {}).get("max_order") or 0) + 1

        query_db(
            """
      INSERT INTO menu_section_rows (section_id, item_id, value_1, value_2, display_order, is_active)
      VALUES (%(section_id)s, %(item_id)s, %(value_1)s, %(value_2)s, %(display_order)s, 1)
      ON DUPLICATE KEY UPDATE
        value_1 = VALUES(value_1),
        value_2 = VALUES(value_2),
        display_order = VALUES(display_order),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP;
      """,
            {
                "section_id": selected_section["id"],
                "item_id": item_id,
                "value_1": tray_price_half,
                "value_2": tray_price_full,
                "display_order": display_order,
            },
            fetch="none",
        )

    @classmethod
    def upsert_non_formal_catalog_items(cls, payload):
        raw_items = payload
        if isinstance(payload, dict):
            raw_items = payload.get("items") if "items" in payload else [payload]

        if not isinstance(raw_items, list) or not raw_items:
            return {"errors": ["items is required and must contain at least one item payload."]}, 400

        normalized_items = []
        errors = []
        for index, raw_item in enumerate(raw_items):
            normalized_item, error = cls._normalize_non_formal_admin_item(raw_item, index)
            if error:
                errors.append(error)
                continue
            normalized_items.append(normalized_item)

        if errors:
            return {"errors": errors}, 400

        results = []
        for item in normalized_items:
            item_id = None
            try:
                item_id = query_db(
                    """
          INSERT INTO menu_items (
            item_key,
            item_name,
            item_type,
            item_category,
            tray_price_half,
            tray_price_full,
            is_active
          )
          VALUES (
            %(item_key)s,
            %(item_name)s,
            %(item_type)s,
            %(item_category)s,
            %(tray_price_half)s,
            %(tray_price_full)s,
            %(is_active)s
          )
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            item_key = VALUES(item_key),
            item_type = VALUES(item_type),
            item_category = VALUES(item_category),
            tray_price_half = VALUES(tray_price_half),
            tray_price_full = VALUES(tray_price_full),
            is_active = VALUES(is_active),
            updated_at = CURRENT_TIMESTAMP;
          """,
                    item,
                    fetch="none",
                )
            except Exception as exc:
                error_text = str(exc).lower()
                if "unknown column" not in error_text:
                    raise
                item_id = query_db(
                    """
          INSERT INTO menu_items (item_key, item_name, is_active)
          VALUES (%(item_key)s, %(item_name)s, %(is_active)s)
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            item_key = VALUES(item_key),
            is_active = VALUES(is_active),
            updated_at = CURRENT_TIMESTAMP;
          """,
                    item,
                    fetch="none",
                )

            if not item_id:
                existing = query_db(
                    "SELECT id FROM menu_items WHERE item_name = %(item_name)s LIMIT 1;",
                    {"item_name": item["item_name"]},
                    fetch="one",
                )
                item_id = (existing or {}).get("id")

            if not item_id:
                continue

            if item["is_active"] == 1:
                cls._ensure_default_option_group_link(
                    item_id=item_id,
                    item_type=item["item_type"],
                    item_category=item["item_category"],
                )
                cls._ensure_default_togo_row_link(
                    item_id=item_id,
                    item_type=item["item_type"],
                    item_category=item["item_category"],
                    tray_price_half=item["tray_price_half"],
                    tray_price_full=item["tray_price_full"],
                )

            item_row = query_db(
                """
        SELECT
          id AS item_id,
          item_name,
          item_type,
          item_category,
          tray_price_half,
          tray_price_full,
          is_active AS item_active
        FROM menu_items
        WHERE id = %(item_id)s
        LIMIT 1;
        """,
                {"item_id": item_id},
                fetch="one",
            )
            if item_row:
                results.append(cls._build_item_reference_payload(item_row))

        cls.clear_cached_config_payload()
        refreshed_payload = cls.get_config_payload()
        if refreshed_payload:
            cls.upsert_cached_config_payload(refreshed_payload)

        return {"ok": True, "items": results, "updated_count": len(results)}, 200
