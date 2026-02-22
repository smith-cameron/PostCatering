from flask_api.config.mysqlconnection import query_db
from werkzeug.security import check_password_hash


class AdminAuthService:
    @staticmethod
    def _normalize_username(value):
        return str(value or "").strip().lower()

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
