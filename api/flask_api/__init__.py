import os

from flask import Flask

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-only-secret-key")


@app.after_request
def add_cors_headers(response):
  response.headers["Access-Control-Allow-Origin"] = os.getenv("CORS_ALLOW_ORIGIN", "*")
  response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
  response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
  return response
