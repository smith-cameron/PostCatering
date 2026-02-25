import argparse
import getpass
import sys
from pathlib import Path

from werkzeug.security import generate_password_hash


def _bootstrap_path():
    script_path = Path(__file__).resolve()
    api_root = script_path.parents[1]
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))


def _parse_args():
    parser = argparse.ArgumentParser(description="Create or update an admin user for dashboard authentication.")
    parser.add_argument("--username", required=True, help="Admin username (stored lowercase).")
    parser.add_argument("--display-name", default="", help="Optional display name for audit logs.")
    parser.add_argument("--password", default="", help="Password. If omitted, an interactive prompt is used.")
    parser.add_argument(
        "--inactive",
        action="store_true",
        help="Create/update the user as inactive.",
    )
    return parser.parse_args()


def _validate_password_strength(password):
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters.")
    return password


def _resolve_password(password_arg):
    if str(password_arg or "").strip():
        return _validate_password_strength(str(password_arg))

    first = getpass.getpass("Password: ")
    second = getpass.getpass("Confirm Password: ")
    if first != second:
        raise ValueError("Passwords do not match.")
    return _validate_password_strength(first)


def main():
    _bootstrap_path()
    from flask_api.config.mysqlconnection import query_db

    args = _parse_args()
    username = str(args.username or "").strip().lower()
    if not username:
        print("username is required.")
        return 1

    try:
        password = _resolve_password(args.password)
    except ValueError as error:
        print(str(error))
        return 1

    password_hash = generate_password_hash(password)
    display_name = str(args.display_name or "").strip() or None
    is_active = 0 if args.inactive else 1

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
      )
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        display_name = VALUES(display_name),
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP;
      """,
            {
                "username": username,
                "password_hash": password_hash,
                "display_name": display_name,
                "is_active": is_active,
            },
            fetch="none",
        )
    except Exception as error:
        print(f"Failed to create/update admin user: {error}")
        return 1

    print(f"Admin user upserted: {username}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
