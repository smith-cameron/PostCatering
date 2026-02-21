import argparse
import json
import sys
from pathlib import Path


def _bootstrap_path():
    script_path = Path(__file__).resolve()
    api_root = script_path.parents[1]
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))


def _parse_args():
    parser = argparse.ArgumentParser(description="Run menu schema migration/reset/seed tasks on demand.")
    parser.add_argument(
        "--apply-schema",
        action="store_true",
        help="Apply api/sql/schema.sql statements before seed/reset actions.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Truncate simplified menu tables before seeding.",
    )
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="Skip seed operation (default behavior is to seed).",
    )
    return parser.parse_args()


def main():
    _bootstrap_path()
    from flask_api.services.menu_service import MenuService

    args = _parse_args()
    body, status = MenuService.run_menu_admin_task(
        apply_schema=args.apply_schema,
        reset=args.reset,
        seed=not args.no_seed,
    )
    print(json.dumps({"status": status, **body}, indent=2))
    return 0 if status < 400 else 1


if __name__ == "__main__":
    raise SystemExit(main())
