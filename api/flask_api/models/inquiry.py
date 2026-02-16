from flask_api.config.mysqlconnection import query_db
from flask_api.validators.inquiry_validators import validate_inquiry_payload


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
      email=(raw_payload.get("email") or "").strip(),
      phone=(raw_payload.get("phone") or "").strip() or None,
      event_type=(raw_payload.get("event_type") or "").strip() or None,
      event_date=(raw_payload.get("event_date") or "").strip() or None,
      guest_count=guest_count,
      budget=(raw_payload.get("budget") or "").strip() or None,
      service_interest=(raw_payload.get("service_interest") or "").strip() or None,
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
