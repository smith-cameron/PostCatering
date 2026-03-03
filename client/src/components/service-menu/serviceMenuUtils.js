export const normalizeMenuText = (value) => value;

const normalizeMenuItemNameForMatch = (value) => String(normalizeMenuText(value) || "").trim().toLowerCase();

const isExcludedMenuItem = (value, excludedItemNames) =>
  Boolean(excludedItemNames?.has(normalizeMenuItemNameForMatch(value)));

const filterExcludedMenuItems = (items = [], excludedItemNames) =>
  items.filter((item) => !isExcludedMenuItem(item, excludedItemNames));

const filterExcludedMenuItemRefs = (itemRefs = [], excludedItemNames) =>
  itemRefs.filter((itemRef) => !isExcludedMenuItem(itemRef?.itemName, excludedItemNames));

const filterExcludedTableRows = (rows = [], excludedItemNames) =>
  rows.filter((row) => !isExcludedMenuItem(Array.isArray(row) ? row[0] : "", excludedItemNames));

const isSaladName = (value) => String(value || "").toLowerCase().includes("salad");

export const splitItemsBySaladName = (items = []) =>
  items.reduce(
    (acc, item) => {
      if (isSaladName(item)) {
        acc.salads.push(item);
      } else {
        acc.sides.push(item);
      }
      return acc;
    },
    { sides: [], salads: [] }
  );

export const normalizeMenuTitle = (value) => {
  const normalized = normalizeMenuText(value);
  if (typeof normalized !== "string") return normalized;
  return normalized
    .replace(/\s*\(Per Person\)\s*/i, "")
    .replace(/\s*\(Carne Asada or Chicken\)\s*/i, "")
    .replace(/Event Catering - Buffet Style/i, "Event/Crew Catering - Buffet Style")
    .trim();
};

export const getCommunityPackageBullets = (section) => {
  if (section?.sectionId === "community_homestyle") {
    return ["1 Entree/Protein", "2 Sides", "Bread"];
  }

  if (!section?.description) return [];
  const trimmed = section.description.trim();
  const withoutIncludes = trimmed.replace(/^includes\s*/i, "");
  const bullets = [];

  const proteinMatch = section.title?.match(/\(([^)]+)\)/);
  if (section.sectionId === "community_taco_bar") {
    bullets.push(proteinMatch?.[1] ? `Taco Bar Proteins: ${proteinMatch[1]}` : "Taco Bar Proteins");
  }

  if (withoutIncludes.includes("+")) {
    return bullets.concat(
      withoutIncludes
        .split("+")
        .map((item) => item.trim())
        .map((item) => {
          const lower = item.toLowerCase();
          if (lower.startsWith("choose")) return `Choose ${item.slice(6).trim().replace(/^./, (m) => m.toUpperCase())}`;
          if (/^\d+\s+/.test(lower)) return `Choose ${item.replace(/^./, (m) => m.toUpperCase())}`;
          return item.replace(/^./, (m) => m.toUpperCase());
        })
        .filter(Boolean)
    );
  }

  if (withoutIncludes.includes(",")) {
    return bullets.concat(
      withoutIncludes
        .split(",")
        .map((item) => item.trim())
        .map((item) => item.replace(/^./, (m) => m.toUpperCase()))
        .filter(Boolean)
    );
  }

  return bullets.concat([normalizeMenuText(trimmed)]);
};

export const normalizeCommunityTierConstraints = (sectionId, tierTitle, constraints) => {
  void sectionId;
  void tierTitle;
  if (!constraints || typeof constraints !== "object") return {};

  const normalizedConstraints = Object.entries(constraints).reduce((acc, [key, value]) => {
    if (typeof value === "number") {
      acc[key] = { min: value, max: value };
    } else if (value && typeof value === "object") {
      acc[key] = value;
    }
    return acc;
  }, {});

  if (normalizedConstraints.sides_salads && !normalizedConstraints.sides && !normalizedConstraints.salads) {
    normalizedConstraints.sides = normalizedConstraints.sides_salads;
    delete normalizedConstraints.sides_salads;
  }
  return normalizedConstraints;
};

export const toCommunityTierBullet = (label, limits) => {
  if (!limits?.max) return null;
  const min = limits?.min || 0;
  const max = limits.max;
  if (min && min === max) {
    const singularLabel = max === 1 ? label.replace(/s$/i, "") : label;
    return `${max} ${singularLabel}`;
  }
  if (min && min < max) return `${min}-${max} ${label}`;
  return `${max} ${label}`;
};

export const getFormalCourseLabel = (courseType) => {
  const map = {
    passed: "Passed Appetizers",
    starter: "Starters",
    entree: "Entrees",
    sides: "Sides",
  };
  return map[courseType] || "Menu Options";
};

export const getFormalPlanDetails = (plan) => {
  if (!plan) return [];
  if (plan.id === "formal:3-course") {
    return ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"];
  }
  if (plan.id === "formal:2-course") {
    return ["1 Starter", "1 Entree", "Bread"];
  }
  return plan.details || [];
};

export const getApprovedFormalPlans = (plans) => (plans || []).filter((plan) => plan.id !== "formal:2-course");

export const getFormalMenuBlocks = (sections) =>
  (sections || [])
    .filter((section) => section.type === "tiers" && section.courseType)
    .map((section) => ({
      key: section.sectionId || section.title,
      title: getFormalCourseLabel(section.courseType),
      items: section.tiers?.flatMap((tier) => tier.bullets || []) || [],
    }))
    .filter((block) => block.items.length);

const getCommunityTierBullets = (section, tier) => {
  const limits = normalizeCommunityTierConstraints(section.sectionId, tier.tierTitle, tier.constraints);
  return [
    toCommunityTierBullet("Entrees/Protiens", limits.entree),
    toCommunityTierBullet("Sides", limits.sides),
    toCommunityTierBullet("Salads", limits.salads),
    !limits.sides && !limits.salads ? toCommunityTierBullet("Sides/Salads", limits.sides_salads) : null,
    "Bread",
  ].filter(Boolean);
};

const normalizeTableColumns = (columns = [], blankFirstColumn = false) =>
  columns.map((column, index) => (blankFirstColumn && index === 0 ? "" : normalizeMenuText(column)));

const normalizeTableRows = (rows = []) => rows.map((row) => row.map((cell) => normalizeMenuText(cell)));

const buildStandardSectionBlocks = (menuKey, section, menuOptions, excludedItemNames) => {
  if (section.type === "package") {
    const packageBullets = menuKey === "community" ? getCommunityPackageBullets(section) : [];

    return [
      packageBullets.length
        ? {
            key: `${section.sectionId || section.title}-package`,
            type: "list",
            price: section.price,
            items: packageBullets,
          }
        : {
            key: `${section.sectionId || section.title}-package`,
            type: "text",
            price: section.price,
            text: section.description,
          },
    ];
  }

  if (section.type === "tiers") {
    return (section.tiers || []).map((tier, tierIndex) => ({
      key: `${section.sectionId || section.title}-tier-${tierIndex}`,
      type: "list",
      title: tier.tierTitle,
      price: tier.price,
      items: menuKey === "community" ? getCommunityTierBullets(section, tier) : tier.bullets || [],
    }));
  }

  if (section.type === "includeMenu") {
    const noteBlock = section.note
      ? [
          {
            key: `${section.sectionId || section.title}-note`,
            type: "text",
            text: section.note,
          },
        ]
      : [];

    const includeBlocks = (section.includeKeys || []).flatMap((key) => {
      const block = menuOptions[key];
      if (!block) return [];
      const filteredItemRefs = filterExcludedMenuItemRefs(
        Array.isArray(block.itemRefs) ? block.itemRefs : [],
        excludedItemNames
      );
      const filteredItems = filteredItemRefs.length
        ? filteredItemRefs.map((itemRef) => itemRef?.itemName).filter(Boolean)
        : filterExcludedMenuItems(Array.isArray(block.items) ? block.items : [], excludedItemNames);
      if (!filteredItems.length) return [];

      if (block.category === "sides_salads") {
        const { sides, salads } = splitItemsBySaladName(filteredItems);
        const groupedBlocks = [
          sides.length
            ? {
                key: `${key}-sides`,
                type: "list",
                title: "Sides",
                items: sides,
              }
            : null,
          salads.length
            ? {
                key: `${key}-salads`,
                type: "list",
                title: "Salads",
                items: salads,
              }
            : null,
        ].filter(Boolean);

        return groupedBlocks;
      }

      return [
        {
          key,
          type: "list",
          title: block.title,
          items: filteredItems,
        },
      ];
    });

    return noteBlock.concat(includeBlocks);
  }

  if (menuKey === "togo" && section.sectionId === "togo_sides_salads") {
    const columns = normalizeTableColumns(section.columns || [], true);
    const rows = filterExcludedTableRows(normalizeTableRows(section.rows || []), excludedItemNames);
    const sideRows = rows.filter((row) => !isSaladName(row[0]));
    const saladRows = rows.filter((row) => isSaladName(row[0]));
    const groupedBlocks = [
      sideRows.length
        ? {
            key: `${section.sectionId}-sides`,
            type: "table",
            title: "Sides",
            columns,
            rows: sideRows,
          }
        : null,
      saladRows.length
        ? {
            key: `${section.sectionId}-salads`,
            type: "table",
            title: "Salads",
            columns,
            rows: saladRows,
          }
        : null,
    ].filter(Boolean);

    return groupedBlocks;
  }

  const rows = menuKey === "togo"
    ? filterExcludedTableRows(normalizeTableRows(section.rows || []), excludedItemNames)
    : normalizeTableRows(section.rows || []);
  if (!rows.length) return [];

  return [
    {
      key: `${section.sectionId || section.title}-table`,
      type: "table",
      columns: normalizeTableColumns(section.columns || []),
      rows,
    },
  ];
};

export const buildMenuSections = ({
  menuKey,
  data,
  menuOptions = {},
  approvedFormalPlans = [],
  formalMenuBlocks = [],
  excludedNonFormalItemNames = new Set(),
}) => {
  if (menuKey === "formal") {
    return [
      {
        id: "formal-packages",
        title: "Formal Dinner Packages",
        sectionKind: "service",
        blocks: approvedFormalPlans.map((plan) => ({
          key: plan.id,
          type: "list",
          title: plan.title,
          price: plan.price,
          items: getFormalPlanDetails(plan),
        })),
      },
      {
        id: "formal-options",
        title: "Menu Options",
        sectionKind: "menu",
        blocks: formalMenuBlocks.map((block) => ({
          key: block.key,
          type: "list",
          title: block.title,
          items: block.items,
        })),
      },
    ].filter((section) => section.blocks.length);
  }

  return (data?.sections || [])
    .map((section, sectionIndex) => ({
      id: section.sectionId || section.title || `menu-section-${sectionIndex}`,
      title: section.title,
      sectionKind: section.type === "includeMenu" ? "menu" : "service",
      blocks: buildStandardSectionBlocks(menuKey, section, menuOptions, excludedNonFormalItemNames),
    }))
    .filter((section) => section.blocks.length);
};
