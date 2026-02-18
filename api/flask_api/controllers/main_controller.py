import hmac
import os
from pathlib import Path

from flask import jsonify, request, send_from_directory

from flask_api import app
from flask_api.config.mysqlconnection import query_db
from flask_api.services.inquiry_service import InquiryService
from flask_api.services.menu_service import MenuService
from flask_api.services.slide_service import SlideService


SLIDES_ASSET_DIR = Path(__file__).resolve().parent.parent / "static" / "slides"


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


@app.route("/api/assets/slides/<path:filename>", methods=["GET"])
def get_slide_asset(filename):
  return send_from_directory(SLIDES_ASSET_DIR, filename)


@app.route("/api/menus", methods=["GET", "OPTIONS"])
def get_menus():
  if request.method == "OPTIONS":
    return ("", 204)

  response_body, status_code = MenuService.get_catalog()
  return jsonify(response_body), status_code


@app.route("/api/admin/menu/sync", methods=["POST", "OPTIONS"])
def admin_menu_sync():
  if request.method == "OPTIONS":
    return ("", 204)

  configured_token = (os.getenv("MENU_ADMIN_TOKEN") or "").strip()
  provided_token = (
    request.headers.get("X-Menu-Admin-Token")
    or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
  )

  if not configured_token:
    return jsonify({"error": "MENU_ADMIN_TOKEN is not configured on server."}), 403
  if not provided_token or not hmac.compare_digest(provided_token, configured_token):
    return jsonify({"error": "Unauthorized"}), 401

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

  response_body, status_code = InquiryService.submit(request.get_json(silent=True) or {})
  return jsonify(response_body), status_code
