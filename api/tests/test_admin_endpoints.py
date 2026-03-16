import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pymysql

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
        create_admin_response = self.client.post("/api/admin/auth/users", json={})
        self.assertEqual(create_admin_response.status_code, 401)
        self.assertEqual(create_admin_response.get_json(), {"error": "Unauthorized"})

    def test_admin_service_plans_require_auth(self):
        for method, path, json_body in (
            ("GET", "/api/admin/service-plans", None),
            ("POST", "/api/admin/service-plans", {"title": "Test Plan"}),
            ("PATCH", "/api/admin/service-plans/1", {"title": "Updated Plan"}),
            ("DELETE", "/api/admin/service-plans/1", None),
            ("PATCH", "/api/admin/service-plans/reorder", {"section_id": 1, "ordered_plan_ids": [2, 1]}),
        ):
            with self.subTest(method=method, path=path):
                response = self.client.open(path, method=method, json=json_body)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.get_json(), {"error": "Unauthorized"})

    def test_admin_protected_options_preflight_returns_204_without_auth(self):
        for path in (
            "/api/admin/auth/profile",
            "/api/admin/auth/users",
            "/api/admin/menu/items",
            "/api/admin/menu/items/1",
            "/api/admin/service-plans",
            "/api/admin/service-plans/1",
            "/api/admin/service-plans/reorder",
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
    @patch("flask_api.controllers.main_controller.AdminServicePlanService.list_service_plan_sections")
    def test_admin_service_plans_returns_data_when_authenticated(self, mock_list_sections, _mock_get_user):
        mock_list_sections.return_value = (
            {
                "sections": [
                    {
                        "id": 3,
                        "catalog_key": "catering",
                        "section_key": "catering_packages",
                        "section_type": "packages",
                        "title": "Catering Packages",
                        "plans": [{"id": 11, "title": "Tier 1: Casual Buffet"}],
                    }
                ]
            },
            200,
        )
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.get("/api/admin/service-plans?catalog_key=catering&include_inactive=false")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(body["sections"]), 1)
        self.assertEqual(body["sections"][0]["section_key"], "catering_packages")
        mock_list_sections.assert_called_once_with(catalog_key="catering", include_inactive=False)

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.list_service_plan_sections",
        side_effect=pymysql.err.ProgrammingError(
            1146,
            "Table 'post_catering.service_plan_sections' doesn't exist",
        ),
    )
    def test_admin_service_plans_returns_503_when_tables_missing(self, _mock_list_sections, _mock_get_user):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.get("/api/admin/service-plans?catalog_key=catering")
        self.assertEqual(response.status_code, 503)
        self.assertIn("Service plan tables are not installed", response.get_json().get("error", ""))

    def test_admin_menu_create_requires_auth(self):
        response = self.client.post("/api/admin/menu/items", json={"item_name": "Test Item"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Unauthorized"})

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
        "flask_api.controllers.main_controller.AdminServicePlanService.create_service_plan",
        return_value=(
            {
                "plan": {
                    "id": 10,
                    "plan_key": "formal:3-course",
                    "title": "Three-Course Dinner",
                    "catalog_key": "formal",
                }
            },
            201,
        ),
    )
    def test_admin_service_plan_create_returns_created_payload(
        self,
        mock_create_plan,
        mock_log_change,
        _mock_get_user,
    ):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        payload = {
            "section_id": 5,
            "title": "Three-Course Dinner",
            "price": "$75-$110+ per person",
        }
        response = self.client.post("/api/admin/service-plans", json=payload)
        body = response.get_json()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(body["plan"]["plan_key"], "formal:3-course")
        mock_create_plan.assert_called_once_with(payload)
        mock_log_change.assert_called_once()

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.get_service_plan_detail",
        return_value=None,
    )
    def test_admin_service_plan_detail_returns_404_when_missing(self, _mock_get_plan, _mock_get_user):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.get("/api/admin/service-plans/999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "Service plan not found."})

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminAuditService.log_change")
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.update_service_plan",
        return_value=(
            {
                "plan": {
                    "id": 10,
                    "title": "Three-Course Dinner Revised",
                    "plan_key": "formal:3-course",
                }
            },
            200,
        ),
    )
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.get_service_plan_detail",
        return_value={
            "id": 10,
            "title": "Three-Course Dinner",
            "plan_key": "formal:3-course",
        },
    )
    def test_admin_service_plan_update_returns_payload_when_valid(
        self,
        _mock_get_plan,
        mock_update_plan,
        mock_log_change,
        _mock_get_user,
    ):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        payload = {"title": "Three-Course Dinner Revised", "is_active": True}
        response = self.client.patch("/api/admin/service-plans/10", json=payload)
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["plan"]["title"], "Three-Course Dinner Revised")
        mock_update_plan.assert_called_once_with(10, payload)
        mock_log_change.assert_called_once()

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminAuditService.log_change")
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.delete_service_plan",
        return_value=({"ok": True, "deleted_plan_id": 10, "plan_key": "formal:3-course"}, 200),
    )
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.get_service_plan_detail",
        return_value={
            "id": 10,
            "title": "Three-Course Dinner",
            "plan_key": "formal:3-course",
        },
    )
    def test_admin_service_plan_delete_returns_payload_when_valid(
        self,
        _mock_get_plan,
        mock_delete_plan,
        mock_log_change,
        _mock_get_user,
    ):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        response = self.client.delete("/api/admin/service-plans/10")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(body["ok"])
        mock_delete_plan.assert_called_once_with(10, hard_delete=False)
        mock_log_change.assert_called_once()

    @patch(
        "flask_api.controllers.main_controller.AdminAuthService.get_user_by_id",
        return_value={"id": 1, "username": "admin", "display_name": "Admin", "is_active": 1},
    )
    @patch("flask_api.controllers.main_controller.AdminAuditService.log_change")
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.reorder_service_plans",
        return_value=({"ok": True, "ordered_plan_ids": [12, 11]}, 200),
    )
    @patch(
        "flask_api.controllers.main_controller.AdminServicePlanService.list_service_plan_sections",
        side_effect=[
            (
                {
                    "sections": [
                        {
                            "id": 3,
                            "title": "Event Catering - Buffet Style",
                            "plans": [
                                {"id": 11, "plan_key": "catering:buffet_tier_1", "sort_order": 1},
                                {"id": 12, "plan_key": "catering:buffet_tier_2", "sort_order": 2},
                            ],
                        }
                    ]
                },
                200,
            ),
            (
                {
                    "sections": [
                        {
                            "id": 3,
                            "title": "Catering Packages",
                            "plans": [
                                {"id": 12, "plan_key": "catering:buffet_tier_2", "sort_order": 1},
                                {"id": 11, "plan_key": "catering:buffet_tier_1", "sort_order": 2},
                            ],
                        }
                    ]
                },
                200,
            ),
        ],
    )
    def test_admin_service_plan_reorder_returns_payload_when_valid(
        self,
        mock_list_sections,
        mock_reorder_plans,
        mock_log_change,
        _mock_get_user,
    ):
        with self.client.session_transaction() as session:
            session["admin_user_id"] = 1

        payload = {"section_id": 3, "ordered_plan_ids": [12, 11], "catalog_key": "catering"}
        response = self.client.patch("/api/admin/service-plans/reorder", json=payload)
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["ordered_plan_ids"], [12, 11])
        mock_reorder_plans.assert_called_once_with(3, [12, 11])
        self.assertEqual(mock_list_sections.call_count, 2)
        mock_log_change.assert_called_once()

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
        mock_create_user.assert_called_once_with(
            1,
            {
                "username": "manager",
                "display_name": "Manager",
                "password": "new-password-123",
                "confirm_password": "new-password-123",
                "is_active": True,
            },
        )
        mock_log_change.assert_called_once()


if __name__ == "__main__":
    unittest.main()
