import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from flask import Flask

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
  sys.path.insert(0, str(API_ROOT))

from flask_api.config import mysqlconnection as db


def _build_mock_connection():
  connection = MagicMock()
  cursor = MagicMock()
  cursor.fetchall.return_value = [{"value": 1}]
  cursor.fetchone.return_value = {"value": 1}
  cursor.lastrowid = 42
  connection.cursor.return_value.__enter__.return_value = cursor
  return connection, cursor


class MysqlConnectionTests(unittest.TestCase):
  def test_query_db_reuses_single_connection_within_request(self):
    app = Flask(__name__)
    mock_connection, _ = _build_mock_connection()

    with patch.object(db, "connect_to_mysql", return_value=mock_connection) as mock_connect:
      with app.test_request_context("/"):
        db.query_db("SELECT 1")
        db.query_db("SELECT 2", fetch="one")
        self.assertEqual(mock_connect.call_count, 1)
        self.assertEqual(mock_connection.commit.call_count, 2)
        mock_connection.close.assert_not_called()
        db.close_request_connection()
        mock_connection.close.assert_called_once()

  def test_db_transaction_commits_once_for_multiple_queries(self):
    app = Flask(__name__)
    mock_connection, _ = _build_mock_connection()

    with patch.object(db, "connect_to_mysql", return_value=mock_connection):
      with app.test_request_context("/"):
        with db.db_transaction():
          db.query_db("SELECT 1")
          db.query_db("SELECT 2")
        self.assertEqual(mock_connection.commit.call_count, 1)
        mock_connection.rollback.assert_not_called()
        db.close_request_connection()

  def test_db_transaction_rolls_back_on_error(self):
    app = Flask(__name__)
    mock_connection, _ = _build_mock_connection()

    with patch.object(db, "connect_to_mysql", return_value=mock_connection):
      with app.test_request_context("/"):
        with self.assertRaises(RuntimeError):
          with db.db_transaction():
            db.query_db("SELECT 1")
            raise RuntimeError("boom")
        mock_connection.rollback.assert_called_once()
        mock_connection.commit.assert_not_called()
        db.close_request_connection()

  def test_query_db_outside_request_still_opens_and_closes_per_query(self):
    mock_connection, _ = _build_mock_connection()
    with patch.object(db, "connect_to_mysql", return_value=mock_connection) as mock_connect:
      db.query_db("SELECT 1")
      mock_connect.assert_called_once()
      mock_connection.commit.assert_called_once()
      mock_connection.close.assert_called_once()


if __name__ == "__main__":
  unittest.main()
