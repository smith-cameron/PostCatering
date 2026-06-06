from pathlib import Path, PurePosixPath
from urllib.parse import unquote

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - production installs Pillow via requirements.
    Image = None
    ImageOps = None


class MediaAssetService:
    LOCAL_MEDIA_PREFIX = "/api/assets/slides/"
    LOCAL_MEDIA_DIR = Path(__file__).resolve().parent.parent / "static" / "slides"
    THUMBNAIL_DIR_NAME = "thumbs"
    THUMBNAIL_MAX_SIZE = (640, 640)
    THUMBNAIL_QUALITY = 82

    @classmethod
    def resolve_local_asset_path(cls, asset_url):
        normalized_url = str(asset_url or "").split("?", 1)[0].split("#", 1)[0].strip()
        if not normalized_url.startswith(cls.LOCAL_MEDIA_PREFIX):
            return None

        relative_path = unquote(normalized_url[len(cls.LOCAL_MEDIA_PREFIX) :]).replace("\\", "/").strip("/")
        if not relative_path:
            return None

        path_parts = [part for part in PurePosixPath(relative_path).parts if part not in ("", ".")]
        if not path_parts or any(part == ".." for part in path_parts):
            return None

        media_root = cls.LOCAL_MEDIA_DIR.resolve()
        candidate_path = (media_root / Path(*path_parts)).resolve()
        try:
            candidate_path.relative_to(media_root)
        except ValueError:
            return None
        return candidate_path

    @classmethod
    def thumbnail_url_for_image_url(cls, image_url, media_type="image"):
        if str(media_type or "").strip().lower() != "image":
            return str(image_url or "").strip()
        if Image is None or ImageOps is None:
            return str(image_url or "").strip()

        source_path = cls.resolve_local_asset_path(image_url)
        if source_path is None or not source_path.is_file():
            return str(image_url or "").strip()

        try:
            relative_source = source_path.relative_to(cls.LOCAL_MEDIA_DIR.resolve())
        except ValueError:
            return str(image_url or "").strip()
        if relative_source.parts and relative_source.parts[0] == cls.THUMBNAIL_DIR_NAME:
            return str(image_url or "").strip()

        thumbnail_relative = cls._thumbnail_relative_path(relative_source)
        thumbnail_path = cls.LOCAL_MEDIA_DIR / thumbnail_relative
        if cls._ensure_thumbnail(source_path, thumbnail_path):
            return cls._url_for_relative_path(thumbnail_relative)
        return str(image_url or "").strip()

    @classmethod
    def delete_local_asset_bundle(cls, asset_url, media_type="image"):
        paths_to_delete = []
        source_path = cls.resolve_local_asset_path(asset_url)
        if source_path is not None:
            paths_to_delete.append(source_path)

        thumbnail_path = cls._thumbnail_path_for_image_url(asset_url, media_type=media_type)
        if thumbnail_path is not None:
            paths_to_delete.append(thumbnail_path)

        deleted_paths = []
        seen_paths = set()
        for candidate_path in paths_to_delete:
            normalized_candidate = candidate_path.resolve()
            if normalized_candidate in seen_paths:
                continue
            seen_paths.add(normalized_candidate)
            if cls._delete_file_if_present(normalized_candidate):
                deleted_paths.append(normalized_candidate)

        return {
            "deleted_original": source_path is not None and source_path.resolve() in deleted_paths,
            "deleted_thumbnail": thumbnail_path is not None and thumbnail_path.resolve() in deleted_paths,
            "deleted_paths": [str(path) for path in deleted_paths],
        }

    @classmethod
    def _thumbnail_relative_path(cls, relative_source):
        extension_token = relative_source.suffix.lower().lstrip(".") or "image"
        thumbnail_name = f"{relative_source.stem}--{extension_token}.jpg"
        if relative_source.parent == Path("."):
            return Path(cls.THUMBNAIL_DIR_NAME) / thumbnail_name
        return Path(cls.THUMBNAIL_DIR_NAME) / relative_source.parent / thumbnail_name

    @classmethod
    def _thumbnail_path_for_image_url(cls, image_url, media_type="image"):
        if str(media_type or "").strip().lower() != "image":
            return None

        source_path = cls.resolve_local_asset_path(image_url)
        if source_path is None:
            return None
        try:
            relative_source = source_path.relative_to(cls.LOCAL_MEDIA_DIR.resolve())
        except ValueError:
            return None
        if relative_source.parts and relative_source.parts[0] == cls.THUMBNAIL_DIR_NAME:
            return source_path
        return cls.LOCAL_MEDIA_DIR / cls._thumbnail_relative_path(relative_source)

    @classmethod
    def _ensure_thumbnail(cls, source_path, thumbnail_path):
        try:
            source_mtime = source_path.stat().st_mtime
            if thumbnail_path.exists() and thumbnail_path.stat().st_mtime >= source_mtime:
                return True
        except OSError:
            return False

        thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(source_path) as image:
                image = ImageOps.exif_transpose(image)
                image.thumbnail(cls.THUMBNAIL_MAX_SIZE, Image.Resampling.LANCZOS)
                image = cls._to_rgb_image(image)
                image.save(
                    thumbnail_path,
                    format="JPEG",
                    optimize=True,
                    quality=cls.THUMBNAIL_QUALITY,
                )
            return True
        except Exception:
            return False

    @staticmethod
    def _to_rgb_image(image):
        if image.mode == "RGB":
            return image
        if "A" in image.getbands():
            background = Image.new("RGB", image.size, (248, 242, 233))
            background.paste(image, mask=image.getchannel("A"))
            return background
        return image.convert("RGB")

    @classmethod
    def _delete_file_if_present(cls, candidate_path):
        media_root = cls.LOCAL_MEDIA_DIR.resolve()
        try:
            candidate_path.relative_to(media_root)
        except ValueError:
            return False

        try:
            if not candidate_path.exists() or not candidate_path.is_file():
                return False
            candidate_path.unlink()
            cls._prune_empty_parent_dirs(candidate_path.parent)
            return True
        except OSError:
            return False

    @classmethod
    def _prune_empty_parent_dirs(cls, directory_path):
        media_root = cls.LOCAL_MEDIA_DIR.resolve()
        current_path = directory_path.resolve()
        while current_path != media_root:
            try:
                current_path.rmdir()
            except OSError:
                break
            current_path = current_path.parent

    @classmethod
    def _url_for_relative_path(cls, relative_path):
        normalized_relative = str(relative_path).replace("\\", "/").strip("/")
        return f"{cls.LOCAL_MEDIA_PREFIX}{normalized_relative}"
