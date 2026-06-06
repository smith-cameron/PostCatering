import logging
import os
from urllib.parse import urlparse

from flask import Flask
from flask_api.config.mysqlconnection import close_request_connection

DEV_SECRET_KEY = "dev-only-secret-key"
DEV_CORS_ALLOW_ORIGIN = "http://localhost:5173"
VALID_SAMESITE_VALUES = {
    "lax": "Lax",
    "strict": "Strict",
    "none": "None",
}
TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}
FALSY_ENV_VALUES = {"0", "false", "no", "off"}

log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


def _is_production_environment():
    environment_name = str(os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "").strip().lower()
    return environment_name in {"production", "prod"}


def _get_trimmed_env(name):
    value = os.getenv(name)
    if value is None:
        return None
    trimmed = str(value).strip()
    return trimmed or None


def _parse_bool_value(value, *, name):
    normalized = str(value or "").strip().lower()
    if normalized in TRUTHY_ENV_VALUES:
        return True
    if normalized in FALSY_ENV_VALUES:
        return False
    raise RuntimeError(f"{name} must be one of: true, false, 1, 0, yes, no, on, off.")


def _normalize_samesite(value):
    normalized = str(value or "Lax").strip().lower()
    if normalized not in VALID_SAMESITE_VALUES:
        raise RuntimeError("SESSION_COOKIE_SAMESITE must be one of: Lax, Strict, None.")
    return VALID_SAMESITE_VALUES[normalized]


def _is_loopback_origin(origin):
    parsed = urlparse(str(origin or "").strip())
    hostname = str(parsed.hostname or "").strip().lower()
    return hostname in {"localhost", "127.0.0.1", "::1"}


def _build_runtime_security_config():
    secret_key = _get_trimmed_env("FLASK_SECRET_KEY")
    session_cookie_samesite_raw = _get_trimmed_env("SESSION_COOKIE_SAMESITE")
    session_cookie_secure_raw = _get_trimmed_env("SESSION_COOKIE_SECURE")
    cors_allow_origin = _get_trimmed_env("CORS_ALLOW_ORIGIN")

    if _is_production_environment():
        missing_variables = []
        if not secret_key:
            missing_variables.append("FLASK_SECRET_KEY")
        if session_cookie_samesite_raw is None:
            missing_variables.append("SESSION_COOKIE_SAMESITE")
        if session_cookie_secure_raw is None:
            missing_variables.append("SESSION_COOKIE_SECURE")
        if not cors_allow_origin:
            missing_variables.append("CORS_ALLOW_ORIGIN")
        if missing_variables:
            missing_list = ", ".join(missing_variables)
            raise RuntimeError(f"Production configuration missing required environment variables: {missing_list}")

        if secret_key == DEV_SECRET_KEY:
            raise RuntimeError("Production configuration requires a non-development FLASK_SECRET_KEY.")

        session_cookie_samesite = _normalize_samesite(session_cookie_samesite_raw)
        session_cookie_secure = _parse_bool_value(
            session_cookie_secure_raw,
            name="SESSION_COOKIE_SECURE",
        )
        if not session_cookie_secure:
            raise RuntimeError("Production configuration requires SESSION_COOKIE_SECURE=true.")

        if _is_loopback_origin(cors_allow_origin):
            raise RuntimeError(
                "Production configuration requires CORS_ALLOW_ORIGIN to use a non-loopback frontend origin."
            )
    else:
        session_cookie_samesite = _normalize_samesite(session_cookie_samesite_raw)
        session_cookie_secure = (
            _parse_bool_value(session_cookie_secure_raw, name="SESSION_COOKIE_SECURE")
            if session_cookie_secure_raw is not None
            else False
        )
        secret_key = secret_key or DEV_SECRET_KEY
        cors_allow_origin = cors_allow_origin or DEV_CORS_ALLOW_ORIGIN

    return {
        "secret_key": secret_key,
        "session_cookie_samesite": session_cookie_samesite,
        "session_cookie_secure": session_cookie_secure,
        "cors_allow_origin": cors_allow_origin,
    }


runtime_security_config = _build_runtime_security_config()
app = Flask(__name__)
app.secret_key = runtime_security_config["secret_key"]
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = runtime_security_config["session_cookie_samesite"]
app.config["SESSION_COOKIE_SECURE"] = runtime_security_config["session_cookie_secure"]
app.config["CORS_ALLOW_ORIGIN"] = runtime_security_config["cors_allow_origin"]


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = app.config["CORS_ALLOW_ORIGIN"]
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Menu-Admin-Token"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.teardown_appcontext
def teardown_db_connection(exception):
    close_request_connection(exception=exception)


# Register route decorators on app import so python api/server.py and tests
# load the same endpoint set without requiring a separate controller import.
import flask_api.controllers.main_controller  # noqa: E402,F401
