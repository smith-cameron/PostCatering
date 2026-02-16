from flask_api.models.slide import Slide


class SlideService:
  @staticmethod
  def get_active_slides():
    return Slide.get_active_dicts()
