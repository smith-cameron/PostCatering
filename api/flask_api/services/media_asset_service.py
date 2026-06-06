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
    def _thumbnail_relative_path(cls, relative_source):
        extension_token = relative_source.suffix.lower().lstrip(".") or "image"
        thumbnail_name = f"{relative_source.stem}--{extension_token}.jpg"
        if relative_source.parent == Path("."):
            return Path(cls.THUMBNAIL_DIR_NAME) / thumbnail_name
        return Path(cls.THUMBNAIL_DIR_NAME) / relative_source.parent / thumbnail_name

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
    def _url_for_relative_path(cls, relative_path):
        normalized_relative = str(relative_path).replace("\\", "/").strip("/")
        return f"{cls.LOCAL_MEDIA_PREFIX}{normalized_relative}"
