def validate_required_string(value, field_name):
  if not isinstance(value, str) or not value.strip():
    return f"{field_name} is required."
  return None


def validate_guest_count(value):
  if value == "__invalid__":
    return "guest_count must be a number."
  if value is None:
    return None
  if isinstance(value, int) and value >= 0:
    return None
  return "guest_count must be a non-negative number."


def validate_email_format(value):
  if not isinstance(value, str):
    return "email is invalid."
  value = value.strip()
  if not value:
    return "email is required."
  if "@" not in value or value.startswith("@") or value.endswith("@"):
    return "email is invalid."
  return None


def validate_inquiry_payload(inquiry):
  errors = []

  full_name_error = validate_required_string(inquiry.full_name, "full_name")
  if full_name_error:
    errors.append(full_name_error)

  email_error = validate_email_format(inquiry.email)
  if email_error:
    errors.append(email_error)

  message_error = validate_required_string(inquiry.message, "message")
  if message_error:
    errors.append(message_error)

  guest_count_error = validate_guest_count(inquiry.guest_count)
  if guest_count_error:
    errors.append(guest_count_error)

  return errors
