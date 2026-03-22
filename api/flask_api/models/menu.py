import numbers
import re


class Menu:
    PRICE_TOKEN_REGEX = re.compile(r"\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\+?")
    LEGACY_SERVICE_PLAN_CONSTRAINTS = {
        "formal:2-course": {
            "starter": {"min": 1, "max": 1},
            "entree": {"min": 1, "max": 1},
        },
        "formal:3-course": {
            "passed": {"min": 2, "max": 2},
            "starter": {"min": 1, "max": 1},
            "entree": {"min": 1, "max": 2},
        },
        "catering:taco_bar": {
            "signature_protein": {"min": 1, "max": 1},
        },
        "catering:homestyle": {
            "entree_signature_protein": {"min": 1, "max": 1},
            "sides_salads": {"min": 2, "max": 2},
        },
        "catering:buffet_tier_1": {
            "entree_signature_protein": {"min": 2, "max": 2},
            "sides_salads": {"min": 3, "max": 3},
        },
        "catering:buffet_tier_2": {
            "entree_signature_protein": {"min": 2, "max": 3},
            "sides_salads": {"min": 5, "max": 5},
        },
    }
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
    CATERING_BUFFET_SECTION_KEYS = (
        "catering_packages",
        "catering_buffet_packages",
    )

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

    @classmethod
    def _get_service_selection_catalog(cls, service_selection):
        if not isinstance(service_selection, dict):
            return ""
        plan_id = str(service_selection.get("id") or "").strip().lower()
        section_key = str(service_selection.get("sectionId") or "").strip().lower()
        if plan_id.startswith("formal:") or section_key.startswith("formal"):
            return "formal"
        if plan_id.startswith("catering:") or section_key.startswith("catering"):
            return "catering"
        return ""

    @classmethod
    def _canonicalize_payload_constraint_key(cls, key, service_selection=None):
        normalized_key = re.sub(r"[^a-z0-9]+", "_", str(key or "").strip().lower()).strip("_")
        if not normalized_key:
            return ""
        catalog_key = cls._get_service_selection_catalog(service_selection)
        if catalog_key == "formal":
            return cls.FORMAL_CONSTRAINT_KEY_ALIASES.get(normalized_key, normalized_key)
        if catalog_key == "catering":
            return cls.CATERING_CONSTRAINT_KEY_ALIASES.get(normalized_key, normalized_key)
        return normalized_key

    @classmethod
    def _normalize_payload_constraints(cls, constraints, service_selection=None):
        if not isinstance(constraints, dict):
            return {}

        normalized = {}
        for key, value in constraints.items():
            normalized_key = cls._canonicalize_payload_constraint_key(key, service_selection=service_selection)
            if not normalized_key:
                continue
            if isinstance(value, int):
                min_value = value
                max_value = value
            elif isinstance(value, dict):
                min_value = value.get("min")
                max_value = value.get("max")
                if not isinstance(min_value, int) and not isinstance(max_value, int):
                    continue
            else:
                continue

            min_total = int(min_value or 0)
            max_total = int(max_value or 0)
            existing = normalized.get(normalized_key)
            if existing:
                existing["min"] = int(existing.get("min", 0)) + min_total
                existing["max"] = int(existing.get("max", 0)) + max_total
            else:
                normalized[normalized_key] = {
                    "min": min_total,
                    "max": max_total,
                }

        return normalized

    @classmethod
    def get_effective_service_constraints(cls, service_selection):
        if not isinstance(service_selection, dict):
            return {}

        payload_constraints = cls._normalize_payload_constraints(
            service_selection.get("constraints"),
            service_selection=service_selection,
        )
        if payload_constraints:
            return payload_constraints

        plan_id = str(service_selection.get("id") or "").strip()
        section_key = str(service_selection.get("sectionId") or "").strip()
        title = str(service_selection.get("title") or "").strip()
        legacy_constraints = cls.LEGACY_SERVICE_PLAN_CONSTRAINTS.get(plan_id)
        if legacy_constraints:
            return {key: dict(value) for key, value in legacy_constraints.items()}

        normalized_title = title.lower()
        if "hearty homestyle" in normalized_title:
            return {"entree_signature_protein": {"min": 1, "max": 1}, "sides_salads": {"min": 2, "max": 2}}
        if "taco bar" in normalized_title:
            return {"signature_protein": {"min": 1, "max": 1}}
        if section_key in cls.CATERING_BUFFET_SECTION_KEYS:
            if "tier 1" in normalized_title:
                return {
                    "entree_signature_protein": {"min": 2, "max": 2},
                    "sides_salads": {"min": 3, "max": 3},
                }
            if "tier 2" in normalized_title:
                return {
                    "entree_signature_protein": {"min": 2, "max": 3},
                    "sides_salads": {"min": 5, "max": 5},
                }

        return cls._normalize_payload_constraints(
            service_selection.get("constraints"),
            service_selection=service_selection,
        )
