from flask_api.config.mysqlconnection import query_db


class Slide:
  def __init__(self, slide_id, title, caption, image_url, alt_text, display_order):
    self.id = slide_id
    self.title = title
    self.caption = caption
    self.image_url = image_url
    self.alt_text = alt_text
    self.display_order = display_order

  def to_dict(self):
    return {
      "id": self.id,
      "title": self.title,
      "caption": self.caption,
      "image_url": self.image_url,
      "alt_text": self.alt_text,
      "display_order": self.display_order,
    }

  @classmethod
  def get_active(cls):
    query = """
      SELECT
        id,
        title,
        caption,
        image_url,
        alt_text,
        display_order
      FROM slides
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC;
    """
    rows = query_db(query)
    return [
      cls(
        slide_id=row["id"],
        title=row["title"],
        caption=row["caption"],
        image_url=row["image_url"],
        alt_text=row["alt_text"],
        display_order=row["display_order"],
      )
      for row in rows
    ]

  @classmethod
  def get_active_dicts(cls):
    return [slide.to_dict() for slide in cls.get_active()]
