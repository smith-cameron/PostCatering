import os

from flask_api import app
from flask_api.controllers import main_controller


if __name__ == "__main__":
  app.run(debug=os.getenv("FLASK_DEBUG", "true").lower() == "true")
