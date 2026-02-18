import re
from datetime import date, timedelta


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


def validate_email_format(value):
  if not isinstance(value, str):
    return "email is invalid."
  value = value.strip()
  if not value:
    return "email is required."
  if "@" not in value or value.startswith("@") or value.endswith("@"):
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


def validate_phone(value):
  if value in (None, ""):
    return "phone is required."
  if not isinstance(value, str):
    return "phone is invalid."
  value = value.strip()
  if re.search(r"[A-Za-z]", value):
    return "phone must not contain letters."
  digits = re.sub(r"\D", "", value)
  if len(digits) == 10:
    return None
  if len(digits) == 11 and digits.startswith("1"):
    return None
  return "phone must be a valid US phone number."


def validate_budget(value):
  if value in (None, ""):
    return None
  if not isinstance(value, str):
    return "budget is invalid."
  if re.search(r"[A-Za-z]", value):
    return "budget must not contain letters."
  return None


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


def _normalize_constraint_rule(rule):
  if isinstance(rule, int):
    return {"min": 0, "max": rule}
  if isinstance(rule, dict):
    min_value = rule.get("min")
    max_value = rule.get("max")
    if isinstance(min_value, int) or isinstance(max_value, int):
      return {"min": min_value or 0, "max": max_value or 0}
  return {"min": 0, "max": 0}


def _get_effective_service_constraints(service_selection):
  if not isinstance(service_selection, dict):
    return {}

  section_id = str(service_selection.get("sectionId") or "").strip().lower()
  plan_id = str(service_selection.get("id") or "").strip().lower()
  level = str(service_selection.get("level") or "").strip().lower()
  title = str(service_selection.get("title") or "").strip().lower()
  if plan_id == "formal:3-course":
    return {
      "passed": {"min": 2, "max": 2},
      "starter": {"min": 1, "max": 1},
      "entree": {"min": 1, "max": 2},
      "sides": {"min": 0, "max": 0},
    }
  if section_id == "community_buffet_tiers" and "tier 1" in title:
    return {
      "entree": {"min": 2, "max": 2},
      "sides": {"min": 2, "max": 2},
      "salads": {"min": 1, "max": 1},
    }
  if section_id == "community_buffet_tiers" and "tier 2" in title:
    return {
      "entree": {"min": 2, "max": 3},
      "sides": {"min": 3, "max": 3},
      "salads": {"min": 2, "max": 2},
    }
  if level == "package" and "taco bar" in title:
    return {
      "entree": {"min": 1, "max": 1},
    }
  if level == "package" and "hearty homestyle" in title:
    return {
      "entree": {"min": 1, "max": 1},
      "sides": {"min": 2, "max": 2},
    }

  constraints = service_selection.get("constraints")
  if not isinstance(constraints, dict):
    return {}

  normalized = {}
  for key, rule in constraints.items():
    normalized[str(key)] = _normalize_constraint_rule(rule)
  if "sides_salads" in normalized and "sides" not in normalized and "salads" not in normalized:
    normalized["sides"] = normalized.pop("sides_salads")
  return normalized


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
