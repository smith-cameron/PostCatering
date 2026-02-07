from flask_api import app
# import controllers 
from flask_api.controllers import main_controller


if __name__ == "__main__":
  app.run(debug=True)
  #optional host='localhost', port=5001