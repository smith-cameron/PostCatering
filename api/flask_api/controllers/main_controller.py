import hmac
import os
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import jsonify, request, send_from_directory, session
from werkzeug.utils import secure_filename

from flask_api import app
from flask_api.config.mysqlconnection import query_db
from flask_api.services.admin_audit_service import AdminAuditService
from flask_api.services.admin_auth_service import AdminAuthService
from flask_api.services.admin_media_service import AdminMediaService
from flask_api.services.admin_menu_service import AdminMenuService
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


def _resolve_session_admin_user():
    admin_user_id = session.get("admin_user_id")
    if not admin_user_id:
        return None

    user = AdminAuthService.get_user_by_id(admin_user_id)
    if not user or not bool(user.get("is_active", 0)):
        session.pop("admin_user_id", None)
        return None
    return user


def _require_admin_auth(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        # Let CORS preflight requests pass before session auth checks.
        if request.method == "OPTIONS":
            return ("", 204)
        admin_user = _resolve_session_admin_user()
        if not admin_user:
            return jsonify({"error": "Unauthorized"}), 401
        return handler(*args, admin_user=admin_user, **kwargs)

    return wrapped


def _bool_query_param(name, default=None):
    value = request.args.get(name)
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def _sanitize_upload_filename(filename):
    safe_name = secure_filename(str(filename or "").strip())
    if not safe_name:
        safe_name = "upload"
    stem, ext = os.path.splitext(safe_name)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    stem = stem[:80] if stem else "upload"
    candidate = f"{stem}-{timestamp}{ext.lower()}"

    counter = 2
    while (SLIDES_ASSET_DIR / candidate).exists():
        candidate = f"{stem}-{timestamp}-{counter}{ext.lower()}"
        counter += 1
    return candidate


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

    admin_user = _resolve_session_admin_user()
    if not admin_user:
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


@app.route("/api/admin/auth/login", methods=["POST", "OPTIONS"])
def admin_auth_login():
    if request.method == "OPTIONS":
        return ("", 204)

    body = request.get_json(silent=True) or {}
    username = body.get("username")
    password = body.get("password")

    authenticated_user = AdminAuthService.authenticate(username=username, password=password)
    if not authenticated_user:
        return jsonify({"error": "Invalid username or password."}), 401

    session["admin_user_id"] = authenticated_user["id"]
    session.modified = True
    return jsonify({"user": AdminAuthService.to_public_user(authenticated_user)}), 200


@app.route("/api/admin/auth/logout", methods=["POST", "OPTIONS"])
def admin_auth_logout():
    if request.method == "OPTIONS":
        return ("", 204)

    session.pop("admin_user_id", None)
    session.modified = True
    return jsonify({"ok": True}), 200


@app.route("/api/admin/auth/me", methods=["GET", "OPTIONS"])
def admin_auth_me():
    if request.method == "OPTIONS":
        return ("", 204)

    admin_user = _resolve_session_admin_user()
    if not admin_user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": AdminAuthService.to_public_user(admin_user)}), 200


@app.route("/api/admin/menu/reference-data", methods=["GET", "OPTIONS"])
@_require_admin_auth
def admin_menu_reference_data(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    data = AdminMenuService.get_reference_data()
    return jsonify(data), 200


@app.route("/api/admin/menu/items", methods=["GET", "POST", "OPTIONS"])
def admin_menu_items():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        admin_user = _resolve_session_admin_user()
        if not admin_user:
            return jsonify({"error": "Unauthorized"}), 401
        items = AdminMenuService.list_menu_items(
            search=request.args.get("search", ""),
            is_active=request.args.get("is_active"),
            limit=request.args.get("limit", 250),
        )
        return jsonify({"items": items}), 200

    body = request.get_json(silent=True) or {}

    # Prefer authenticated admin session for dashboard create workflow.
    admin_user = _resolve_session_admin_user()
    if admin_user:
        response_body, status_code = AdminMenuService.create_menu_item(body)
        if status_code < 400:
            AdminAuditService.log_change(
                admin_user_id=admin_user["id"],
                action="create",
                entity_type="menu_item",
                entity_id=response_body.get("item", {}).get("id"),
                change_summary=f"Created menu item '{response_body.get('item', {}).get('item_name', '')}'",
                before=None,
                after=response_body.get("item"),
            )
        return jsonify(response_body), status_code

    # Backward-compatible token flow for non-formal shared catalog upserts.
    auth_error, status_code = _require_admin_token()
    if auth_error:
        return jsonify(auth_error), status_code

    response_body, status_code = MenuService.upsert_non_formal_catalog_items(body)
    return jsonify(response_body), status_code


@app.route("/api/admin/menu/catalog-items", methods=["GET", "OPTIONS"])
@_require_admin_auth
def admin_menu_catalog_items(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    items = AdminMenuService.list_menu_items(
        search=request.args.get("search", ""),
        is_active=request.args.get("is_active"),
        limit=request.args.get("limit", 250),
    )
    return jsonify({"items": items}), 200


@app.route("/api/admin/menu/items/<int:item_id>", methods=["GET", "PATCH", "DELETE", "OPTIONS"])
@_require_admin_auth
def admin_menu_item_detail(item_id, admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        item = AdminMenuService.get_menu_item_detail(item_id)
        if not item:
            return jsonify({"error": "Menu item not found."}), 404
        return jsonify({"item": item}), 200

    before = AdminMenuService.get_menu_item_detail(item_id)
    if not before:
        return jsonify({"error": "Menu item not found."}), 404

    if request.method == "DELETE":
        response_body, status_code = AdminMenuService.delete_menu_item(item_id)
        if status_code < 400:
            AdminAuditService.log_change(
                admin_user_id=admin_user["id"],
                action="delete",
                entity_type="menu_item",
                entity_id=item_id,
                change_summary=f"Deleted menu item '{before.get('item_name', '')}'",
                before=before,
                after=None,
            )
        return jsonify(response_body), status_code

    response_body, status_code = AdminMenuService.update_menu_item(item_id, request.get_json(silent=True) or {})
    if status_code < 400:
        after = response_body.get("item")
        AdminAuditService.log_change(
            admin_user_id=admin_user["id"],
            action="update",
            entity_type="menu_item",
            entity_id=item_id,
            change_summary=f"Updated menu item '{after.get('item_name', '')}'",
            before=before,
            after=after,
        )
    return jsonify(response_body), status_code


@app.route("/api/admin/menu/sections", methods=["GET", "OPTIONS"])
@_require_admin_auth
def admin_menu_sections(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    sections = AdminMenuService.list_sections(
        search=request.args.get("search", ""),
        catalog_key=request.args.get("catalog_key", ""),
        is_active=request.args.get("is_active"),
        limit=request.args.get("limit", 250),
    )
    return jsonify({"sections": sections}), 200


@app.route("/api/admin/menu/sections/<int:section_id>", methods=["GET", "PATCH", "OPTIONS"])
@_require_admin_auth
def admin_menu_section_detail(section_id, admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        section = AdminMenuService.get_section_detail(section_id)
        if not section:
            return jsonify({"error": "Section not found."}), 404
        return jsonify({"section": section}), 200

    before = AdminMenuService.get_section_detail(section_id)
    if not before:
        return jsonify({"error": "Section not found."}), 404

    response_body, status_code = AdminMenuService.update_section(section_id, request.get_json(silent=True) or {})
    if status_code < 400:
        after = response_body.get("section")
        AdminAuditService.log_change(
            admin_user_id=admin_user["id"],
            action="update",
            entity_type="menu_section",
            entity_id=section_id,
            change_summary=f"Updated section '{after.get('title', '')}'",
            before=before,
            after=after,
        )
    return jsonify(response_body), status_code


@app.route("/api/admin/media", methods=["GET", "OPTIONS"])
@_require_admin_auth
def admin_media_list(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    media_items = AdminMediaService.list_media(
        search=request.args.get("search", ""),
        media_type=request.args.get("media_type", ""),
        is_active=_bool_query_param("is_active", default=None),
        is_slide=_bool_query_param("is_slide", default=None),
        limit=request.args.get("limit", 400),
    )
    return jsonify({"media": media_items}), 200


@app.route("/api/admin/media/upload", methods=["POST", "OPTIONS"])
@_require_admin_auth
def admin_media_upload(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    uploaded_file = request.files.get("file")
    if uploaded_file is None or not str(uploaded_file.filename or "").strip():
        return jsonify({"error": "Media file is required."}), 400

    media_type = AdminMediaService.infer_media_type_from_filename(uploaded_file.filename)
    if media_type not in ("image", "video"):
        return jsonify({"error": "Unsupported file type. Allowed: image and video formats."}), 400

    SLIDES_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    normalized_filename = _sanitize_upload_filename(uploaded_file.filename)
    saved_path = SLIDES_ASSET_DIR / normalized_filename
    uploaded_file.save(saved_path)

    create_payload = {
        "title": request.form.get("title"),
        "caption": request.form.get("caption"),
        "is_slide": request.form.get("is_slide"),
        "is_active": request.form.get("is_active", "true"),
        "display_order": request.form.get("display_order"),
        "image_url": f"/api/assets/slides/{normalized_filename}",
        "media_type": media_type,
    }
    response_body, status_code = AdminMediaService.create_media_record(create_payload)
    if status_code >= 400:
        try:
            if saved_path.exists():
                saved_path.unlink()
        except Exception:
            pass
        return jsonify(response_body), status_code

    media_item = response_body.get("media", {})
    AdminAuditService.log_change(
        admin_user_id=admin_user["id"],
        action="create",
        entity_type="media",
        entity_id=media_item.get("id"),
        change_summary=f"Uploaded media '{media_item.get('title', normalized_filename)}'",
        before=None,
        after=media_item,
    )
    return jsonify(response_body), status_code


@app.route("/api/admin/media/<int:media_id>", methods=["PATCH", "OPTIONS"])
@_require_admin_auth
def admin_media_update(media_id, admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    before = AdminMediaService.get_media_by_id(media_id)
    if not before:
        return jsonify({"error": "Media item not found."}), 404

    response_body, status_code = AdminMediaService.update_media(media_id, request.get_json(silent=True) or {})
    if status_code < 400:
        after = response_body.get("media")
        AdminAuditService.log_change(
            admin_user_id=admin_user["id"],
            action="update",
            entity_type="media",
            entity_id=media_id,
            change_summary=f"Updated media '{after.get('title', '')}'",
            before=before,
            after=after,
        )
    return jsonify(response_body), status_code


@app.route("/api/admin/media/reorder-slides", methods=["PATCH", "OPTIONS"])
@_require_admin_auth
def admin_media_reorder_slides(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    before = AdminMediaService.list_media(is_slide=True, limit=2000)
    response_body, status_code = AdminMediaService.reorder_slide_items(request.get_json(silent=True) or {})
    if status_code < 400:
        after = response_body.get("slides") or []
        AdminAuditService.log_change(
            admin_user_id=admin_user["id"],
            action="reorder",
            entity_type="media",
            entity_id="slides",
            change_summary="Reordered homepage slides",
            before=[{"id": row.get("id"), "display_order": row.get("display_order")} for row in before],
            after=[{"id": row.get("id"), "display_order": row.get("display_order")} for row in after],
        )
    return jsonify(response_body), status_code


@app.route("/api/admin/audit", methods=["GET", "OPTIONS"])
@_require_admin_auth
def admin_audit_log(admin_user=None):
    if request.method == "OPTIONS":
        return ("", 204)

    entries = AdminAuditService.get_recent_entries(limit=request.args.get("limit", 100))
    return jsonify({"entries": entries}), 200


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
