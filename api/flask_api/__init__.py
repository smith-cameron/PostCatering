import logging
import os

from flask import Flask

log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
  level=log_level,
  format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-only-secret-key")


@app.after_request
def add_cors_headers(response):
  response.headers["Access-Control-Allow-Origin"] = os.getenv("CORS_ALLOW_ORIGIN", "http://localhost:5173")
  response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
  response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
  return response
