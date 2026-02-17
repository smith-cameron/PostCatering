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
    return None
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

  return errors
