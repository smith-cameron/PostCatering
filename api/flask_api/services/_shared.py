from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def to_bool(value, default=None):
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


def to_int(value, default=None, minimum=None, maximum=None):
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        return default
    if minimum is not None and normalized < minimum:
        normalized = minimum
    if maximum is not None and normalized > maximum:
        normalized = maximum
    return normalized


def to_iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else None


def serialize_decimal_string(value, allow_blank=False):
    if value is None or (allow_blank and value == ""):
        return None
    try:
        normalized = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None
    return format(normalized, "f")


def normalize_id_list(values, minimum=1):
    normalized = [to_int(value, minimum=minimum) for value in values or []]
    return [value for value in normalized if value]


def build_in_clause_payload(values, token_prefix="id"):
    payload = {}
    tokens = []
    for index, value in enumerate(values):
        token = f"{token_prefix}_{index}"
        payload[token] = value
        tokens.append(f"%({token})s")
    return payload, ", ".join(tokens)


def merge_requested_ids(requested_ids, current_ids):
    current_values = list(current_ids or [])
    current_set = set(current_values)
    ordered_ids = []
    seen = set()
    for value in list(requested_ids or []) + current_values:
        if value in current_set and value not in seen:
            ordered_ids.append(value)
            seen.add(value)
    return ordered_ids
