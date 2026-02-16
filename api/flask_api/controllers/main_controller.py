import os
import smtplib
from email.message import EmailMessage

from flask import jsonify, request

from flask_api import app
from flask_api.models.inquiry import Inquiry
from flask_api.models.slide import Slide


def _send_inquiry_email(payload):
  smtp_host = os.getenv("SMTP_HOST")
  smtp_port = int(os.getenv("SMTP_PORT", "587"))
  smtp_username = os.getenv("SMTP_USERNAME")
  smtp_password = os.getenv("SMTP_PASSWORD")
  smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
  inquiry_to_email = os.getenv("INQUIRY_TO_EMAIL")
  inquiry_from_email = os.getenv("INQUIRY_FROM_EMAIL", smtp_username or "")

  if not smtp_host or not smtp_username or not smtp_password or not inquiry_to_email:
    return False, "Email settings are incomplete."

  message = EmailMessage()
  message["Subject"] = f"New Catering Inquiry: {payload['full_name']}"
  message["From"] = inquiry_from_email
  message["To"] = inquiry_to_email
  message.set_content(
    f"""
New catering inquiry received.

Full Name: {payload['full_name']}
Email: {payload['email']}
Phone: {payload.get('phone') or ''}
Event Type: {payload.get('event_type') or ''}
Event Date: {payload.get('event_date') or ''}
Guest Count: {payload.get('guest_count') or ''}
Budget: {payload.get('budget') or ''}
Service Interest: {payload.get('service_interest') or ''}

Message:
{payload['message']}
"""
  )

  try:
    with smtplib.SMTP(smtp_host, smtp_port) as server:
      if smtp_use_tls:
        server.starttls()
      server.login(smtp_username, smtp_password)
      server.send_message(message)
    return True, None
  except Exception:
    return False, "Failed to send inquiry email."


def _normalize_inquiry_payload(raw_payload):
  payload = {
    "full_name": (raw_payload.get("full_name") or "").strip(),
    "email": (raw_payload.get("email") or "").strip(),
    "phone": (raw_payload.get("phone") or "").strip() or None,
    "event_type": (raw_payload.get("event_type") or "").strip() or None,
    "event_date": (raw_payload.get("event_date") or "").strip() or None,
    "guest_count": raw_payload.get("guest_count"),
    "budget": (raw_payload.get("budget") or "").strip() or None,
    "service_interest": (raw_payload.get("service_interest") or "").strip() or None,
    "message": (raw_payload.get("message") or "").strip(),
  }

  if payload["guest_count"] in ("", None):
    payload["guest_count"] = None
  else:
    try:
      payload["guest_count"] = int(payload["guest_count"])
    except (TypeError, ValueError):
      payload["guest_count"] = "__invalid__"

  return payload


@app.route("/api/health", methods=["GET"])
def api_health():
  return jsonify({"ok": True}), 200


@app.route("/api/slides", methods=["GET", "OPTIONS"])
def get_slides():
  if request.method == "OPTIONS":
    return ("", 204)

  slides = Slide.get_active()
  return jsonify({"slides": slides}), 200


@app.route("/api/inquiries", methods=["POST", "OPTIONS"])
def create_inquiry():
  if request.method == "OPTIONS":
    return ("", 204)

  raw_payload = request.get_json(silent=True) or {}
  payload = _normalize_inquiry_payload(raw_payload)

  validation_errors = []
  if not payload["full_name"]:
    validation_errors.append("full_name is required.")
  if not payload["email"]:
    validation_errors.append("email is required.")
  if not payload["message"]:
    validation_errors.append("message is required.")
  if payload["guest_count"] == "__invalid__":
    validation_errors.append("guest_count must be a number.")

  if validation_errors:
    return jsonify({"errors": validation_errors}), 400

  payload["email_sent"] = 0
  inquiry_id = Inquiry.create(payload)

  email_sent, email_error = _send_inquiry_email(payload)
  if email_sent:
    Inquiry.update_email_sent(inquiry_id, 1)
    return jsonify({"inquiry_id": inquiry_id, "email_sent": True}), 201

  return (
    jsonify(
      {
        "inquiry_id": inquiry_id,
        "email_sent": False,
        "warning": email_error,
      }
    ),
    201,
  )
