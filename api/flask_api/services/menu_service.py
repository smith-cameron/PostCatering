import json
import os
from pathlib import Path

from flask_api.models.menu import Menu


class MenuService:
  @staticmethod
  def _load_seed_payload():
    seed_path = Path(__file__).resolve().parents[2] / "sql" / "menu_seed_payload.json"
    if not seed_path.exists():
      return None
    with seed_path.open("r", encoding="utf-8") as fp:
      raw = json.load(fp)
    return {
      "menu_options": raw.get("MENU_OPTIONS", {}),
      "formal_plan_options": raw.get("FORMAL_PLAN_OPTIONS", []),
      "menu": raw.get("MENU", {}),
    }

  @classmethod
  def get_catalog(cls):
    source = (os.getenv("MENU_DATA_SOURCE") or "db").strip().lower()

    if source == "db":
      payload = Menu.get_config_payload()
      if payload:
        return {"source": "db", **payload}, 200

      fallback = cls._load_seed_payload()
      if fallback:
        Menu.seed_from_payload(fallback)
        reseeded_payload = Menu.get_config_payload()
        if reseeded_payload:
          return {
            "source": "db-seeded-from-file",
            "warning": "Menu config was seeded from file because DB tables were empty.",
            **reseeded_payload,
          }, 200

        return {
          "source": "seed-fallback",
          "warning": "Menu config not found in DB; returning seed payload.",
          **fallback,
        }, 200

      return {"error": "Menu config not found."}, 500

    fallback = cls._load_seed_payload()
    if fallback:
      return {"source": "seed-file", **fallback}, 200
    return {"error": "Menu seed payload not found."}, 500
