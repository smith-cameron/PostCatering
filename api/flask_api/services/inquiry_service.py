import json
import logging
import os
import socket
import smtplib
from datetime import datetime, timezone
from collections import OrderedDict
from email.message import EmailMessage
import html

from flask_api.config.mysqlconnection import query_db
from flask_api.models.inquiry import Inquiry
from flask_api.services.inquiry_abuse_guard import InquiryAbuseGuard

logger = logging.getLogger(__name__)


class InquiryService:
    EMAIL_CONTENT_CONFIG_KEY = "inquiry_email_content"
    DEFAULT_CONFIRMATION_SUBJECT = "Post 468 Catering Team - Inquiry Recieved"
    DEFAULT_CONFIRMATION_OWNER_NOTE = (
        "[PLACEHOLDER_NOTE_FROM_ARIANNE] Thank you for your inquiry. We will be in touch soon."
    )

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
    def _format_submitted_at(submitted_at_utc):
        if not submitted_at_utc:
            return ""
        try:
            parsed = datetime.fromisoformat(str(submitted_at_utc).replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            return str(submitted_at_utc)

        return f"{parsed.strftime('%A, %B')} {parsed.day}, {parsed.year}"

    @staticmethod
    def _format_event_date(event_date):
        if not event_date:
            return ""
        if isinstance(event_date, datetime):
            parsed = event_date.date()
        else:
            try:
                parsed = datetime.fromisoformat(str(event_date)).date()
            except ValueError:
                return str(event_date)
        return f"{parsed.strftime('%A, %B')} {parsed.day}, {parsed.year}"

    @staticmethod
    def _normalize_category_label(category):
        key = str(category or "other").strip().lower().replace(" ", "_")
        label_map = {
            "entree": "Entree/Protein",
            "entrees": "Entree/Protein",
            "protein": "Entree/Protein",
            "proteins": "Entree/Protein",
            "sides": "Sides",
            "salads": "Salads",
            "starter": "Starters",
            "starters": "Starters",
            "passed": "Passed Appetizers",
            "appetizer": "Appetizers",
            "appetizers": "Appetizers",
            "other": "Other",
        }
        if key in label_map:
            return label_map[key]
        return key.replace("_", " ").title()

    @staticmethod
    def _group_desired_items_by_category(desired_menu_items):
        grouped = OrderedDict()
        if not isinstance(desired_menu_items, list):
            return grouped

        for item in desired_menu_items:
            if isinstance(item, dict):
                name = str(item.get("name") or "").strip()
                if not name:
                    continue
                category_label = InquiryService._normalize_category_label(item.get("category"))
                grouped.setdefault(category_label, []).append(
                    {
                        "name": name,
                        "tray_size": str(item.get("tray_size") or "").strip(),
                        "tray_price": str(item.get("tray_price") or "").strip(),
                    }
                )
                continue

            if isinstance(item, str) and item.strip():
                grouped.setdefault("Other", []).append({"name": item.strip(), "tray_size": "", "tray_price": ""})
        return grouped

    @staticmethod
    def _format_desired_items_by_category(desired_menu_items):
        if not isinstance(desired_menu_items, list) or not desired_menu_items:
            return "- None provided"

        grouped = InquiryService._group_desired_items_by_category(desired_menu_items)
        if not grouped:
            return "- None provided"

        lines = []
        for category, items in grouped.items():
            lines.append(f"{category}:")
            for item in items:
                detail_parts = []
                if item.get("tray_size"):
                    detail_parts.append(f"Tray: {item['tray_size']}")
                if item.get("tray_price"):
                    detail_parts.append(f"Price: {item['tray_price']}")
                suffix = f" ({', '.join(detail_parts)})" if detail_parts else ""
                lines.append(f"- {item['name']}{suffix}")
            lines.append("")
        return "\n".join(lines).strip()

    @staticmethod
    def _format_desired_items_by_category_html(desired_menu_items):
        grouped = InquiryService._group_desired_items_by_category(desired_menu_items)
        if not grouped:
            return '<p style="margin:0;color:#475467;">None provided.</p>'

        blocks = []
        for category, items in grouped.items():
            item_lines = []
            for item in items:
                details = []
                if item.get("tray_size"):
                    details.append(f"Tray: {html.escape(item['tray_size'])}")
                if item.get("tray_price"):
                    details.append(f"Price: {html.escape(item['tray_price'])}")
                detail_suffix = f" <span style=\"color:#667085;\">({', '.join(details)})</span>" if details else ""
                item_lines.append(f"<li style=\"margin:4px 0;\">{html.escape(item['name'])}{detail_suffix}</li>")
            blocks.append(
                "".join(
                    [
                        '<div style="margin:0 0 14px 0;">',
                        f'<div style="font-weight:700;color:#101828;margin:0 0 6px 0;">{html.escape(category)}</div>',
                        f"<ul style=\"margin:0 0 0 18px;padding:0;color:#344054;\">{''.join(item_lines)}</ul>",
                        "</div>",
                    ]
                )
            )
        return "".join(blocks)

    @staticmethod
    def _get_confirmation_email_content():
        subject = InquiryService.DEFAULT_CONFIRMATION_SUBJECT
        owner_note = InquiryService.DEFAULT_CONFIRMATION_OWNER_NOTE

        try:
            row = query_db(
                """
        SELECT config_json
        FROM menu_config
        WHERE config_key = %(config_key)s
        LIMIT 1;
        """,
                {"config_key": InquiryService.EMAIL_CONTENT_CONFIG_KEY},
                fetch="one",
            )
        except Exception as exc:
            InquiryService._log_event(
                logging.WARNING,
                "inquiry_email_content_load_failed",
                exception_type=type(exc).__name__,
            )
            return subject, owner_note

        if not row:
            return subject, owner_note

        config_json = row.get("config_json")
        if isinstance(config_json, str):
            try:
                config_json = json.loads(config_json)
            except json.JSONDecodeError:
                return subject, owner_note
        if not isinstance(config_json, dict):
            return subject, owner_note

        configured_subject = str(config_json.get("confirmation_subject") or "").strip()
        configured_note = str(config_json.get("owner_note") or "").strip()
        if configured_subject:
            subject = configured_subject
        if configured_note:
            owner_note = configured_note
        return subject, owner_note

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
    def _utc_timestamp():
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _send_email_message(message, smtp_config, inquiry_id, email_type):
        smtp_host = smtp_config["smtp_host"]
        smtp_port = smtp_config["smtp_port"]
        smtp_use_tls = smtp_config["smtp_use_tls"]
        try:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                if smtp_use_tls:
                    server.starttls()
                server.login(smtp_config["smtp_username"], smtp_config["smtp_password"])
                server.send_message(message)
            InquiryService._log_event(
                logging.INFO,
                "inquiry_email_sent",
                inquiry_id=inquiry_id,
                email_type=email_type,
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
                inquiry_id=inquiry_id,
                email_type=email_type,
                reason_code=diagnosis["reason_code"],
                exception_type=type(exc).__name__,
                smtp_host=smtp_host,
                smtp_port=smtp_port,
                smtp_use_tls=smtp_use_tls,
            )
            return False, diagnosis["warning"], diagnosis["reason_code"]

    @staticmethod
    def _build_owner_email(inquiry, submitted_at_utc, inquiry_from_email, inquiry_to_email):
        service_selection_text = InquiryService._format_service_selection(inquiry.service_selection)
        desired_items_text = InquiryService._format_desired_items_by_category(inquiry.desired_menu_items)
        submitted_display = InquiryService._format_submitted_at(submitted_at_utc)
        event_date_display = InquiryService._format_event_date(inquiry.event_date) or ""
        message = EmailMessage()
        message["Subject"] = f"New Catering Inquiry: {inquiry.full_name}"
        message["From"] = inquiry_from_email
        message["To"] = inquiry_to_email
        if inquiry.email:
            message["Reply-To"] = inquiry.email
        plain_text = "\n".join(
            [
                "POST 468 CATERING INQUIRY",
                "=========================",
                "",
                f"Submitted Date: {submitted_display}",
                "",
                "CONTACT",
                "-------",
                f"Full Name: {inquiry.full_name}",
                f"Email: {inquiry.email}",
                f"Phone: {inquiry.phone or ''}",
                "",
                "EVENT",
                "-----",
                f"Event Type: {inquiry.event_type or ''}",
                f"Event Date: {event_date_display}",
                f"Guest Count: {inquiry.guest_count or ''}",
                f"Budget: {inquiry.budget or ''}",
                "",
                "SERVICE",
                "-------",
                f"Service Interest: {inquiry.service_interest or ''}",
                f"Service Selection: {service_selection_text}",
                "",
                "DESIRED MENU ITEMS",
                "------------------",
                desired_items_text,
                "",
                "MESSAGE",
                "-------",
                inquiry.message or "",
            ]
        )
        message.set_content(plain_text)
        message.add_alternative(
            "\n".join(
                [
                    '<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#101828;">',
                    '<div style="max-width:680px;margin:20px auto;padding:20px;background:#ffffff;border:1px solid #e4e7ec;border-radius:10px;">',
                    '<h2 style="margin:0 0 8px 0;color:#101828;">Post 468 Catering Inquiry</h2>',
                    f'<p style="margin:0 0 18px 0;color:#475467;"><strong>Submitted Date:</strong> {html.escape(submitted_display)}</p>',
                    '<h3 style="margin:0 0 8px 0;color:#1d2939;">Contact</h3>',
                    f"<p style=\"margin:0 0 12px 0;line-height:1.6;\"><strong>Full Name:</strong> {html.escape(inquiry.full_name)}<br><strong>Email:</strong> {html.escape(inquiry.email)}<br><strong>Phone:</strong> {html.escape(inquiry.phone or '')}</p>",
                    '<h3 style="margin:0 0 8px 0;color:#1d2939;">Event</h3>',
                    f"<p style=\"margin:0 0 12px 0;line-height:1.6;\"><strong>Event Type:</strong> {html.escape(inquiry.event_type or '')}<br><strong>Event Date:</strong> {html.escape(event_date_display)}<br><strong>Guest Count:</strong> {html.escape(str(inquiry.guest_count or ''))}<br><strong>Budget:</strong> {html.escape(inquiry.budget or '')}</p>",
                    '<h3 style="margin:0 0 8px 0;color:#1d2939;">Service</h3>',
                    f"<p style=\"margin:0 0 12px 0;line-height:1.6;\"><strong>Service Interest:</strong> {html.escape(inquiry.service_interest or '')}<br><strong>Service Selection:</strong> {html.escape(service_selection_text)}</p>",
                    '<h3 style="margin:0 0 8px 0;color:#1d2939;">Desired Menu Items</h3>',
                    InquiryService._format_desired_items_by_category_html(inquiry.desired_menu_items),
                    '<h3 style="margin:4px 0 8px 0;color:#1d2939;">Message</h3>',
                    f"<p style=\"margin:0;line-height:1.6;color:#344054;\">{html.escape(inquiry.message or '')}</p>",
                    "</div></body></html>",
                ]
            ),
            subtype="html",
        )
        return message

    @staticmethod
    def _build_customer_confirmation_email(
        inquiry,
        submitted_at_utc,
        inquiry_from_email,
        reply_to_email,
        owner_note,
        confirmation_subject,
    ):
        service_selection_text = InquiryService._format_service_selection(inquiry.service_selection) or "Not specified"
        desired_items_text = InquiryService._format_desired_items_by_category(inquiry.desired_menu_items)
        submitted_display = InquiryService._format_submitted_at(submitted_at_utc)
        event_date_display = InquiryService._format_event_date(inquiry.event_date) or ""
        message = EmailMessage()
        message["Subject"] = confirmation_subject
        message["From"] = inquiry_from_email
        message["To"] = inquiry.email
        if reply_to_email:
            message["Reply-To"] = reply_to_email
        event_date_with_note = (
            f"{event_date_display} (*Event time of day will be clarified later by our catering staff.*)"
            if event_date_display
            else "*Event time of day will be clarified later by our catering staff.*"
        )
        owner_note = str(owner_note or "").strip() or InquiryService.DEFAULT_CONFIRMATION_OWNER_NOTE
        plain_text = "\n".join(
            [
                f"Hi {inquiry.full_name},",
                "",
                "Thank you for contacting American Legion Post 468 Catering.",
                "",
                "YOUR SUBMISSION",
                "---------------",
                f"- Submitted Date: {submitted_display}",
                f"- Event Type: {inquiry.event_type or ''}",
                f"- Event Date: {event_date_with_note}",
                f"- Guest Count: {inquiry.guest_count or ''}",
                f"- Budget: {inquiry.budget or ''}",
                f"- Service Interest: {inquiry.service_interest or ''}",
                f"- Service Selection: {service_selection_text}",
                "",
                "DESIRED MENU ITEMS",
                "------------------",
                desired_items_text,
                "",
                "MESSAGE",
                "-------",
                inquiry.message or "",
                "",
                owner_note,
            ]
        )
        message.set_content(plain_text)
        message.add_alternative(
            "\n".join(
                [
                    '<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#101828;">',
                    '<div style="max-width:680px;margin:20px auto;padding:20px;background:#ffffff;border:1px solid #e4e7ec;border-radius:10px;">',
                    f'<h2 style="margin:0 0 10px 0;color:#101828;">Hi {html.escape(inquiry.full_name)},</h2>',
                    '<p style="margin:0 0 16px 0;color:#344054;line-height:1.6;">Thank you for contacting American Legion Post 468 Catering.</p>',
                    '<h3 style="margin:0 0 8px 0;color:#1d2939;">Your Submission</h3>',
                    '<ul style="margin:0 0 14px 18px;padding:0;color:#344054;line-height:1.6;">',
                    f"<li><strong>Submitted Date:</strong> {html.escape(submitted_display)}</li>",
                    f"<li><strong>Event Type:</strong> {html.escape(inquiry.event_type or '')}</li>",
                    f'<li><strong>Event Date:</strong> {html.escape(event_date_display)} <em style="color:#667085;">(Event time of day will be clarified later by our catering staff.)</em></li>',
                    f"<li><strong>Guest Count:</strong> {html.escape(str(inquiry.guest_count or ''))}</li>",
                    f"<li><strong>Budget:</strong> {html.escape(inquiry.budget or '')}</li>",
                    f"<li><strong>Service Interest:</strong> {html.escape(inquiry.service_interest or '')}</li>",
                    f"<li><strong>Service Selection:</strong> {html.escape(service_selection_text)}</li>",
                    "</ul>",
                    '<h3 style="margin:0 0 8px 0;color:#1d2939;">Desired Menu Items</h3>',
                    InquiryService._format_desired_items_by_category_html(inquiry.desired_menu_items),
                    '<h3 style="margin:4px 0 8px 0;color:#1d2939;">Message</h3>',
                    f"<p style=\"margin:0 0 16px 0;line-height:1.6;color:#344054;\">{html.escape(inquiry.message or '')}</p>",
                    f'<p style="margin:0;padding:12px 14px;border-left:4px solid #1d4ed8;background:#eff6ff;line-height:1.7;color:#1d2939;">{html.escape(owner_note)}</p>',
                    "</div></body></html>",
                ]
            ),
            subtype="html",
        )
        return message

    @staticmethod
    def _send_inquiry_notifications(inquiry, submitted_at_utc):
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_username = os.getenv("SMTP_USERNAME")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        inquiry_to_email = os.getenv("INQUIRY_TO_EMAIL")
        inquiry_from_email = os.getenv("INQUIRY_FROM_EMAIL", smtp_username or "")
        reply_to_email = os.getenv("INQUIRY_REPLY_TO_EMAIL", inquiry_to_email or "")
        confirmation_enabled = os.getenv("INQUIRY_CONFIRMATION_ENABLED", "true").lower() == "true"
        confirmation_subject, owner_note = InquiryService._get_confirmation_email_content()

        if not smtp_host or not smtp_username or not smtp_password:
            InquiryService._log_event(
                logging.WARNING,
                "inquiry_email_skipped_missing_smtp_config",
                inquiry_id=inquiry.id,
                has_smtp_host=bool(smtp_host),
                has_smtp_username=bool(smtp_username),
                has_smtp_password=bool(smtp_password),
            )
            warning = "Inquiry saved, but email notification is not configured."
            return {
                "owner_email_sent": False,
                "confirmation_email_sent": False,
                "warning_messages": [warning],
                "warning_codes": ["email_config_incomplete"],
            }

        if not inquiry_to_email:
            InquiryService._log_event(
                logging.WARNING,
                "inquiry_owner_email_skipped_missing_destination",
                inquiry_id=inquiry.id,
                has_inquiry_to_email=bool(inquiry_to_email),
            )
            warning = "Inquiry saved, but owner email destination is not configured."
            return {
                "owner_email_sent": False,
                "confirmation_email_sent": False,
                "warning_messages": [warning],
                "warning_codes": ["owner_email_config_incomplete"],
            }

        smtp_config = {
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "smtp_username": smtp_username,
            "smtp_password": smtp_password,
            "smtp_use_tls": smtp_use_tls,
        }
        warning_messages = []
        warning_codes = []

        owner_email = InquiryService._build_owner_email(
            inquiry=inquiry,
            submitted_at_utc=submitted_at_utc,
            inquiry_from_email=inquiry_from_email,
            inquiry_to_email=inquiry_to_email,
        )
        owner_email_sent, owner_warning, owner_code = InquiryService._send_email_message(
            message=owner_email,
            smtp_config=smtp_config,
            inquiry_id=inquiry.id,
            email_type="owner_notification",
        )
        if owner_warning:
            warning_messages.append(owner_warning)
        if owner_code:
            warning_codes.append(owner_code)

        confirmation_email_sent = False
        if confirmation_enabled:
            confirmation_email = InquiryService._build_customer_confirmation_email(
                inquiry=inquiry,
                submitted_at_utc=submitted_at_utc,
                inquiry_from_email=inquiry_from_email,
                reply_to_email=reply_to_email,
                owner_note=owner_note,
                confirmation_subject=confirmation_subject,
            )
            confirmation_email_sent, confirmation_warning, confirmation_code = InquiryService._send_email_message(
                message=confirmation_email,
                smtp_config=smtp_config,
                inquiry_id=inquiry.id,
                email_type="customer_confirmation",
            )
            if confirmation_warning:
                warning_messages.append("Inquiry saved, but customer confirmation email could not be sent.")
            if confirmation_code:
                warning_codes.append(f"customer_{confirmation_code}")
        else:
            InquiryService._log_event(
                logging.INFO,
                "inquiry_confirmation_email_skipped_disabled",
                inquiry_id=inquiry.id,
            )

        return {
            "owner_email_sent": owner_email_sent,
            "confirmation_email_sent": confirmation_email_sent,
            "warning_messages": warning_messages,
            "warning_codes": warning_codes,
        }

    @classmethod
    def submit(cls, raw_payload, client_ip="", user_agent=""):
        inquiry = Inquiry.from_payload(raw_payload)
        cls._log_event(
            logging.INFO,
            "inquiry_submit_received",
            has_service_selection=bool(inquiry.service_selection),
            desired_item_count=len(inquiry.desired_menu_items),
            has_message=bool(inquiry.message),
        )

        abuse_check = InquiryAbuseGuard.evaluate(
            inquiry=inquiry,
            raw_payload=raw_payload,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        if not abuse_check["allow"]:
            log_level = logging.ERROR if abuse_check.get("alert") else logging.WARNING
            cls._log_event(
                log_level,
                "inquiry_submit_blocked",
                reason_code=abuse_check.get("warning_code"),
                status_code=abuse_check.get("status_code"),
                ip_hash=abuse_check.get("meta", {}).get("ip_hash"),
                user_agent_hash=abuse_check.get("meta", {}).get("user_agent_hash"),
            )

            if abuse_check.get("silent_accept"):
                return {"inquiry_id": None, "email_sent": False}, abuse_check["status_code"]
            return {"errors": [abuse_check.get("warning") or "Unable to process inquiry."]}, abuse_check["status_code"]

        try:
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
            duplicate_key = abuse_check.get("meta", {}).get("duplicate_key")
            if duplicate_key:
                InquiryAbuseGuard.record_successful_submission(duplicate_key)

            submitted_at_utc = cls._utc_timestamp()
            notification_result = cls._send_inquiry_notifications(inquiry, submitted_at_utc=submitted_at_utc)
            owner_email_sent = bool(notification_result.get("owner_email_sent"))
            confirmation_email_sent = bool(notification_result.get("confirmation_email_sent"))
            warning_messages = notification_result.get("warning_messages") or []
            warning_codes = notification_result.get("warning_codes") or []

            if owner_email_sent:
                inquiry.update_email_sent(True)
            log_level = logging.WARNING if warning_codes else logging.INFO
            cls._log_event(
                log_level,
                "inquiry_submit_completed",
                inquiry_id=inquiry.id,
                email_sent=owner_email_sent,
                owner_email_sent=owner_email_sent,
                confirmation_email_sent=confirmation_email_sent,
                warning_codes=warning_codes,
            )

            response = {
                "inquiry_id": inquiry.id,
                "email_sent": owner_email_sent,
                "owner_email_sent": owner_email_sent,
                "confirmation_email_sent": confirmation_email_sent,
            }
            if warning_messages:
                response["warning"] = warning_messages[0]
            if warning_codes:
                response["warning_code"] = warning_codes[0]
                response["warning_codes"] = warning_codes
            return response, 201
        except Exception as exc:
            cls._log_event(
                logging.ERROR,
                "inquiry_submit_failed",
                inquiry_id=getattr(inquiry, "id", None),
                exception_type=type(exc).__name__,
                error_message=str(exc),
            )
            return {"errors": ["Unable to process inquiry right now. Please try again later."]}, 500
