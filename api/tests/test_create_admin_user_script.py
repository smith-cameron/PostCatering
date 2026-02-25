import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from scripts import create_admin_user as create_admin_user_script  # noqa: E402


class CreateAdminUserScriptTests(unittest.TestCase):
    def test_cli_password_rejected_when_too_short(self):
        with self.assertRaises(ValueError) as context:
            create_admin_user_script._resolve_password("short")
        self.assertEqual(str(context.exception), "Password must be at least 10 characters.")

    def test_cli_password_accepted_when_minimum_length(self):
        value = create_admin_user_script._resolve_password("1234567890")
        self.assertEqual(value, "1234567890")

    @patch("scripts.create_admin_user.getpass.getpass", side_effect=["1234567890", "1234567890"])
    def test_prompt_password_accepted_when_matching_and_minimum_length(self, _mock_getpass):
        value = create_admin_user_script._resolve_password("")
        self.assertEqual(value, "1234567890")

    @patch("scripts.create_admin_user.getpass.getpass", side_effect=["1234567890", "different"])
    def test_prompt_password_rejected_when_mismatch(self, _mock_getpass):
        with self.assertRaises(ValueError) as context:
            create_admin_user_script._resolve_password("")
        self.assertEqual(str(context.exception), "Passwords do not match.")


if __name__ == "__main__":
    unittest.main()
