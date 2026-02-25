import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from flask_api import app  # noqa: E402
import flask_api.controllers.main_controller  # noqa: E402,F401


class AdminEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @patch("flask_api.controllers.main_controller.AdminAuthService.authenticate", return_value=None)
    def test_admin_login_returns_401_when_credentials_invalid(self, _mock_authenticate):
        response = self.client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "wrong"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Invalid username or password."})

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.authenticate",
        return_value={
            "id": 5,
            "username": "admin",
            "display_name": "Admin",
            "is_active": 1,
            "last_login_at": None,
        },
    )
    def test_admin_login_returns_user_payload_when_credentials_valid(self, _mock_authenticate):
        response = self.client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "valid-password"},
        )
        body = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["user"]["id"], 5)
        self.assertEqual(body["user"]["username"], "admin")
        self.assertTrue(body["user"]["is_active"])

    def test_admin_menu_items_requires_auth(self):
        response = self.client.get("/api/admin/menu/items")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Unauthorized"})
        catalog_response = self.client.get("/api/admin/menu/catalog-items")
        self.assertEqual(catalog_response.status_code, 401)
        self.assertEqual(catalog_response.get_json(), {"error": "Unauthorized"})
        create_admin_response = self.client.post("/api/admin/auth/users", json={})
        self.assertEqual(create_admin_response.status_code, 401)
        self.assertEqual(create_admin_response.get_json(), {"error": "Unauthorized"})

    def test_admin_protected_options_preflight_returns_204_without_auth(self):
        for path in (
            "/api/admin/auth/profile",
            "/api/admin/auth/users",
            "/api/admin/menu/reference-data",
            "/api/admin/menu/catalog-items",
            "/api/admin/menu/items/1",
            "/api/admin/menu/sections/1",
            "/api/admin/media",
            "/api/admin/media/1",
            "/api/admin/audit",
        ):
            with self.subTest(path=path):
                response = self.client.open(path, method="OPTIONS")
                self.assertEqual(response.status_code, 204)

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminMenuService.list_menu_items")
    def test_admin_menu_items_returns_data_when_authenticated(self, mock_list_items, _mock_get_user):
        mock_list_items.return_value = [{"id": 1, "item_name": "Test Item", "item_key": "test_item", "is_active": True}]
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.get("/api/admin/menu/items")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(body["items"]), 1)
        self.assertEqual(body["items"][0]["item_name"], "Test Item")
        mock_list_items.assert_called_once()

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminMenuService.list_menu_items")
    def test_admin_catalog_items_returns_data_when_authenticated(self, mock_list_items, _mock_get_user):
        mock_list_items.return_value = [
            {"id": 1, "item_name": "Catalog Item", "item_key": "catalog_item", "is_active": True}
        ]
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.get("/api/admin/menu/catalog-items?limit=10")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(body["items"]), 1)
        self.assertEqual(body["items"][0]["item_name"], "Catalog Item")
        mock_list_items.assert_called_once()

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    def test_admin_media_upload_rejects_unsupported_file_type(self, _mock_get_user):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.post(
            "/api/admin/media/upload",
            data={"file": (io.BytesIO(b"test"), "notes.txt")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Unsupported file type. Allowed: image and video formats."},
        )

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.update_user_profile",
        return_value=({"errors": ["Current password is incorrect."]}, 400),
    )
    def test_admin_profile_update_returns_validation_errors(self, _mock_update_profile, _mock_get_user):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.patch(
            "/api/admin/auth/profile",
            json={
                "username": "admin",
                "display_name": "Admin",
                "current_password": "bad",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"errors": ["Current password is incorrect."]})

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminAuditService.log_change")
    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.update_user_profile",
        return_value=(
            {
                "user": {
                    "id": 1,
                    "username": "admin2",
                    "display_name": "Admin Two",
                    "is_active": True,
                    "last_login_at": None,
                }
            },
            200,
        ),
    )
    def test_admin_profile_update_returns_user_payload_when_valid(
        self,
        mock_update_profile,
        mock_log_change,
        _mock_get_user,
    ):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.patch(
            "/api/admin/auth/profile",
            json={
                "username": "admin2",
                "display_name": "Admin Two",
                "current_password": "valid-password",
                "new_password": "new-password-123",
                "confirm_password": "new-password-123",
            },
        )
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["user"]["username"], "admin2")
        self.assertEqual(body["user"]["display_name"], "Admin Two")
        mock_update_profile.assert_called_once()
        mock_log_change.assert_called_once()

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminAuditService.log_change")
    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.create_admin_user",
        return_value=(
            {
                "user": {
                    "id": 2,
                    "username": "manager",
                    "display_name": "Manager",
                    "is_active": True,
                    "last_login_at": None,
                }
            },
            201,
        ),
    )
    def test_admin_create_user_returns_created_payload(self, mock_create_user, mock_log_change, _mock_get_user):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.post(
            "/api/admin/auth/users",
            json={
                "username": "manager",
                "display_name": "Manager",
                "password": "new-password-123",
                "confirm_password": "new-password-123",
                "is_active": True,
            },
        )
        body = response.get_json()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(body["user"]["username"], "manager")
        mock_create_user.assert_called_once()
        mock_log_change.assert_called_once()


if __name__ == "__main__":
    unittest.main()
