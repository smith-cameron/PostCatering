import re

from flask_api.config.mysqlconnection import query_db


class Menu:
  @staticmethod
  def _slug(value):
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:120] if slug else None

  @staticmethod
  def _normalize_tier_constraints(rows):
    constraints = {}
    for row in rows:
      key = row["constraint_key"]
      value = row["constraint_value"]

      if key.endswith("_min"):
        base_key = key[:-4]
        constraints.setdefault(base_key, {})["min"] = value
        continue
      if key.endswith("_max"):
        base_key = key[:-4]
        constraints.setdefault(base_key, {})["max"] = value
        continue

      constraints[key] = value

    return constraints

  @classmethod
  def _get_menu_options(cls):
    query = """
      SELECT
        g.id AS group_id,
        g.option_key,
        g.option_id,
        g.category,
        g.title,
        g.display_order AS group_order,
        i.item_name,
        gi.display_order AS item_order
      FROM menu_option_groups g
      LEFT JOIN menu_option_group_items gi
        ON gi.group_id = g.id AND gi.is_active = 1
      LEFT JOIN menu_items i
        ON i.id = gi.item_id AND i.is_active = 1
      WHERE g.is_active = 1
      ORDER BY g.display_order ASC, g.id ASC, gi.display_order ASC, gi.id ASC;
    """
    rows = query_db(query)
    if not rows:
      return {}

    payload = {}
    seen = set()
    for row in rows:
      key = row["option_key"]
      if key not in seen:
        payload[key] = {
          "id": row["option_id"],
          "category": row["category"],
          "title": row["title"],
          "items": [],
        }
        seen.add(key)

      if row["item_name"]:
        payload[key]["items"].append(row["item_name"])

    return payload

  @classmethod
  def _get_formal_plan_options(cls):
    plans = query_db(
      """
      SELECT id, plan_key, option_level, title, price
      FROM formal_plan_options
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC;
      """
    )
    if not plans:
      return []

    details = query_db(
      """
      SELECT plan_option_id, detail_text
      FROM formal_plan_option_details
      WHERE is_active = 1
      ORDER BY plan_option_id ASC, display_order ASC, id ASC;
      """
    )
    constraints = query_db(
      """
      SELECT plan_option_id, constraint_key, min_select, max_select
      FROM formal_plan_option_constraints
      WHERE is_active = 1
      ORDER BY plan_option_id ASC, id ASC;
      """
    )

    details_by_plan = {}
    for row in details:
      details_by_plan.setdefault(row["plan_option_id"], []).append(row["detail_text"])

    constraints_by_plan = {}
    for row in constraints:
      constraints_by_plan.setdefault(row["plan_option_id"], {})[row["constraint_key"]] = {
        "min": row["min_select"],
        "max": row["max_select"],
      }

    payload = []
    for row in plans:
      payload.append(
        {
          "id": row["plan_key"],
          "level": row["option_level"],
          "title": row["title"],
          "price": row["price"],
          "details": details_by_plan.get(row["id"], []),
          "constraints": constraints_by_plan.get(row["id"], {}),
        }
      )
    return payload

  @classmethod
  def _get_menu_catalog(cls):
    catalogs = query_db(
      """
      SELECT id, catalog_key, page_title, subtitle
      FROM menu_catalogs
      WHERE is_active = 1
      ORDER BY display_order ASC, id ASC;
      """
    )
    if not catalogs:
      return {}

    payload = {}
    catalog_ids = {}
    for row in catalogs:
      payload[row["catalog_key"]] = {
        "pageTitle": row["page_title"],
        "subtitle": row["subtitle"],
      }
      catalog_ids[row["id"]] = row["catalog_key"]

    intro_rows = query_db(
      """
      SELECT
        b.catalog_id,
        b.id AS block_id,
        b.title AS block_title,
        b.display_order AS block_order,
        ib.bullet_text,
        ib.display_order AS bullet_order
      FROM menu_intro_blocks b
      LEFT JOIN menu_intro_bullets ib
        ON ib.intro_block_id = b.id AND ib.is_active = 1
      WHERE b.is_active = 1
      ORDER BY b.catalog_id ASC, b.display_order ASC, b.id ASC, ib.display_order ASC, ib.id ASC;
      """
    )

    intro_by_catalog = {}
    for row in intro_rows:
      catalog_key = catalog_ids.get(row["catalog_id"])
      if not catalog_key:
        continue

      block_bucket = intro_by_catalog.setdefault(catalog_key, {})
      if row["block_id"] not in block_bucket:
        block_bucket[row["block_id"]] = {"title": row["block_title"], "bullets": []}
      if row["bullet_text"] is not None:
        block_bucket[row["block_id"]]["bullets"].append(row["bullet_text"])

    for catalog_key, blocks in intro_by_catalog.items():
      payload[catalog_key]["introBlocks"] = list(blocks.values())

    section_rows = query_db(
      """
      SELECT
        s.id AS section_id,
        s.catalog_id,
        s.section_key,
        s.section_type,
        s.title,
        s.description,
        s.price,
        s.category,
        s.course_type
      FROM menu_sections s
      WHERE s.is_active = 1
      ORDER BY s.catalog_id ASC, s.display_order ASC, s.id ASC;
      """
    )

    section_by_id = {}
    for row in section_rows:
      catalog_key = catalog_ids.get(row["catalog_id"])
      if not catalog_key:
        continue

      section = {"sectionId": row["section_key"]}
      if row["section_type"] is not None:
        section["type"] = row["section_type"]
      if row["course_type"] is not None:
        section["courseType"] = row["course_type"]
      if row["category"] is not None:
        section["category"] = row["category"]
      section["title"] = row["title"]
      if row["description"] is not None:
        section["description"] = row["description"]
      if row["price"] is not None:
        section["price"] = row["price"]

      payload[catalog_key].setdefault("sections", []).append(section)
      section_by_id[row["section_id"]] = section

    section_columns = query_db(
      """
      SELECT section_id, column_label
      FROM menu_section_columns
      WHERE is_active = 1
      ORDER BY section_id ASC, display_order ASC, id ASC;
      """
    )
    for row in section_columns:
      section = section_by_id.get(row["section_id"])
      if section is None:
        continue
      section.setdefault("columns", []).append(row["column_label"])

    section_pricing_rows = query_db(
      """
      SELECT r.section_id, i.item_name, r.value_1, r.value_2
      FROM menu_section_rows r
      JOIN menu_items i ON i.id = r.item_id AND i.is_active = 1
      WHERE r.is_active = 1
      ORDER BY r.section_id ASC, r.display_order ASC, r.id ASC;
      """
    )
    for row in section_pricing_rows:
      section = section_by_id.get(row["section_id"])
      if section is None:
        continue
      section.setdefault("rows", []).append([row["item_name"], row["value_1"], row["value_2"]])

    include_rows = query_db(
      """
      SELECT ig.section_id, g.option_key
      FROM menu_section_include_groups ig
      JOIN menu_option_groups g
        ON g.id = ig.group_id AND g.is_active = 1
      WHERE ig.is_active = 1
      ORDER BY ig.section_id ASC, ig.display_order ASC, ig.id ASC;
      """
    )
    for row in include_rows:
      section = section_by_id.get(row["section_id"])
      if section is None:
        continue
      section.setdefault("includeKeys", []).append(row["option_key"])

    tier_rows = query_db(
      """
      SELECT id, section_id, tier_title, price
      FROM menu_section_tiers
      WHERE is_active = 1
      ORDER BY section_id ASC, display_order ASC, id ASC;
      """
    )
    tiers_by_id = {}
    for row in tier_rows:
      section = section_by_id.get(row["section_id"])
      if section is None:
        continue
      tier = {"tierTitle": row["tier_title"]}
      if row["price"] is not None:
        tier["price"] = row["price"]
      tier["bullets"] = []
      tiers_by_id[row["id"]] = tier
      section.setdefault("tiers", []).append(tier)

    tier_constraint_rows = query_db(
      """
      SELECT tier_id, constraint_key, constraint_value
      FROM menu_section_tier_constraints
      WHERE is_active = 1
      ORDER BY tier_id ASC, id ASC;
      """
    )
    tier_constraints_by_id = {}
    for row in tier_constraint_rows:
      tier_constraints_by_id.setdefault(row["tier_id"], []).append(row)

    for tier_id, rows in tier_constraints_by_id.items():
      tier = tiers_by_id.get(tier_id)
      if tier is None:
        continue
      tier["constraints"] = cls._normalize_tier_constraints(rows)

    tier_bullet_rows = query_db(
      """
      SELECT b.tier_id, COALESCE(i.item_name, b.bullet_text) AS bullet_text
      FROM menu_section_tier_bullets b
      LEFT JOIN menu_items i
        ON i.id = b.item_id AND i.is_active = 1
      WHERE b.is_active = 1
        AND (b.item_id IS NULL OR i.id IS NOT NULL)
      ORDER BY b.tier_id ASC, b.display_order ASC, b.id ASC;
      """
    )
    for row in tier_bullet_rows:
      tier = tiers_by_id.get(row["tier_id"])
      if tier is None:
        continue
      tier.setdefault("bullets", []).append(row["bullet_text"])

    return payload

  @classmethod
  def get_config_payload(cls):
    menu_options = cls._get_menu_options()
    formal_plan_options = cls._get_formal_plan_options()
    menu = cls._get_menu_catalog()

    if not menu_options or not formal_plan_options or not menu:
      return None

    return {
      "menu_options": menu_options,
      "formal_plan_options": formal_plan_options,
      "menu": menu,
    }

  @classmethod
  def seed_from_payload(cls, payload):
    menu_options = payload.get("menu_options") or payload.get("MENU_OPTIONS") or {}
    formal_plan_options = payload.get("formal_plan_options") or payload.get("FORMAL_PLAN_OPTIONS") or []
    menu = payload.get("menu") or payload.get("MENU") or {}

    item_names = set()
    for option_group in menu_options.values():
      for item in option_group.get("items", []):
        item_names.add(item)
    for catalog in menu.values():
      for section in catalog.get("sections", []):
        for row in section.get("rows", []):
          if row and row[0]:
            item_names.add(row[0])
        for tier in section.get("tiers", []):
          for bullet in tier.get("bullets", []):
            item_names.add(bullet)

    for item_name in item_names:
      query_db(
        """
        INSERT INTO menu_items (item_key, item_name, is_active)
        VALUES (%(item_key)s, %(item_name)s, 1)
        ON DUPLICATE KEY UPDATE
          item_key = VALUES(item_key),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
        {"item_key": cls._slug(item_name), "item_name": item_name},
        fetch="none",
      )

    items = query_db("SELECT id, item_name FROM menu_items;")
    item_ids = {row["item_name"]: row["id"] for row in items}

    for idx, (option_key, option_group) in enumerate(menu_options.items(), start=1):
      query_db(
        """
        INSERT INTO menu_option_groups (option_key, option_id, category, title, display_order, is_active)
        VALUES (%(option_key)s, %(option_id)s, %(category)s, %(title)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          option_id = VALUES(option_id),
          category = VALUES(category),
          title = VALUES(title),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
        {
          "option_key": option_key,
          "option_id": option_group.get("id"),
          "category": option_group.get("category"),
          "title": option_group.get("title"),
          "display_order": idx,
        },
        fetch="none",
      )

      group_id_row = query_db(
        "SELECT id FROM menu_option_groups WHERE option_key = %(option_key)s;",
        {"option_key": option_key},
        fetch="one",
      )
      if not group_id_row:
        continue
      group_id = group_id_row["id"]
      for item_order, item_name in enumerate(option_group.get("items", []), start=1):
        item_id = item_ids.get(item_name)
        if item_id is None:
          continue
        query_db(
          """
          INSERT INTO menu_option_group_items (group_id, item_id, display_order, is_active)
          VALUES (%(group_id)s, %(item_id)s, %(display_order)s, 1)
          ON DUPLICATE KEY UPDATE
            display_order = VALUES(display_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
          {"group_id": group_id, "item_id": item_id, "display_order": item_order},
          fetch="none",
        )

    for idx, option in enumerate(formal_plan_options, start=1):
      query_db(
        """
        INSERT INTO formal_plan_options (plan_key, option_level, title, price, display_order, is_active)
        VALUES (%(plan_key)s, %(option_level)s, %(title)s, %(price)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          option_level = VALUES(option_level),
          title = VALUES(title),
          price = VALUES(price),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
        {
          "plan_key": option.get("id"),
          "option_level": option.get("level"),
          "title": option.get("title"),
          "price": option.get("price"),
          "display_order": idx,
        },
        fetch="none",
      )
      plan_row = query_db(
        "SELECT id FROM formal_plan_options WHERE plan_key = %(plan_key)s;",
        {"plan_key": option.get("id")},
        fetch="one",
      )
      if not plan_row:
        continue
      plan_id = plan_row["id"]

      for detail_order, detail_text in enumerate(option.get("details", []), start=1):
        query_db(
          """
          INSERT INTO formal_plan_option_details (plan_option_id, detail_text, display_order, is_active)
          VALUES (%(plan_option_id)s, %(detail_text)s, %(display_order)s, 1)
          ON DUPLICATE KEY UPDATE
            detail_text = VALUES(detail_text),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
          {"plan_option_id": plan_id, "detail_text": detail_text, "display_order": detail_order},
          fetch="none",
        )

      for constraint_key, limits in option.get("constraints", {}).items():
        query_db(
          """
          INSERT INTO formal_plan_option_constraints (plan_option_id, constraint_key, min_select, max_select, is_active)
          VALUES (%(plan_option_id)s, %(constraint_key)s, %(min_select)s, %(max_select)s, 1)
          ON DUPLICATE KEY UPDATE
            min_select = VALUES(min_select),
            max_select = VALUES(max_select),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
          {
            "plan_option_id": plan_id,
            "constraint_key": constraint_key,
            "min_select": limits.get("min", 0),
            "max_select": limits.get("max", 0),
          },
          fetch="none",
        )

    for catalog_order, (catalog_key, catalog_data) in enumerate(menu.items(), start=1):
      query_db(
        """
        INSERT INTO menu_catalogs (catalog_key, page_title, subtitle, display_order, is_active)
        VALUES (%(catalog_key)s, %(page_title)s, %(subtitle)s, %(display_order)s, 1)
        ON DUPLICATE KEY UPDATE
          page_title = VALUES(page_title),
          subtitle = VALUES(subtitle),
          display_order = VALUES(display_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP;
        """,
        {
          "catalog_key": catalog_key,
          "page_title": catalog_data.get("pageTitle"),
          "subtitle": catalog_data.get("subtitle"),
          "display_order": catalog_order,
        },
        fetch="none",
      )
      catalog_row = query_db(
        "SELECT id FROM menu_catalogs WHERE catalog_key = %(catalog_key)s;",
        {"catalog_key": catalog_key},
        fetch="one",
      )
      if not catalog_row:
        continue
      catalog_id = catalog_row["id"]

      for block_order, block in enumerate(catalog_data.get("introBlocks", []), start=1):
        query_db(
          """
          INSERT INTO menu_intro_blocks (catalog_id, title, display_order, is_active)
          VALUES (%(catalog_id)s, %(title)s, %(display_order)s, 1)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
          {"catalog_id": catalog_id, "title": block.get("title"), "display_order": block_order},
          fetch="none",
        )
        block_row = query_db(
          """
          SELECT id
          FROM menu_intro_blocks
          WHERE catalog_id = %(catalog_id)s AND display_order = %(display_order)s;
          """,
          {"catalog_id": catalog_id, "display_order": block_order},
          fetch="one",
        )
        if not block_row:
          continue
        for bullet_order, bullet in enumerate(block.get("bullets", []), start=1):
          query_db(
            """
            INSERT INTO menu_intro_bullets (intro_block_id, bullet_text, display_order, is_active)
            VALUES (%(intro_block_id)s, %(bullet_text)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              bullet_text = VALUES(bullet_text),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
            {"intro_block_id": block_row["id"], "bullet_text": bullet, "display_order": bullet_order},
            fetch="none",
          )

      for section_order, section in enumerate(catalog_data.get("sections", []), start=1):
        query_db(
          """
          INSERT INTO menu_sections (
            catalog_id,
            section_key,
            section_type,
            title,
            description,
            price,
            category,
            course_type,
            display_order,
            is_active
          )
          VALUES (
            %(catalog_id)s,
            %(section_key)s,
            %(section_type)s,
            %(title)s,
            %(description)s,
            %(price)s,
            %(category)s,
            %(course_type)s,
            %(display_order)s,
            1
          )
          ON DUPLICATE KEY UPDATE
            section_type = VALUES(section_type),
            title = VALUES(title),
            description = VALUES(description),
            price = VALUES(price),
            category = VALUES(category),
            course_type = VALUES(course_type),
            display_order = VALUES(display_order),
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP;
          """,
          {
            "catalog_id": catalog_id,
            "section_key": section.get("sectionId"),
            "section_type": section.get("type"),
            "title": section.get("title"),
            "description": section.get("description"),
            "price": section.get("price"),
            "category": section.get("category"),
            "course_type": section.get("courseType"),
            "display_order": section_order,
          },
          fetch="none",
        )
        section_row = query_db(
          "SELECT id FROM menu_sections WHERE section_key = %(section_key)s;",
          {"section_key": section.get("sectionId")},
          fetch="one",
        )
        if not section_row:
          continue
        section_id = section_row["id"]

        for col_order, col_label in enumerate(section.get("columns", []), start=1):
          query_db(
            """
            INSERT INTO menu_section_columns (section_id, column_label, display_order, is_active)
            VALUES (%(section_id)s, %(column_label)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              column_label = VALUES(column_label),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
            {"section_id": section_id, "column_label": col_label, "display_order": col_order},
            fetch="none",
          )

        for row_order, row_values in enumerate(section.get("rows", []), start=1):
          if not row_values:
            continue
          item_name = row_values[0]
          item_id = item_ids.get(item_name)
          if item_id is None:
            continue
          value_1 = row_values[1] if len(row_values) > 1 else None
          value_2 = row_values[2] if len(row_values) > 2 else None
          query_db(
            """
            INSERT INTO menu_section_rows (section_id, item_id, value_1, value_2, display_order, is_active)
            VALUES (%(section_id)s, %(item_id)s, %(value_1)s, %(value_2)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              value_1 = VALUES(value_1),
              value_2 = VALUES(value_2),
              display_order = VALUES(display_order),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
            {
              "section_id": section_id,
              "item_id": item_id,
              "value_1": value_1,
              "value_2": value_2,
              "display_order": row_order,
            },
            fetch="none",
          )

        for include_order, include_key in enumerate(section.get("includeKeys", []), start=1):
          group_row = query_db(
            "SELECT id FROM menu_option_groups WHERE option_key = %(option_key)s;",
            {"option_key": include_key},
            fetch="one",
          )
          if not group_row:
            continue
          query_db(
            """
            INSERT INTO menu_section_include_groups (section_id, group_id, display_order, is_active)
            VALUES (%(section_id)s, %(group_id)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              display_order = VALUES(display_order),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
            {"section_id": section_id, "group_id": group_row["id"], "display_order": include_order},
            fetch="none",
          )

        for tier_order, tier in enumerate(section.get("tiers", []), start=1):
          query_db(
            """
            INSERT INTO menu_section_tiers (section_id, tier_title, price, display_order, is_active)
            VALUES (%(section_id)s, %(tier_title)s, %(price)s, %(display_order)s, 1)
            ON DUPLICATE KEY UPDATE
              tier_title = VALUES(tier_title),
              price = VALUES(price),
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP;
            """,
            {
              "section_id": section_id,
              "tier_title": tier.get("tierTitle"),
              "price": tier.get("price"),
              "display_order": tier_order,
            },
            fetch="none",
          )
          tier_row = query_db(
            """
            SELECT id
            FROM menu_section_tiers
            WHERE section_id = %(section_id)s AND display_order = %(display_order)s;
            """,
            {"section_id": section_id, "display_order": tier_order},
            fetch="one",
          )
          if not tier_row:
            continue
          tier_id = tier_row["id"]

          for constraint_key, constraint_value in tier.get("constraints", {}).items():
            if isinstance(constraint_value, dict):
              min_value = constraint_value.get("min")
              max_value = constraint_value.get("max")
              constraint_rows = []
              if isinstance(min_value, int):
                constraint_rows.append((f"{constraint_key}_min", min_value))
              if isinstance(max_value, int):
                constraint_rows.append((f"{constraint_key}_max", max_value))
            else:
              constraint_rows = [(constraint_key, constraint_value)]

            for db_constraint_key, db_constraint_value in constraint_rows:
              query_db(
                """
                INSERT INTO menu_section_tier_constraints (tier_id, constraint_key, constraint_value, is_active)
                VALUES (%(tier_id)s, %(constraint_key)s, %(constraint_value)s, 1)
                ON DUPLICATE KEY UPDATE
                  constraint_value = VALUES(constraint_value),
                  is_active = 1,
                  updated_at = CURRENT_TIMESTAMP;
                """,
                {
                  "tier_id": tier_id,
                  "constraint_key": db_constraint_key,
                  "constraint_value": db_constraint_value,
                },
                fetch="none",
              )

          for bullet_order, bullet in enumerate(tier.get("bullets", []), start=1):
            item_id = item_ids.get(bullet)
            query_db(
              """
              INSERT INTO menu_section_tier_bullets (tier_id, item_id, bullet_text, display_order, is_active)
              VALUES (%(tier_id)s, %(item_id)s, %(bullet_text)s, %(display_order)s, 1)
              ON DUPLICATE KEY UPDATE
                item_id = VALUES(item_id),
                bullet_text = VALUES(bullet_text),
                is_active = 1,
                updated_at = CURRENT_TIMESTAMP;
              """,
              {
                "tier_id": tier_id,
                "item_id": item_id,
                "bullet_text": None if item_id is not None else bullet,
                "display_order": bullet_order,
              },
              fetch="none",
            )
