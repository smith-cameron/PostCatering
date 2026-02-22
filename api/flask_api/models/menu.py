import numbers
import re


class Menu:
    PRICE_TOKEN_REGEX = re.compile(r"\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\+?")

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
    def get_effective_service_constraints(cls, service_selection):
        if not isinstance(service_selection, dict):
            return {}

        plan_id = str(service_selection.get("id") or "").strip()
        level = str(service_selection.get("level") or "").strip().lower()
        section_key = str(service_selection.get("sectionId") or "").strip()
        title = str(service_selection.get("title") or "").strip()

        if plan_id == "formal:2-course":
            return {"starter": {"min": 1, "max": 1}, "entree": {"min": 1, "max": 1}}
        if plan_id == "formal:3-course":
            return {
                "passed": {"min": 2, "max": 2},
                "starter": {"min": 1, "max": 1},
                "entree": {"min": 1, "max": 2},
            }

        normalized_title = title.lower()
        if section_key == "community_buffet_tiers" and level == "tier":
            if "tier 1" in normalized_title:
                return {
                    "entree": {"min": 2, "max": 2},
                    "sides": {"min": 2, "max": 2},
                    "salads": {"min": 1, "max": 1},
                }
            if "tier 2" in normalized_title:
                return {
                    "entree": {"min": 2, "max": 3},
                    "sides": {"min": 3, "max": 3},
                    "salads": {"min": 2, "max": 2},
                }

        if section_key == "community_homestyle" and level == "package":
            return {"entree": {"min": 1, "max": 1}, "sides": {"min": 2, "max": 2}}
        if section_key == "community_taco_bar" and level == "package":
            return {"entree": {"min": 1, "max": 1}}

        return cls._normalize_payload_constraints(service_selection.get("constraints"))
