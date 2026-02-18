import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
  sys.path.insert(0, str(API_ROOT))

from flask_api import app


class HealthEndpointTests(unittest.TestCase):
  def setUp(self):
    self.client = app.test_client()

  @patch("flask_api.controllers.main_controller.query_db", return_value={"ok": 1})
  def test_health_success_when_database_reachable(self, mock_query_db):
    response = self.client.get("/api/health")
    body = response.get_json()

    self.assertEqual(response.status_code, 200)
    self.assertEqual(body, {"ok": True, "database": {"ok": True}})
    mock_query_db.assert_called_once_with("SELECT 1 AS ok;", fetch="one")

  @patch("flask_api.controllers.main_controller.query_db", side_effect=RuntimeError("db down"))
  def test_health_unavailable_when_database_check_fails(self, mock_query_db):
    response = self.client.get("/api/health")
    body = response.get_json()

    self.assertEqual(response.status_code, 503)
    self.assertEqual(body, {"ok": False, "database": {"ok": False}, "error": "database_unavailable"})
    mock_query_db.assert_called_once_with("SELECT 1 AS ok;", fetch="one")


if __name__ == "__main__":
  unittest.main()
