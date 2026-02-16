import os

import pymysql.cursors


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


def query_db(query, data=None, fetch="all"):
  connection = connect_to_mysql()
  try:
    with connection.cursor() as cursor:
      cursor.execute(query, data or ())

      if fetch == "one":
        result = cursor.fetchone()
      elif fetch == "none":
        result = cursor.lastrowid
      else:
        result = cursor.fetchall()

    connection.commit()
    return result
  except Exception:
    connection.rollback()
    raise
  finally:
    connection.close()
