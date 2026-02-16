from flask_api.config.mysqlconnection import query_db


class Slide:
  @staticmethod
  def get_active():
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
    return query_db(query)
