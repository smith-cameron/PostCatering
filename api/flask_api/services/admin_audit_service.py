import json

from flask_api.config.mysqlconnection import query_db


class AdminAuditService:
    @staticmethod
    def _json_dump(value):
        if value is None:
            return None
        return json.dumps(value, ensure_ascii=False)

    @classmethod
    def log_change(
        cls,
        admin_user_id,
        action,
        entity_type,
        entity_id=None,
        change_summary=None,
        before=None,
        after=None,
        connection=None,
    ):
        try:
            normalized_admin_id = int(admin_user_id)
        except (TypeError, ValueError):
            return None

        return query_db(
            """
      INSERT INTO admin_audit_log (
        admin_user_id,
        action,
        entity_type,
        entity_id,
        change_summary,
        before_json,
        after_json
      )
      VALUES (
        %(admin_user_id)s,
        %(action)s,
        %(entity_type)s,
        %(entity_id)s,
        %(change_summary)s,
        %(before_json)s,
        %(after_json)s
      );
      """,
            {
                "admin_user_id": normalized_admin_id,
                "action": str(action or "").strip()[:64],
                "entity_type": str(entity_type or "").strip()[:64],
                "entity_id": str(entity_id)[:128] if entity_id is not None else None,
                "change_summary": (str(change_summary).strip()[:255] if change_summary else None),
                "before_json": cls._json_dump(before),
                "after_json": cls._json_dump(after),
            },
            fetch="none",
            connection=connection,
            auto_commit=connection is None,
        )

    @staticmethod
    def get_recent_entries(limit=100):
        try:
            normalized_limit = max(1, min(int(limit), 500))
        except (TypeError, ValueError):
            normalized_limit = 100

        rows = query_db(
            """
      SELECT
        l.id,
        l.action,
        l.entity_type,
        l.entity_id,
        l.change_summary,
        l.before_json,
        l.after_json,
        l.created_at,
        u.username,
        u.display_name
      FROM admin_audit_log l
      JOIN admin_users u ON u.id = l.admin_user_id
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT %(limit)s;
      """,
            {"limit": normalized_limit},
        )

        payload = []
        for row in rows:
            payload.append(
                {
                    "id": row.get("id"),
                    "action": row.get("action"),
                    "entity_type": row.get("entity_type"),
                    "entity_id": row.get("entity_id"),
                    "change_summary": row.get("change_summary"),
                    "before_json": row.get("before_json"),
                    "after_json": row.get("after_json"),
                    "created_at": (
                        row.get("created_at").isoformat() if hasattr(row.get("created_at"), "isoformat") else None
                    ),
                    "admin_username": row.get("username"),
                    "admin_display_name": row.get("display_name"),
                }
            )
        return payload
