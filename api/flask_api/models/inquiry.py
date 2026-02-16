from flask_api.config.mysqlconnection import query_db


class Inquiry:
  @staticmethod
  def create(data):
    query = """
      INSERT INTO inquiries (
        full_name,
        email,
        phone,
        event_type,
        event_date,
        guest_count,
        budget,
        service_interest,
        message,
        email_sent
      )
      VALUES (
        %(full_name)s,
        %(email)s,
        %(phone)s,
        %(event_type)s,
        %(event_date)s,
        %(guest_count)s,
        %(budget)s,
        %(service_interest)s,
        %(message)s,
        %(email_sent)s
      );
    """
    return query_db(query, data, fetch="none")

  @staticmethod
  def update_email_sent(inquiry_id, email_sent):
    query = """
      UPDATE inquiries
      SET email_sent = %(email_sent)s
      WHERE id = %(id)s;
    """
    return query_db(query, {"id": inquiry_id, "email_sent": int(bool(email_sent))}, fetch="none")
