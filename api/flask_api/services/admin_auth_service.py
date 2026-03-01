import re

from flask_api.config.mysqlconnection import query_db
from werkzeug.security import check_password_hash, generate_password_hash


class AdminAuthService:
    USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]+$")
    ACCESS_TIER_OWNER = 0
    ACCESS_TIER_MANAGER = 1
    ACCESS_TIER_OPERATOR = 2

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
    def _normalize_access_tier(cls, value, default=ACCESS_TIER_MANAGER):
        try:
            normalized = int(value)
        except (TypeError, ValueError):
            return default
        if normalized in {cls.ACCESS_TIER_OWNER, cls.ACCESS_TIER_MANAGER, cls.ACCESS_TIER_OPERATOR}:
            return normalized
        return default

    @classmethod
    def _has_delegated_admin_user_management(cls, user_row):
        if not user_row:
            return False
        return (
            cls._normalize_access_tier(
                user_row.get("access_tier"),
                default=cls.ACCESS_TIER_MANAGER,
            )
            == cls.ACCESS_TIER_MANAGER
            and bool(user_row.get("can_manage_admin_users", 0))
        )

    @classmethod
    def _resolve_user_management_actor(cls, requesting_admin_user_id):
        actor = cls.get_user_by_id(requesting_admin_user_id)
        if not actor or not bool(actor.get("is_active", 0)):
            return None, {"error": "Unauthorized"}, 401

        actor_tier = cls._normalize_access_tier(
            actor.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        )
        if actor_tier == cls.ACCESS_TIER_OWNER or cls._has_delegated_admin_user_management(actor):
            return actor, None, 200
        return None, {"error": "Forbidden"}, 403

    @classmethod
    def _has_other_delegated_admin_manager(cls, exclude_user_id=None):
        payload = {"access_tier": cls.ACCESS_TIER_MANAGER}
        where_clause = "access_tier = %(access_tier)s AND can_manage_admin_users = 1"
        if exclude_user_id is not None:
            payload["exclude_id"] = int(exclude_user_id)
            where_clause += " AND id <> %(exclude_id)s"

        row = query_db(
            f"""
      SELECT COUNT(*) AS delegated_count
      FROM admin_users
      WHERE {where_clause};
      """,
            payload,
            fetch="one",
        )
        return int((row or {}).get("delegated_count") or 0) > 0

    @classmethod
    def _to_managed_user(cls, user_row):
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
            "access_tier": cls._normalize_access_tier(
                user_row.get("access_tier"),
                default=cls.ACCESS_TIER_MANAGER,
            ),
            "is_delete_protected": bool(user_row.get("is_delete_protected", 0)),
            "can_manage_admin_users": bool(user_row.get("can_manage_admin_users", 0)),
        }

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
        access_tier,
        is_active,
        is_delete_protected,
        can_manage_admin_users,
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
        access_tier,
        is_active,
        is_delete_protected,
        can_manage_admin_users,
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
        access_tier,
        is_active,
        is_delete_protected,
        can_manage_admin_users,
        last_login_at
      FROM admin_users
      WHERE id = %(id)s
      LIMIT 1;
      """,
            {"id": normalized_id},
            fetch="one",
        )

    @classmethod
    def to_public_user(cls, user_row):
        if not user_row:
            return None

        return {
            "id": user_row.get("id"),
            "username": user_row.get("username"),
            "display_name": user_row.get("display_name"),
            "is_active": bool(user_row.get("is_active", 0)),
            "access_tier": cls._normalize_access_tier(
                user_row.get("access_tier"),
                default=cls.ACCESS_TIER_MANAGER,
            ),
            "is_delete_protected": bool(user_row.get("is_delete_protected", 0)),
            "can_manage_admin_users": bool(user_row.get("can_manage_admin_users", 0)),
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
    def create_admin_user(cls, requesting_admin_user_id, body):
        body = body or {}
        actor, auth_error, status_code = cls._resolve_user_management_actor(requesting_admin_user_id)
        if auth_error:
            return auth_error, status_code

        actor_is_owner = cls._normalize_access_tier(
            actor.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        ) == cls.ACCESS_TIER_OWNER
        requested_username = cls._normalize_username(body.get("username"))
        requested_display_name = str(body.get("display_name") or "").strip() or None
        requested_password = str(body.get("password") or "")
        confirm_password = str(body.get("confirm_password") or "")
        is_active = cls._to_bool(body.get("is_active"), default=True)
        requested_access_tier = cls._normalize_access_tier(
            body.get("access_tier"),
            default=cls.ACCESS_TIER_OPERATOR,
        )
        is_delete_protected = cls._to_bool(body.get("is_delete_protected"), default=False)
        can_manage_admin_users = cls._to_bool(body.get("can_manage_admin_users"), default=False)

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

        if "access_tier" in body:
            raw_access_tier = str(body.get("access_tier") or "").strip()
            if raw_access_tier and raw_access_tier not in {"1", "2"}:
                errors.append("Access tier must be one of 1 or 2.")

        if can_manage_admin_users:
            if not actor_is_owner:
                errors.append("Only tier 0 can grant delegated admin management.")
            elif requested_access_tier != cls.ACCESS_TIER_MANAGER:
                errors.append("Delegated admin management requires tier 1 access.")
            elif cls._has_other_delegated_admin_manager():
                errors.append("Only one delegated admin manager is allowed.")

        if errors:
            return {"errors": errors}, 400

        try:
            query_db(
                """
      INSERT INTO admin_users (
        username,
        password_hash,
        display_name,
        access_tier,
        is_active,
        can_manage_admin_users
      )
      VALUES (
        %(username)s,
        %(password_hash)s,
        %(display_name)s,
        %(access_tier)s,
        %(is_active)s,
        %(can_manage_admin_users)s
      );
      """,
                {
                    "username": requested_username,
                    "password_hash": generate_password_hash(requested_password),
                    "display_name": requested_display_name,
                    "access_tier": requested_access_tier,
                    "is_active": 1 if is_active else 0,
                    "can_manage_admin_users": 1 if can_manage_admin_users else 0,
                },
                fetch="none",
            )

            if is_delete_protected:
                query_db(
                    """
      UPDATE admin_users
      SET is_delete_protected = 1
      WHERE username = %(username)s;
      """,
                    {"username": requested_username},
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

    @classmethod
    def list_admin_users(cls, requesting_admin_user_id):
        actor, auth_error, status_code = cls._resolve_user_management_actor(requesting_admin_user_id)
        if auth_error:
            return auth_error, status_code

        actor_is_owner = cls._normalize_access_tier(
            actor.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        ) == cls.ACCESS_TIER_OWNER

        rows = query_db(
            """
      SELECT
        id,
        username,
        display_name,
        access_tier,
        is_active,
        is_delete_protected,
        can_manage_admin_users,
        last_login_at
      FROM admin_users
      WHERE (%(is_owner)s = 1 OR access_tier <> %(owner_tier)s)
      ORDER BY access_tier ASC, username ASC, id ASC;
      """,
            {
                "is_owner": 1 if actor_is_owner else 0,
                "owner_tier": cls.ACCESS_TIER_OWNER,
            },
        )
        return {"users": [cls._to_managed_user(row) for row in rows]}, 200

    @classmethod
    def update_admin_user(cls, requesting_admin_user_id, managed_admin_user_id, body):
        body = body or {}
        actor, auth_error, status_code = cls._resolve_user_management_actor(requesting_admin_user_id)
        if auth_error:
            return auth_error, status_code

        actor_tier = cls._normalize_access_tier(
            actor.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        )
        actor_is_owner = actor_tier == cls.ACCESS_TIER_OWNER

        target = cls.get_user_by_id(managed_admin_user_id)
        if not target:
            return {"error": "Admin user not found."}, 404

        target_tier = cls._normalize_access_tier(
            target.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        )
        target_is_owner = target_tier == cls.ACCESS_TIER_OWNER
        target_is_delegated_manager = cls._has_delegated_admin_user_management(target)
        if not actor_is_owner and target_is_owner:
            return {"error": "Only tier 0 can modify tier 0 accounts."}, 403
        if not actor_is_owner and target_is_delegated_manager:
            return {"error": "Only tier 0 can modify the delegated admin manager account."}, 403

        next_is_active = target.get("is_active")
        if "is_active" in body:
            next_is_active = cls._to_bool(body.get("is_active"), default=bool(target.get("is_active", 0)))
            if int(target.get("id") or 0) == int(actor.get("id") or 0) and not bool(next_is_active):
                return {"error": "Current account cannot be deactivated."}, 400

        next_access_tier = target_tier
        if "access_tier" in body:
            raw_access_tier = str(body.get("access_tier") or "").strip()
            if raw_access_tier not in {"1", "2"}:
                return {"error": "Access tier must be one of 1 or 2."}, 400
            if target_is_owner:
                return {"error": "Tier 0 access cannot be changed from admin user management."}, 400
            next_access_tier = cls._normalize_access_tier(raw_access_tier, default=target_tier)
            if not actor_is_owner and next_access_tier == cls.ACCESS_TIER_OWNER:
                return {"error": "Only tier 0 can assign tier 0 access."}, 403

        next_can_manage_admin_users = bool(target.get("can_manage_admin_users", 0))
        if "can_manage_admin_users" in body:
            if not actor_is_owner:
                return {"error": "Only tier 0 can change delegated admin management."}, 403
            if target_is_owner:
                return {"error": "Tier 0 cannot be marked as the delegated admin manager."}, 400

            next_can_manage_admin_users = cls._to_bool(
                body.get("can_manage_admin_users"),
                default=bool(target.get("can_manage_admin_users", 0)),
            )
            if next_can_manage_admin_users and next_access_tier != cls.ACCESS_TIER_MANAGER:
                return {"error": "Delegated admin management requires tier 1 access."}, 400
            if next_can_manage_admin_users and cls._has_other_delegated_admin_manager(exclude_user_id=target["id"]):
                return {"error": "Only one delegated admin manager is allowed."}, 400

        if next_access_tier != cls.ACCESS_TIER_MANAGER:
            next_can_manage_admin_users = False

        query_db(
            """
      UPDATE admin_users
      SET
        access_tier = %(access_tier)s,
        is_active = %(is_active)s,
        can_manage_admin_users = %(can_manage_admin_users)s,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = %(id)s;
      """,
            {
                "id": target["id"],
                "access_tier": next_access_tier,
                "is_active": 1 if bool(next_is_active) else 0,
                "can_manage_admin_users": 1 if next_can_manage_admin_users else 0,
            },
            fetch="none",
        )

        updated = cls.get_user_by_id(target["id"])
        return {"user": cls._to_managed_user(updated)}, 200

    @classmethod
    def delete_admin_user(cls, requesting_admin_user_id, managed_admin_user_id):
        actor, auth_error, status_code = cls._resolve_user_management_actor(requesting_admin_user_id)
        if auth_error:
            return auth_error, status_code

        actor_tier = cls._normalize_access_tier(
            actor.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        )
        actor_is_owner = actor_tier == cls.ACCESS_TIER_OWNER

        target = cls.get_user_by_id(managed_admin_user_id)
        if not target:
            return {"error": "Admin user not found."}, 404

        if int(target.get("id") or 0) == int(actor.get("id") or 0):
            return {"error": "Current account cannot be deleted."}, 400

        target_tier = cls._normalize_access_tier(
            target.get("access_tier"),
            default=cls.ACCESS_TIER_MANAGER,
        )
        if target_tier == cls.ACCESS_TIER_OWNER:
            return {"error": "Tier 0 accounts cannot be deleted from admin user management."}, 400
        if not actor_is_owner and cls._has_delegated_admin_user_management(target):
            return {"error": "Only tier 0 can delete the delegated admin manager account."}, 403
        if actor_tier == cls.ACCESS_TIER_MANAGER and bool(target.get("is_delete_protected", 0)):
            return {"error": "Tier 1 users cannot delete protected admin accounts."}, 403

        active_remaining_row = query_db(
            """
      SELECT COUNT(*) AS active_remaining
      FROM admin_users
      WHERE id <> %(id)s
        AND is_active = 1;
      """,
            {"id": target["id"]},
            fetch="one",
        )
        active_remaining = int((active_remaining_row or {}).get("active_remaining") or 0)
        if active_remaining <= 0:
            return {"error": "At least one active admin account is required."}, 400

        query_db(
            """
      DELETE FROM admin_users
      WHERE id = %(id)s
      LIMIT 1;
      """,
            {"id": target["id"]},
            fetch="none",
        )
        return {
            "ok": True,
            "deleted_user_id": target.get("id"),
            "username": target.get("username"),
        }, 200
