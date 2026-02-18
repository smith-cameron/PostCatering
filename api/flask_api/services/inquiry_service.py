import json
import logging
import os
import socket
import smtplib
from email.message import EmailMessage

from flask_api.models.inquiry import Inquiry

logger = logging.getLogger(__name__)


class InquiryService:
  @staticmethod
  def _log_event(level, event, **fields):
    payload = {"event": event, **fields}
    logger.log(level, json.dumps(payload, ensure_ascii=False, default=str))

  @staticmethod
  def _format_service_selection(service_selection):
    if not isinstance(service_selection, dict):
      return ""

    level = str(service_selection.get("level") or "").strip().title()
    title = str(service_selection.get("title") or "").strip()
    price = str(service_selection.get("price") or "").strip()

    if not title:
      return ""

    label = f"{level}: {title}" if level else title
    return f"{label} ({price})" if price else label

  @staticmethod
  def _format_desired_items(desired_menu_items):
    if not isinstance(desired_menu_items, list) or not desired_menu_items:
      return ""

    lines = []
    for item in desired_menu_items:
      if isinstance(item, dict):
        name = str(item.get("name") or "").strip()
        tray_size = str(item.get("tray_size") or "").strip()
        tray_price = str(item.get("tray_price") or "").strip()
        if not name:
          continue

        detail_parts = []
        if tray_size:
          detail_parts.append(f"Tray: {tray_size}")
        if tray_price:
          detail_parts.append(f"Price: {tray_price}")
        suffix = f" ({', '.join(detail_parts)})" if detail_parts else ""
        lines.append(f"- {name}{suffix}")
        continue

      if isinstance(item, str) and item.strip():
        lines.append(f"- {item.strip()}")

    return "\n".join(lines)

  @staticmethod
  def _diagnose_smtp_failure(exc):
    if isinstance(exc, smtplib.SMTPAuthenticationError):
      return {
        "reason_code": "smtp_auth_failed",
        "warning": "Inquiry saved, but email notification failed SMTP authentication.",
      }
    if isinstance(exc, smtplib.SMTPConnectError):
      return {
        "reason_code": "smtp_connect_failed",
        "warning": "Inquiry saved, but email notification could not connect to the SMTP server.",
      }
    if isinstance(exc, smtplib.SMTPServerDisconnected):
      return {
        "reason_code": "smtp_server_disconnected",
        "warning": "Inquiry saved, but the SMTP server disconnected before completion.",
      }
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
      return {
        "reason_code": "smtp_recipient_refused",
        "warning": "Inquiry saved, but the configured recipient address was refused by SMTP.",
      }
    if isinstance(exc, (TimeoutError, socket.timeout)):
      return {
        "reason_code": "smtp_timeout",
        "warning": "Inquiry saved, but email notification timed out.",
      }
    if isinstance(exc, smtplib.SMTPException):
      return {
        "reason_code": "smtp_error",
        "warning": "Inquiry saved, but SMTP returned an error while sending notification.",
      }
    return {
      "reason_code": "email_send_failed",
      "warning": "Inquiry saved, but email notification failed unexpectedly.",
    }

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
      InquiryService._log_event(
        logging.WARNING,
        "inquiry_email_skipped_missing_config",
        inquiry_id=inquiry.id,
        has_smtp_host=bool(smtp_host),
        has_smtp_username=bool(smtp_username),
        has_smtp_password=bool(smtp_password),
        has_inquiry_to_email=bool(inquiry_to_email),
      )
      return False, "Inquiry saved, but email notification is not configured.", "email_config_incomplete"

    message = EmailMessage()
    message["Subject"] = f"New Catering Inquiry: {inquiry.full_name}"
    message["From"] = inquiry_from_email
    message["To"] = inquiry_to_email
    service_selection_text = InquiryService._format_service_selection(inquiry.service_selection)
    desired_items_text = InquiryService._format_desired_items(inquiry.desired_menu_items)
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
        Service Selection: {service_selection_text}

        Desired Menu Items:
        {desired_items_text}

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
      InquiryService._log_event(
        logging.INFO,
        "inquiry_email_sent",
        inquiry_id=inquiry.id,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_use_tls=smtp_use_tls,
      )
      return True, None, None
    except Exception as exc:
      diagnosis = InquiryService._diagnose_smtp_failure(exc)
      InquiryService._log_event(
        logging.WARNING,
        "inquiry_email_send_failed",
        inquiry_id=inquiry.id,
        reason_code=diagnosis["reason_code"],
        exception_type=type(exc).__name__,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_use_tls=smtp_use_tls,
      )
      return False, diagnosis["warning"], diagnosis["reason_code"]

  @classmethod
  def submit(cls, raw_payload):
    inquiry = Inquiry.from_payload(raw_payload)
    cls._log_event(
      logging.INFO,
      "inquiry_submit_received",
      has_service_selection=bool(inquiry.service_selection),
      desired_item_count=len(inquiry.desired_menu_items),
      has_message=bool(inquiry.message),
    )

    validation_errors = inquiry.validate()
    if validation_errors:
      cls._log_event(
        logging.INFO,
        "inquiry_submit_validation_failed",
        error_count=len(validation_errors),
        errors=validation_errors,
      )
      return {"errors": validation_errors}, 400

    inquiry.save()
    cls._log_event(logging.INFO, "inquiry_saved", inquiry_id=inquiry.id)
    email_sent, email_error, reason_code = cls._send_inquiry_email(inquiry)

    if email_sent:
      inquiry.update_email_sent(True)
      cls._log_event(logging.INFO, "inquiry_submit_completed", inquiry_id=inquiry.id, email_sent=True)
      return {"inquiry_id": inquiry.id, "email_sent": True}, 201

    cls._log_event(
      logging.WARNING,
      "inquiry_submit_completed",
      inquiry_id=inquiry.id,
      email_sent=False,
      warning_reason_code=reason_code,
    )
    return {
      "inquiry_id": inquiry.id,
      "email_sent": False,
      "warning": email_error,
      "warning_code": reason_code,
    }, 201
