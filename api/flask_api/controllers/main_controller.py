from flask import jsonify, request

from flask_api import app
from flask_api.services.inquiry_service import InquiryService
from flask_api.services.slide_service import SlideService


@app.route("/api/health", methods=["GET"])
def api_health():
  return jsonify({"ok": True}), 200


@app.route("/api/slides", methods=["GET", "OPTIONS"])
def get_slides():
  if request.method == "OPTIONS":
    return ("", 204)

  slides = SlideService.get_active_slides()
  return jsonify({"slides": slides}), 200


@app.route("/api/inquiries", methods=["POST", "OPTIONS"])
def create_inquiry():
  if request.method == "OPTIONS":
    return ("", 204)

  response_body, status_code = InquiryService.submit(request.get_json(silent=True) or {})
  return jsonify(response_body), status_code
