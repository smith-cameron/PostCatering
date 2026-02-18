import json

from flask_api.config.mysqlconnection import query_db
from flask_api.validators.inquiry_validators import (
  normalize_budget,
  normalize_email,
  normalize_phone,
  validate_inquiry_payload,
)


class Inquiry:
  def __init__(
    self,
    full_name,
    email,
    phone=None,
    event_type=None,
    event_date=None,
    guest_count=None,
    budget=None,
    service_interest=None,
    service_selection=None,
    desired_menu_items=None,
    message="",
    email_sent=0,
    inquiry_id=None,
  ):
    self.id = inquiry_id
    self.full_name = full_name
    self.email = email
    self.phone = phone
    self.event_type = event_type
    self.event_date = event_date
    self.guest_count = guest_count
    self.budget = budget
    self.service_interest = service_interest
    self.service_selection = service_selection or {}
    self.desired_menu_items = desired_menu_items or []
    self.message = message
    self.email_sent = email_sent

  @classmethod
  def from_payload(cls, raw_payload):
    guest_count = raw_payload.get("guest_count")
    if guest_count in ("", None):
      guest_count = None
    else:
      try:
        guest_count = int(guest_count)
      except (TypeError, ValueError):
        guest_count = "__invalid__"

    return cls(
      full_name=(raw_payload.get("full_name") or "").strip(),
      email=normalize_email(raw_payload.get("email") or ""),
      phone=normalize_phone(raw_payload.get("phone")),
      event_type=(raw_payload.get("event_type") or "").strip() or None,
      event_date=(raw_payload.get("event_date") or "").strip() or None,
      guest_count=guest_count,
      budget=normalize_budget(raw_payload.get("budget")),
      service_interest=(raw_payload.get("service_interest") or "").strip() or None,
      service_selection=raw_payload.get("service_selection") if isinstance(raw_payload.get("service_selection"), dict) else {},
      desired_menu_items=raw_payload.get("desired_menu_items") or [],
      message=(raw_payload.get("message") or "").strip(),
      email_sent=0,
    )

  def validate(self):
    return validate_inquiry_payload(self)

  def to_db_dict(self):
    return {
      "full_name": self.full_name,
      "email": self.email,
      "phone": self.phone,
      "event_type": self.event_type,
      "event_date": self.event_date,
      "guest_count": self.guest_count,
      "budget": self.budget,
      "service_interest": self.service_interest,
      "message": self.message,
      "email_sent": self.email_sent,
    }

  def _to_structured_selection_dict(self):
    service_selection = self.service_selection if isinstance(self.service_selection, dict) else {}
    desired_menu_items = self.desired_menu_items if isinstance(self.desired_menu_items, list) else []

    return {
      "service_selection_json": json.dumps(service_selection, ensure_ascii=False),
      "desired_menu_items_json": json.dumps(desired_menu_items, ensure_ascii=False),
    }

  def _save_structured_selections(self):
    if not self.id:
      return

    query = """
      INSERT INTO inquiry_selection_data (
        inquiry_id,
        service_selection_json,
        desired_menu_items_json
      )
      VALUES (
        %(inquiry_id)s,
        %(service_selection_json)s,
        %(desired_menu_items_json)s
      )
      ON DUPLICATE KEY UPDATE
        service_selection_json = VALUES(service_selection_json),
        desired_menu_items_json = VALUES(desired_menu_items_json),
        updated_at = CURRENT_TIMESTAMP;
    """
    payload = {
      "inquiry_id": self.id,
      **self._to_structured_selection_dict(),
    }
    query_db(query, payload, fetch="none")

  def save(self):
    query = """
      INSERT INTO inquiries (
        full_name,
        email,
        phone,
        event_type,
        event_date,
        guest_count,
        budget,
        service_interest,
        message,
        email_sent
      )
      VALUES (
        %(full_name)s,
        %(email)s,
        %(phone)s,
        %(event_type)s,
        %(event_date)s,
        %(guest_count)s,
        %(budget)s,
        %(service_interest)s,
        %(message)s,
        %(email_sent)s
      );
    """
    self.id = query_db(query, self.to_db_dict(), fetch="none")
    self._save_structured_selections()
    return self.id

  def update_email_sent(self, email_sent):
    if not self.id:
      return None
    query = """
      UPDATE inquiries
      SET email_sent = %(email_sent)s
      WHERE id = %(id)s;
    """
    self.email_sent = int(bool(email_sent))
    return query_db(query, {"id": self.id, "email_sent": self.email_sent}, fetch="none")
