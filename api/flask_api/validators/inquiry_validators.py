import re
from datetime import date, timedelta

from flask_api.models.menu import Menu

EMAIL_REGEX = re.compile(r"^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$", re.IGNORECASE)
BUDGET_SPLIT_REGEX = re.compile(r"\s*(?:-|\bto\b)\s*", re.IGNORECASE)
BUDGET_PART_REGEX = re.compile(r"^\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\s*$")


def validate_required_string(value, field_name):
  if not isinstance(value, str) or not value.strip():
    return f"{field_name} is required."
  return None


def validate_guest_count(value):
  if value == "__invalid__":
    return "guest_count must be a number."
  if value is None:
    return "guest_count is required."
  if isinstance(value, int) and value >= 1:
    return None
  return "guest_count must be at least 1."


def normalize_email(value):
  if not isinstance(value, str):
    return value
  return value.strip().lower()


def validate_email_format(value):
  if value in (None, ""):
    return "email is required."
  if not isinstance(value, str):
    return "email is invalid."
  value = normalize_email(value)
  if not value or not _is_valid_email(value):
    return "email is invalid."
  return None


def validate_event_date(value):
  if value in (None, ""):
    return "event_date is required."
  if not isinstance(value, str):
    return "event_date is invalid."
  try:
    parsed_date = date.fromisoformat(value.strip())
  except ValueError:
    return "event_date must be in YYYY-MM-DD format."
  min_event_date = date.today() + timedelta(days=7)
  if parsed_date < min_event_date:
    return "event_date must be at least one week in the future."
  return None


def normalize_phone(value):
  if value in (None, ""):
    return None
  if not isinstance(value, str):
    return value
  value = value.strip()
  if not value:
    return None
  normalized = _normalize_us_phone(value)
  return normalized or value


def validate_phone(value):
  if value in (None, ""):
    return "phone is required."
  if not isinstance(value, str):
    return "phone is invalid."
  value = value.strip()
  if not value:
    return "phone is required."
  if re.search(r"[A-Za-z]", value):
    return "phone must not contain letters."
  if _normalize_us_phone(value):
    return None
  return "phone must be a valid US phone number."


def normalize_budget(value):
  if value in (None, ""):
    return None
  normalized = _parse_budget_to_canonical(value)
  if normalized:
    return normalized
  if isinstance(value, str):
    value = value.strip()
    return value or None
  return value


def validate_budget(value):
  if value in (None, ""):
    return None
  if _parse_budget_to_canonical(value):
    return None
  return "budget must be a valid amount or range (e.g. $2,500 or $2,500-$5,000)."


def normalize_contact_fields(inquiry):
  inquiry.email = normalize_email(inquiry.email)
  inquiry.phone = normalize_phone(inquiry.phone)
  inquiry.budget = normalize_budget(inquiry.budget)


def validate_service_interest(value):
  return validate_required_string(value, "service_interest")


def validate_desired_menu_items(value):
  if not isinstance(value, list) or not value:
    return "desired_menu_items is required."
  for item in value:
    if isinstance(item, dict):
      name = str(item.get("name", "")).strip()
      if not name:
        return "desired_menu_items contains an invalid item."
    elif isinstance(item, str):
      if not item.strip():
        return "desired_menu_items contains an invalid item."
    else:
      return "desired_menu_items contains an invalid item."
  return None


def _get_effective_service_constraints(service_selection):
  return Menu.get_effective_service_constraints(service_selection)


def validate_service_selection_constraints(service_selection, desired_menu_items):
  constraints = _get_effective_service_constraints(service_selection)
  if not constraints:
    return []

  category_counts = {}
  for item in desired_menu_items:
    if not isinstance(item, dict):
      continue
    category = str(item.get("category") or "other")
    category_counts[category] = category_counts.get(category, 0) + 1

  errors = []
  for category, limits in constraints.items():
    if category == "sides_salads":
      selected_count = category_counts.get("sides", 0) + category_counts.get("salads", 0)
    else:
      selected_count = category_counts.get(category, 0)
    min_select = limits.get("min", 0)
    max_select = limits.get("max", 0)
    label = category.replace("_", "/")

    if min_select and selected_count < min_select:
      errors.append(f"Please select at least {min_select} {label}.")
    if max_select and selected_count > max_select:
      errors.append(f"For this selection, you can choose up to {max_select} {label}.")

  return errors


def validate_inquiry_payload(inquiry):
  normalize_contact_fields(inquiry)
  errors = []

  full_name_error = validate_required_string(inquiry.full_name, "full_name")
  if full_name_error:
    errors.append(full_name_error)

  email_error = validate_email_format(inquiry.email)
  if email_error:
    errors.append(email_error)

  guest_count_error = validate_guest_count(inquiry.guest_count)
  if guest_count_error:
    errors.append(guest_count_error)

  event_date_error = validate_event_date(inquiry.event_date)
  if event_date_error:
    errors.append(event_date_error)

  phone_error = validate_phone(inquiry.phone)
  if phone_error:
    errors.append(phone_error)

  budget_error = validate_budget(inquiry.budget)
  if budget_error:
    errors.append(budget_error)

  service_interest_error = validate_service_interest(inquiry.service_interest)
  if service_interest_error:
    errors.append(service_interest_error)

  desired_menu_items_error = validate_desired_menu_items(inquiry.desired_menu_items)
  if desired_menu_items_error:
    errors.append(desired_menu_items_error)
  else:
    errors.extend(validate_service_selection_constraints(inquiry.service_selection, inquiry.desired_menu_items))

  return errors


def _is_valid_email(value):
  if not isinstance(value, str):
    return False
  if len(value) > 254 or " " in value or ".." in value:
    return False
  if not EMAIL_REGEX.fullmatch(value):
    return False
  local_part, domain = value.rsplit("@", 1)
  if len(local_part) > 64 or local_part.startswith(".") or local_part.endswith("."):
    return False
  labels = domain.split(".")
  if any(
    not label or len(label) > 63 or label.startswith("-") or label.endswith("-")
    for label in labels
  ):
    return False
  return True


def _normalize_us_phone(value):
  digits = re.sub(r"\D", "", value)
  if len(digits) == 11 and digits.startswith("1"):
    digits = digits[1:]
  if len(digits) != 10:
    return None

  area_code = digits[:3]
  exchange_code = digits[3:6]
  if area_code[0] in ("0", "1") or exchange_code[0] in ("0", "1"):
    return None

  return f"({area_code}) {exchange_code}-{digits[6:]}"


def _parse_budget_to_canonical(value):
  if isinstance(value, bool):
    return None

  if isinstance(value, (int, float)):
    amount = float(value)
    if amount <= 0:
      return None
    return _format_budget_amount(amount)

  if not isinstance(value, str):
    return None

  value = value.strip()
  if not value:
    return None

  parts = BUDGET_SPLIT_REGEX.split(value, maxsplit=1)
  if not parts or len(parts) > 2:
    return None

  lower_amount = _parse_budget_part(parts[0])
  if lower_amount is None:
    return None

  if len(parts) == 1:
    return _format_budget_amount(lower_amount)

  upper_amount = _parse_budget_part(parts[1])
  if upper_amount is None or upper_amount < lower_amount:
    return None

  return f"{_format_budget_amount(lower_amount)}-{_format_budget_amount(upper_amount)}"


def _parse_budget_part(part):
  match = BUDGET_PART_REGEX.fullmatch(part.strip())
  if not match:
    return None

  raw_amount = match.group(1).replace(",", "")
  suffix = (match.group(2) or "").lower()

  try:
    amount = float(raw_amount)
  except ValueError:
    return None

  if suffix == "k":
    amount *= 1000
  if amount <= 0:
    return None
  return amount


def _format_budget_amount(amount):
  if float(amount).is_integer():
    return f"${int(amount):,}"
  return f"${amount:,.2f}".rstrip("0").rstrip(".")
