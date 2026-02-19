import json
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

PLACEHOLDER_TITLE = "placeholder title"
PLACEHOLDER_TEXT = "placeholder text"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


def _bootstrap_path():
    script_path = Path(__file__).resolve()
    api_root = script_path.parents[1]
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))
    return api_root


def _filename_from_url(image_url):
    if not image_url:
        return ""
    parsed = urlparse(image_url)
    return unquote(Path(parsed.path).name)


def _infer_media_type(filename):
    extension = Path(filename or "").suffix.lower()
    if extension in VIDEO_EXTENSIONS:
        return "video"
    if extension in IMAGE_EXTENSIONS:
        return "image"
    return "image"


def _is_filename_like(value, filename=""):
    normalized = str(value or "").strip().lower()
    if not normalized:
        return False
    if "/api/assets/slides/" in normalized:
        return True

    filename_normalized = str(filename or "").strip().lower()
    filename_stem = Path(filename_normalized).stem if filename_normalized else ""
    if normalized in {filename_normalized, filename_stem}:
        return True

    suffix = Path(normalized).suffix.lower()
    return bool(suffix and suffix in SUPPORTED_EXTENSIONS)


def _asset_url(filename):
    return f"/api/assets/slides/{filename}"


def _resolve_filename(filename, asset_names):
    if not filename:
        return ""
    if filename in asset_names:
        return filename
    lowered_filename = filename.lower()
    matches = sorted(
        (asset_name for asset_name in asset_names if asset_name.lower().endswith(lowered_filename)),
        key=lambda name: (len(name), name.lower()),
    )
    return matches[0] if matches else filename


def _update_row(connection, row, asset_names):
    from flask_api.config.mysqlconnection import query_db

    row_id = row["id"]
    current_filename = _filename_from_url(row.get("image_url"))
    resolved_filename = _resolve_filename(current_filename, asset_names)
    normalized_title = str(row.get("title") or "").strip()
    normalized_caption = str(row.get("caption") or "").strip()
    normalized_alt = str(row.get("alt_text") or "").strip()

    next_image_url = _asset_url(resolved_filename) if resolved_filename else (row.get("image_url") or "")
    next_media_type = (row.get("media_type") or "").strip() or _infer_media_type(resolved_filename)
    next_title = normalized_title
    if not next_title or _is_filename_like(next_title, resolved_filename):
        next_title = PLACEHOLDER_TITLE
    next_caption = normalized_caption
    if not next_caption or _is_filename_like(next_caption, resolved_filename):
        next_caption = PLACEHOLDER_TEXT
    next_alt = normalized_alt
    if not next_alt or _is_filename_like(next_alt, resolved_filename):
        next_alt = next_title

    updates = {}
    if str(row.get("image_url") or "") != next_image_url and next_image_url:
        updates["image_url"] = next_image_url
    if str(row.get("media_type") or "") != next_media_type:
        updates["media_type"] = next_media_type
    if str(row.get("title") or "") != next_title:
        updates["title"] = next_title
    if str(row.get("caption") or "") != next_caption:
        updates["caption"] = next_caption
    if str(row.get("alt_text") or "") != next_alt:
        updates["alt_text"] = next_alt

    if not updates:
        return False, resolved_filename

    assignments = ", ".join(f"{column} = %s" for column in updates)
    values = [*updates.values(), row_id]
    query_db(
        f"UPDATE slides SET {assignments} WHERE id = %s;",
        tuple(values),
        connection=connection,
        auto_commit=False,
    )
    return True, resolved_filename


def main():
    api_root = _bootstrap_path()
    from flask_api.config.mysqlconnection import db_transaction, query_db

    slides_dir = api_root / "flask_api" / "static" / "slides"
    asset_names = sorted(
        asset.name for asset in slides_dir.iterdir() if asset.is_file() and asset.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    with db_transaction() as connection:
        has_media_type = bool(
            query_db(
                "SHOW COLUMNS FROM slides LIKE 'media_type';",
                connection=connection,
                auto_commit=False,
            )
        )
        has_is_slide = bool(
            query_db(
                "SHOW COLUMNS FROM slides LIKE 'is_slide';",
                connection=connection,
                auto_commit=False,
            )
        )
        if not has_media_type:
            query_db(
                "ALTER TABLE slides ADD COLUMN media_type ENUM('image', 'video') NOT NULL DEFAULT 'image' AFTER image_url;",
                connection=connection,
                auto_commit=False,
            )
        if not has_is_slide:
            query_db(
                "ALTER TABLE slides ADD COLUMN is_slide TINYINT(1) NOT NULL DEFAULT 0 AFTER display_order;",
                connection=connection,
                auto_commit=False,
            )
            query_db(
                "UPDATE slides SET is_slide = 1 WHERE is_active = 1 ORDER BY display_order ASC, id ASC LIMIT 5;",
                connection=connection,
                auto_commit=False,
            )

        rows = query_db(
            """
            SELECT
              id,
              title,
              caption,
              image_url,
              alt_text,
              display_order,
              is_slide,
              is_active,
              media_type
            FROM slides
            ORDER BY display_order ASC, id ASC;
            """,
            connection=connection,
            auto_commit=False,
        )

        referenced_assets = set()
        updated_rows = 0
        for row in rows:
            row_changed, resolved_filename = _update_row(connection, row, asset_names)
            if resolved_filename:
                referenced_assets.add(resolved_filename)
            if row_changed:
                updated_rows += 1

        max_display_order = max((int(row.get("display_order") or 0) for row in rows), default=0)
        inserted_rows = 0
        for asset_name in asset_names:
            if asset_name in referenced_assets:
                continue

            max_display_order += 1
            query_db(
                """
                INSERT INTO slides (
                  title,
                  caption,
                  image_url,
                  media_type,
                  alt_text,
                  display_order,
                  is_slide,
                  is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    PLACEHOLDER_TITLE,
                    PLACEHOLDER_TEXT,
                    _asset_url(asset_name),
                    _infer_media_type(asset_name),
                    PLACEHOLDER_TITLE,
                    max_display_order,
                    0,
                    1,
                ),
                connection=connection,
                auto_commit=False,
            )
            inserted_rows += 1

    print(
        json.dumps(
            {
                "updated_rows": updated_rows,
                "inserted_rows": inserted_rows,
                "total_assets_scanned": len(asset_names),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
