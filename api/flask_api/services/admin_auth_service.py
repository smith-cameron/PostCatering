import re

from flask_api.config.mysqlconnection import query_db
from werkzeug.security import check_password_hash, generate_password_hash


class AdminAuthService:
    USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]+$")

    @staticmethod
    def _normalize_username(value):
        return str(value or "").strip().lower()

    @staticmethod
    def _to_bool(value, default=True):
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        return default

    @classmethod
    def get_user_by_username(cls, username):
        normalized_username = cls._normalize_username(username)
        if not normalized_username:
            return None

        return query_db(
            """
      SELECT
        id,
        username,
        password_hash,
        display_name,
        is_active,
        last_login_at
      FROM admin_users
      WHERE username = %(username)s
      LIMIT 1;
      """,
            {"username": normalized_username},
            fetch="one",
        )

    @staticmethod
    def get_user_by_id(admin_user_id):
        try:
            normalized_id = int(admin_user_id)
        except (TypeError, ValueError):
            return None

        return query_db(
            """
      SELECT
        id,
        username,
        display_name,
        is_active,
        last_login_at
      FROM admin_users
      WHERE id = %(id)s
      LIMIT 1;
      """,
            {"id": normalized_id},
            fetch="one",
        )

    @staticmethod
    def get_user_with_password_by_id(admin_user_id):
        try:
            normalized_id = int(admin_user_id)
        except (TypeError, ValueError):
            return None

        return query_db(
            """
      SELECT
        id,
        username,
        password_hash,
        display_name,
        is_active,
        last_login_at
      FROM admin_users
      WHERE id = %(id)s
      LIMIT 1;
      """,
            {"id": normalized_id},
            fetch="one",
        )

    @staticmethod
    def to_public_user(user_row):
        if not user_row:
            return None

        return {
            "id": user_row.get("id"),
            "username": user_row.get("username"),
            "display_name": user_row.get("display_name"),
            "is_active": bool(user_row.get("is_active", 0)),
            "last_login_at": (
                user_row.get("last_login_at").isoformat()
                if hasattr(user_row.get("last_login_at"), "isoformat")
                else None
            ),
        }

    @classmethod
    def authenticate(cls, username, password):
        if not str(password or "").strip():
            return None

        user = cls.get_user_by_username(username)
        if not user or not bool(user.get("is_active", 0)):
            return None

        password_hash = str(user.get("password_hash") or "")
        if not password_hash:
            return None

        if not check_password_hash(password_hash, str(password)):
            return None

        query_db(
            """
      UPDATE admin_users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = %(id)s;
      """,
            {"id": user["id"]},
            fetch="none",
        )
        return cls.get_user_by_id(user["id"])

    @classmethod
    def update_user_profile(cls, admin_user_id, body):
        body = body or {}
        current_user = cls.get_user_with_password_by_id(admin_user_id)
        if not current_user or not bool(current_user.get("is_active", 0)):
            return {"error": "Unauthorized"}, 401

        requested_username = cls._normalize_username(body.get("username"))
        requested_display_name = str(body.get("display_name") or "").strip() or None
        current_password = str(body.get("current_password") or "")
        new_password = str(body.get("new_password") or "")
        confirm_password = str(body.get("confirm_password") or "")
        password_hash = str(current_user.get("password_hash") or "")
        current_username = cls._normalize_username(current_user.get("username"))
        is_password_change_requested = bool(current_password or new_password or confirm_password)

        errors = []
        if not requested_username:
            errors.append("Username is required.")
        elif len(requested_username) < 3:
            errors.append("Username must be at least 3 characters.")
        elif len(requested_username) > 120:
            errors.append("Username must be 120 characters or fewer.")
        elif not cls.USERNAME_PATTERN.fullmatch(requested_username):
            errors.append("Username may only include lowercase letters, numbers, periods, underscores, and hyphens.")

        if requested_display_name and len(requested_display_name) > 150:
            errors.append("Display name must be 150 characters or fewer.")

        if requested_username and requested_username != current_username:
            existing_user = cls.get_user_by_username(requested_username)
            if existing_user and int(existing_user.get("id") or 0) != int(current_user.get("id") or 0):
                errors.append("Username is already in use.")

        if is_password_change_requested:
            if not current_password:
                errors.append("Current password is required to change password.")
            elif not password_hash or not check_password_hash(password_hash, current_password):
                errors.append("Current password is incorrect.")

            if not new_password:
                errors.append("New password is required.")
            elif len(new_password) < 10:
                errors.append("New password must be at least 10 characters.")

            if not confirm_password:
                errors.append("Confirm password is required.")
            elif new_password and new_password != confirm_password:
                errors.append("New password and confirm password must match.")

            if current_password and new_password and current_password == new_password:
                errors.append("New password must be different from current password.")

        if errors:
            return {"errors": errors}, 400

        update_payload = {
            "id": current_user["id"],
            "username": requested_username,
            "display_name": requested_display_name,
        }

        if is_password_change_requested:
            update_payload["password_hash"] = generate_password_hash(new_password)
            query_db(
                """
      UPDATE admin_users
      SET
        username = %(username)s,
        display_name = %(display_name)s,
        password_hash = %(password_hash)s,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = %(id)s;
      """,
                update_payload,
                fetch="none",
            )
        else:
            query_db(
                """
      UPDATE admin_users
      SET
        username = %(username)s,
        display_name = %(display_name)s,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = %(id)s;
      """,
                update_payload,
                fetch="none",
            )

        updated_user = cls.get_user_by_id(current_user["id"])
        return {"user": cls.to_public_user(updated_user)}, 200

    @classmethod
    def create_admin_user(cls, body):
        body = body or {}
        requested_username = cls._normalize_username(body.get("username"))
        requested_display_name = str(body.get("display_name") or "").strip() or None
        requested_password = str(body.get("password") or "")
        confirm_password = str(body.get("confirm_password") or "")
        is_active = cls._to_bool(body.get("is_active"), default=True)

        errors = []
        if not requested_username:
            errors.append("Username is required.")
        elif len(requested_username) < 3:
            errors.append("Username must be at least 3 characters.")
        elif len(requested_username) > 120:
            errors.append("Username must be 120 characters or fewer.")
        elif not cls.USERNAME_PATTERN.fullmatch(requested_username):
            errors.append("Username may only include lowercase letters, numbers, periods, underscores, and hyphens.")

        if requested_display_name and len(requested_display_name) > 150:
            errors.append("Display name must be 150 characters or fewer.")

        if requested_username:
            existing_user = cls.get_user_by_username(requested_username)
            if existing_user:
                errors.append("Username is already in use.")

        if not requested_password:
            errors.append("Password is required.")
        elif len(requested_password) < 10:
            errors.append("Password must be at least 10 characters.")

        if not confirm_password:
            errors.append("Confirm password is required.")
        elif requested_password and confirm_password != requested_password:
            errors.append("Password and confirm password must match.")

        if errors:
            return {"errors": errors}, 400

        try:
            query_db(
                """
      INSERT INTO admin_users (
        username,
        password_hash,
        display_name,
        is_active
      )
      VALUES (
        %(username)s,
        %(password_hash)s,
        %(display_name)s,
        %(is_active)s
      );
      """,
                {
                    "username": requested_username,
                    "password_hash": generate_password_hash(requested_password),
                    "display_name": requested_display_name,
                    "is_active": 1 if is_active else 0,
                },
                fetch="none",
            )
        except Exception as error:
            error_text = str(error).lower()
            if "duplicate" in error_text or "uq_admin_users_username" in error_text:
                return {"errors": ["Username is already in use."]}, 400
            raise

        created_user = cls.get_user_by_username(requested_username)
        if not created_user:
            return {"error": "Unable to create admin user."}, 500
        created_user_public = cls.get_user_by_id(created_user.get("id"))
        return {"user": cls.to_public_user(created_user_public)}, 201
