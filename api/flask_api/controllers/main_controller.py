import hmac
import os
from pathlib import Path

from flask import jsonify, request, send_from_directory

from flask_api import app
from flask_api.config.mysqlconnection import query_db
from flask_api.services.gallery_service import GalleryService
from flask_api.services.inquiry_service import InquiryService
from flask_api.services.menu_service import MenuService
from flask_api.services.slide_service import SlideService


SLIDES_ASSET_DIR = Path(__file__).resolve().parent.parent / "static" / "slides"


def _require_admin_token():
    configured_token = (os.getenv("MENU_ADMIN_TOKEN") or "").strip()
    provided_token = (
        request.headers.get("X-Menu-Admin-Token")
        or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    )
    if not configured_token:
        return {"error": "MENU_ADMIN_TOKEN is not configured on server."}, 403
    if not provided_token or not hmac.compare_digest(provided_token, configured_token):
        return {"error": "Unauthorized"}, 401
    return None, None


@app.route("/api/health", methods=["GET"])
def api_health():
    try:
        db_row = query_db("SELECT 1 AS ok;", fetch="one")
        db_ok = bool(db_row and int(db_row.get("ok", 0)) == 1)
        if not db_ok:
            raise RuntimeError("Unexpected database health check result.")

        return jsonify({"ok": True, "database": {"ok": True}}), 200
    except Exception:
        app.logger.warning("api_health database check failed")
        return jsonify({"ok": False, "database": {"ok": False}, "error": "database_unavailable"}), 503


@app.route("/api/slides", methods=["GET", "OPTIONS"])
def get_slides():
    if request.method == "OPTIONS":
        return ("", 204)

    slides = SlideService.get_active_slides()
    return jsonify({"slides": slides}), 200


@app.route("/api/gallery", methods=["GET", "OPTIONS"])
def get_gallery():
    if request.method == "OPTIONS":
        return ("", 204)

    gallery_items = GalleryService.get_gallery_items()
    return jsonify({"media": gallery_items}), 200


@app.route("/api/assets/slides/<path:filename>", methods=["GET"])
def get_slide_asset(filename):
    return send_from_directory(SLIDES_ASSET_DIR, filename)


@app.route("/api/menus", methods=["GET", "OPTIONS"])
def get_menus():
    if request.method == "OPTIONS":
        return ("", 204)

    response_body, status_code = MenuService.get_catalog()
    return jsonify(response_body), status_code


@app.route("/api/menu/general/groups", methods=["GET", "OPTIONS"])
def get_general_menu_groups():
    if request.method == "OPTIONS":
        return ("", 204)

    response_body, status_code = MenuService.get_general_groups()
    return jsonify(response_body), status_code


@app.route("/api/menu/general/items", methods=["GET", "OPTIONS"])
def get_general_menu_items():
    if request.method == "OPTIONS":
        return ("", 204)

    response_body, status_code = MenuService.get_general_items(group_key=request.args.get("group_key", ""))
    return jsonify(response_body), status_code


@app.route("/api/menu/formal/groups", methods=["GET", "OPTIONS"])
def get_formal_menu_groups():
    if request.method == "OPTIONS":
        return ("", 204)

    response_body, status_code = MenuService.get_formal_groups()
    return jsonify(response_body), status_code


@app.route("/api/menu/formal/items", methods=["GET", "OPTIONS"])
def get_formal_menu_items():
    if request.method == "OPTIONS":
        return ("", 204)

    response_body, status_code = MenuService.get_formal_items(group_key=request.args.get("group_key", ""))
    return jsonify(response_body), status_code


@app.route("/api/admin/menu/sync", methods=["POST", "OPTIONS"])
def admin_menu_sync():
    if request.method == "OPTIONS":
        return ("", 204)

    auth_error, status_code = _require_admin_token()
    if auth_error:
        return jsonify(auth_error), status_code

    body = request.get_json(silent=True) or {}
    apply_schema = bool(body.get("apply_schema", False))
    reset = bool(body.get("reset", False))
    seed = bool(body.get("seed", True))

    response_body, status_code = MenuService.run_menu_admin_task(
        apply_schema=apply_schema,
        reset=reset,
        seed=seed,
    )
    return jsonify(response_body), status_code


@app.route("/api/inquiries", methods=["POST", "OPTIONS"])
def create_inquiry():
    if request.method == "OPTIONS":
        return ("", 204)

    forwarded_for = request.headers.get("X-Forwarded-For", "")
    client_ip = (forwarded_for.split(",")[0].strip() if forwarded_for else "") or (request.remote_addr or "")
    user_agent = request.headers.get("User-Agent", "")

    response_body, status_code = InquiryService.submit(
        request.get_json(silent=True) or {},
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return jsonify(response_body), status_code
