from contextlib import contextmanager
import os
from pathlib import Path

import pymysql.cursors
from dotenv import load_dotenv
from flask import g, has_request_context


_API_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_API_ROOT / ".env")

_REQUEST_CONNECTION_KEY = "_mysql_connection"
_REQUEST_TRANSACTION_DEPTH_KEY = "_mysql_transaction_depth"


def connect_to_mysql():
  return pymysql.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "3306")),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "post_catering"),
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=False,
  )


def _get_request_connection():
  if not has_request_context():
    return None

  connection = getattr(g, _REQUEST_CONNECTION_KEY, None)
  if connection is None:
    connection = connect_to_mysql()
    setattr(g, _REQUEST_CONNECTION_KEY, connection)
    setattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, 0)
  return connection


def _in_request_transaction():
  if not has_request_context():
    return False
  return int(getattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, 0) or 0) > 0


def _resolve_connection(connection=None):
  if connection is not None:
    return connection, False

  request_connection = _get_request_connection()
  if request_connection is not None:
    return request_connection, False

  return connect_to_mysql(), True


def close_request_connection(exception=None):
  if not has_request_context():
    return

  connection = getattr(g, _REQUEST_CONNECTION_KEY, None)
  if connection is None:
    return

  tx_depth = int(getattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, 0) or 0)
  try:
    if exception is not None or tx_depth > 0:
      connection.rollback()
  finally:
    connection.close()
    if hasattr(g, _REQUEST_CONNECTION_KEY):
      delattr(g, _REQUEST_CONNECTION_KEY)
    if hasattr(g, _REQUEST_TRANSACTION_DEPTH_KEY):
      delattr(g, _REQUEST_TRANSACTION_DEPTH_KEY)


@contextmanager
def db_transaction(connection=None):
  resolved_connection, should_close = _resolve_connection(connection=connection)
  owns_request_depth = (
    connection is None
    and has_request_context()
    and resolved_connection is getattr(g, _REQUEST_CONNECTION_KEY, None)
  )

  if owns_request_depth:
    current_depth = int(getattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, 0) or 0)
    setattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, current_depth + 1)

  try:
    yield resolved_connection
    if owns_request_depth:
      next_depth = int(getattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, 0) or 0) - 1
      setattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, max(next_depth, 0))
      if next_depth <= 0:
        resolved_connection.commit()
    else:
      resolved_connection.commit()
  except Exception:
    if owns_request_depth:
      setattr(g, _REQUEST_TRANSACTION_DEPTH_KEY, 0)
    resolved_connection.rollback()
    raise
  finally:
    if should_close:
      resolved_connection.close()


def query_db(query, data=None, fetch="all", connection=None, auto_commit=True):
  resolved_connection, should_close = _resolve_connection(connection=connection)
  in_transaction = _in_request_transaction() and connection is None and not should_close
  try:
    with resolved_connection.cursor() as cursor:
      cursor.execute(query, data or ())

      if fetch == "one":
        result = cursor.fetchone()
      elif fetch == "none":
        result = cursor.lastrowid
      else:
        result = cursor.fetchall()

    if auto_commit and not in_transaction:
      resolved_connection.commit()
    return result
  except Exception:
    if not in_transaction:
      resolved_connection.rollback()
    raise
  finally:
    if should_close:
      resolved_connection.close()


def query_db_many(query, rows, connection=None, auto_commit=True):
  if not rows:
    return 0

  resolved_connection, should_close = _resolve_connection(connection=connection)
  in_transaction = _in_request_transaction() and connection is None and not should_close
  try:
    with resolved_connection.cursor() as cursor:
      affected = cursor.executemany(query, rows)

    if auto_commit and not in_transaction:
      resolved_connection.commit()
    return affected
  except Exception:
    if not in_transaction:
      resolved_connection.rollback()
    raise
  finally:
    if should_close:
      resolved_connection.close()
