import os
import smtplib
from email.message import EmailMessage

from flask_api.models.inquiry import Inquiry


class InquiryService:
  @staticmethod
  def _send_inquiry_email(inquiry):
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
    message["Subject"] = f"New Catering Inquiry: {inquiry.full_name}"
    message["From"] = inquiry_from_email
    message["To"] = inquiry_to_email
    message.set_content(
      f"""
        New catering inquiry received.

        Full Name: {inquiry.full_name}
        Email: {inquiry.email}
        Phone: {inquiry.phone or ''}
        Event Type: {inquiry.event_type or ''}
        Event Date: {inquiry.event_date or ''}
        Guest Count: {inquiry.guest_count or ''}
        Budget: {inquiry.budget or ''}
        Service Interest: {inquiry.service_interest or ''}

        Message:
        {inquiry.message}
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

  @classmethod
  def submit(cls, raw_payload):
    inquiry = Inquiry.from_payload(raw_payload)
    validation_errors = inquiry.validate()
    if validation_errors:
      return {"errors": validation_errors}, 400

    inquiry.save()
    email_sent, email_error = cls._send_inquiry_email(inquiry)

    if email_sent:
      inquiry.update_email_sent(True)
      return {"inquiry_id": inquiry.id, "email_sent": True}, 201

    return {"inquiry_id": inquiry.id, "email_sent": False, "warning": email_error}, 201
