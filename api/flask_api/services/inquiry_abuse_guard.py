import hashlib
import os
import re
import socket
import threading
import time
from collections import defaultdict, deque

from flask_api.validators.inquiry_validators import normalize_email, normalize_phone

URL_REGEX = re.compile(r"(https?://|www\.)", re.IGNORECASE)
DEFAULT_BLOCKED_DOMAINS = {
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
}


class InquiryAbuseGuard:
  _lock = threading.Lock()
  _ip_events = defaultdict(deque)
  _recent_submission_keys = {}
  _blocked_events = deque()

  @staticmethod
  def _get_int_env(name, default):
    try:
      return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
      return default

  @staticmethod
  def _get_bool_env(name, default=False):
    return (os.getenv(name, "true" if default else "false").strip().lower() == "true")

  @staticmethod
  def _get_list_env(name, default_values=None):
    raw = os.getenv(name, "")
    parsed = [item.strip().lower() for item in raw.split(",") if item.strip()]
    if parsed:
      return set(parsed)
    return set(default_values or [])

  @staticmethod
  def _hash(value):
    return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()[:12]

  @classmethod
  def _trim_state_locked(cls, now_epoch):
    cleanup_before = now_epoch - 86400
    for key in list(cls._ip_events.keys()):
      events = cls._ip_events[key]
      while events and events[0] < cleanup_before:
        events.popleft()
      if not events:
        del cls._ip_events[key]

    for key, timestamp in list(cls._recent_submission_keys.items()):
      if timestamp < cleanup_before:
        del cls._recent_submission_keys[key]

    while cls._blocked_events and cls._blocked_events[0] < now_epoch - 3600:
      cls._blocked_events.popleft()

  @classmethod
  def _record_blocked_locked(cls, now_epoch):
    cls._blocked_events.append(now_epoch)
    alert_threshold = cls._get_int_env("INQUIRY_ABUSE_ALERT_THRESHOLD_PER_MINUTE", 10)
    window_seconds = cls._get_int_env("INQUIRY_ABUSE_ALERT_WINDOW_SECONDS", 60)
    while cls._blocked_events and cls._blocked_events[0] < now_epoch - window_seconds:
      cls._blocked_events.popleft()
    return len(cls._blocked_events) >= max(alert_threshold, 1)

  @classmethod
  def evaluate(cls, inquiry, raw_payload, client_ip="", user_agent=""):
    now_epoch = time.time()
    client_ip = (client_ip or "").strip() or "unknown"
    user_agent = (user_agent or "").strip()

    response = {
      "allow": True,
      "status_code": 200,
      "warning": None,
      "warning_code": None,
      "silent_accept": False,
      "alert": False,
      "meta": {
        "ip_hash": cls._hash(client_ip),
        "user_agent_hash": cls._hash(user_agent),
      },
    }

    honeypot_field = os.getenv("INQUIRY_INTEGRITY_FIELD", "company_website")
    honeypot_value = str(raw_payload.get(honeypot_field, "") or "").strip()
    if honeypot_value:
      with cls._lock:
        cls._trim_state_locked(now_epoch)
        response["alert"] = cls._record_blocked_locked(now_epoch)
      response.update(
        {
          "allow": False,
          "status_code": 202,
          "warning_code": "inquiry_accepted",
          "silent_accept": True,
        }
      )
      return response

    minute_limit = cls._get_int_env("INQUIRY_RATE_LIMIT_PER_IP_PER_MINUTE", 3)
    hour_limit = cls._get_int_env("INQUIRY_RATE_LIMIT_PER_IP_PER_HOUR", 12)
    with cls._lock:
      cls._trim_state_locked(now_epoch)
      events = cls._ip_events[client_ip]
      while events and events[0] < now_epoch - 3600:
        events.popleft()
      minute_count = sum(1 for timestamp in events if timestamp >= now_epoch - 60)
      hour_count = len(events)
      if minute_count >= max(minute_limit, 1):
        response["alert"] = cls._record_blocked_locked(now_epoch)
        response.update(
          {
            "allow": False,
            "status_code": 429,
            "warning": "Please wait before submitting another inquiry.",
            "warning_code": "rate_limit_minute",
          }
        )
        return response
      if hour_count >= max(hour_limit, 1):
        response["alert"] = cls._record_blocked_locked(now_epoch)
        response.update(
          {
            "allow": False,
            "status_code": 429,
            "warning": "Please wait before submitting another inquiry.",
            "warning_code": "rate_limit_hour",
          }
        )
        return response
      events.append(now_epoch)

    max_links = cls._get_int_env("INQUIRY_MAX_LINKS", 2)
    combined_text = " ".join(
      [
        str(inquiry.full_name or ""),
        str(inquiry.message or ""),
        str(inquiry.event_type or ""),
      ]
    )
    if len(URL_REGEX.findall(combined_text)) > max(max_links, 0):
      with cls._lock:
        cls._trim_state_locked(now_epoch)
        response["alert"] = cls._record_blocked_locked(now_epoch)
      response.update(
        {
          "allow": False,
          "status_code": 429,
          "warning": "Unable to process this inquiry. Please contact us directly if the issue continues.",
          "warning_code": "spam_link_threshold",
        }
      )
      return response

    duplicate_window = cls._get_int_env("INQUIRY_DUPLICATE_WINDOW_SECONDS", 900)
    duplicate_key = "|".join(
      [
        normalize_email(inquiry.email) or "",
        normalize_phone(inquiry.phone) or "",
        str(inquiry.event_date or "").strip(),
        str(inquiry.service_interest or "").strip().lower(),
      ]
    )
    if duplicate_key.strip("|"):
      with cls._lock:
        cls._trim_state_locked(now_epoch)
        last_timestamp = cls._recent_submission_keys.get(duplicate_key)
        if last_timestamp is not None and (now_epoch - last_timestamp) < max(duplicate_window, 0):
          response["alert"] = cls._record_blocked_locked(now_epoch)
          response.update(
            {
              "allow": False,
              "status_code": 202,
              "warning_code": "duplicate_submission_window",
              "silent_accept": True,
            }
          )
          return response
        cls._recent_submission_keys[duplicate_key] = now_epoch

    email = normalize_email(inquiry.email) or ""
    email_domain = email.split("@", 1)[1] if "@" in email else ""
    response["meta"]["email_domain"] = email_domain

    blocked_domains = cls._get_list_env("INQUIRY_BLOCKED_EMAIL_DOMAINS", DEFAULT_BLOCKED_DOMAINS)
    if email_domain and email_domain in blocked_domains:
      with cls._lock:
        cls._trim_state_locked(now_epoch)
        response["alert"] = cls._record_blocked_locked(now_epoch)
      response.update(
        {
          "allow": False,
          "status_code": 400,
          "warning": "Please use a standard email domain for inquiry follow-up.",
          "warning_code": "email_domain_blocked",
        }
      )
      return response

    allowed_domains = cls._get_list_env("INQUIRY_ALLOWED_EMAIL_DOMAINS")
    if email_domain and allowed_domains and email_domain not in allowed_domains:
      with cls._lock:
        cls._trim_state_locked(now_epoch)
        response["alert"] = cls._record_blocked_locked(now_epoch)
      response.update(
        {
          "allow": False,
          "status_code": 400,
          "warning": "Please use an approved email domain for inquiry follow-up.",
          "warning_code": "email_domain_not_allowed",
        }
      )
      return response

    if email_domain and cls._get_bool_env("INQUIRY_REQUIRE_EMAIL_DOMAIN_DNS", False):
      try:
        socket.getaddrinfo(email_domain, None)
      except socket.gaierror:
        with cls._lock:
          cls._trim_state_locked(now_epoch)
          response["alert"] = cls._record_blocked_locked(now_epoch)
        response.update(
          {
            "allow": False,
            "status_code": 400,
            "warning": "Please provide an email address with a reachable domain.",
            "warning_code": "email_domain_unreachable",
          }
        )
        return response

    return response
