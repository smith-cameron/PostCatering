import {
  buildCateringConstraintDetails,
  filterGeneratedPackageDetails,
  normalizePackageConstraintMap,
} from "../../utils/servicePackageUtils";

export const normalizeMenuText = (value) => value;
const getPlanId = (plan) => String(plan?.planId || plan?.id || "").trim();

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

const getSelectionGroupBullet = (group) => {
  const title = String(group?.title || group?.groupTitle || "").trim();
  const optionLabels = (group?.options || [])
    .map((option) => String(option?.label || option?.optionLabel || "").trim())
    .filter(Boolean);
  if (title && optionLabels.length) {
    return `${title}: ${optionLabels.join(", ")}`;
  }
  if (title) return title;
  return "";
};

export const getCateringPackageBullets = (section) => {
  const selectionMode = section?.selectionMode || section?.selection_mode || "menu_groups";
  const selectionGroupBullets = (section?.selectionGroups || []).map((group) => getSelectionGroupBullet(group)).filter(Boolean);
  const fixedDetails = filterGeneratedPackageDetails(section?.details, {
    catalogKey: "catering",
    selectionMode,
  });
  const generatedDetails =
    selectionMode === "menu_groups" ? buildCateringConstraintDetails(section?.constraints) : [];
  if (generatedDetails.length || fixedDetails.length) {
    return [...generatedDetails, ...fixedDetails, ...selectionGroupBullets].filter(
      (item, index, rows) => rows.indexOf(item) === index
    );
  }
  return selectionGroupBullets;
};

export const normalizeCateringPackageConstraints = (sectionId, tierTitle, constraints) => {
  void sectionId;
  void tierTitle;
  return normalizePackageConstraintMap(constraints, "catering");
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
  if (Array.isArray(plan.details) && plan.details.length) {
    return plan.details;
  }
  if (getPlanId(plan) === "formal:3-course") {
    return ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"];
  }
  if (getPlanId(plan) === "formal:2-course") {
    return ["1 Starter", "1 Entree", "Bread"];
  }
  return plan.details || [];
};

export const getApprovedFormalPlans = (plans) =>
  (plans || []).filter((plan) => plan && plan.isActive !== false);

export const getFormalMenuBlocks = (sections) =>
  (sections || [])
    .filter((section) => section.type === "tiers" && section.courseType)
    .map((section) => ({
      key: section.sectionId || section.title,
      title: getFormalCourseLabel(section.courseType),
      items: section.tiers?.flatMap((tier) => tier.bullets || []) || [],
    }))
    .filter((block) => block.items.length);

const getCateringPackageConstraintBullets = (section, tier) => {
  const selectionMode = tier?.selectionMode || tier?.selection_mode || "menu_groups";
  const fixedDetails = filterGeneratedPackageDetails(
    Array.isArray(tier?.bullets) ? tier.bullets : tier?.details,
    { catalogKey: "catering", selectionMode }
  );
  const limits = normalizeCateringPackageConstraints(section.sectionId, tier.tierTitle, tier.constraints);
  const generatedDetails = selectionMode === "menu_groups" ? buildCateringConstraintDetails(limits) : [];
  return [...generatedDetails, ...fixedDetails].filter((item, index, rows) => rows.indexOf(item) === index);
};

const normalizeTableColumns = (columns = [], blankFirstColumn = false) =>
  columns.map((column, index) => (blankFirstColumn && index === 0 ? "" : normalizeMenuText(column)));

const normalizeTableRows = (rows = []) => rows.map((row) => row.map((cell) => normalizeMenuText(cell)));

const getSectionPackages = (section) => {
  if (!section || typeof section !== "object") return [];

  if (section.type === "packages" && Array.isArray(section.packages)) {
    return section.packages
      .filter((pkg) => pkg && typeof pkg === "object")
      .map((pkg) => ({
        title: pkg.title || section.title || "",
        price: pkg.price || "",
        details: Array.isArray(pkg.details) ? pkg.details : [],
        constraints: pkg.constraints || null,
        selectionGroups: Array.isArray(pkg.selectionGroups) ? pkg.selectionGroups : [],
      }));
  }

  if (section.type === "package") {
    return [
      {
        title: section.title || "",
        price: section.price || "",
        details: Array.isArray(section.details) ? section.details : [],
        constraints: section.constraints || null,
        selectionGroups: Array.isArray(section.selectionGroups) ? section.selectionGroups : [],
      },
    ];
  }

  if (section.type === "tiers" && Array.isArray(section.tiers)) {
    return section.tiers.map((tier) => ({
      title: tier.tierTitle || "",
      price: tier.price || "",
      details: Array.isArray(tier.bullets) ? tier.bullets : [],
      constraints: tier.constraints || null,
      selectionGroups: Array.isArray(tier.selectionGroups) ? tier.selectionGroups : [],
    }));
  }

  return [];
};

const buildStandardSectionBlocks = (menuKey, section, menuOptions, excludedItemNames) => {
  if (section.type === "packages") {
    const packages = getSectionPackages(section);
    return packages.map((pkg, packageIndex) => {
      const packageLikeSection = {
        sectionId: section.sectionId,
        title: pkg.title,
        details: pkg.details,
        constraints: pkg.constraints,
        selectionGroups: pkg.selectionGroups,
      };
      const packageBullets = menuKey === "catering" ? getCateringPackageBullets(packageLikeSection) : pkg.details;
      const shouldShowTitle = packages.length > 1 || pkg.title !== section.title;
      return packageBullets.length
        ? {
            key: `${section.sectionId || section.title}-package-${packageIndex}`,
            type: "list",
            title: shouldShowTitle ? pkg.title : null,
            price: pkg.price,
            items: packageBullets,
          }
        : {
            key: `${section.sectionId || section.title}-package-${packageIndex}`,
            type: "text",
            title: shouldShowTitle ? pkg.title : null,
            price: pkg.price,
            text: pkg.note || section.note || null,
          };
    });
  }

  if (section.type === "package") {
    const packageBullets = menuKey === "catering" ? getCateringPackageBullets(section) : [];

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
            text: section.note || null,
          },
    ];
  }

  if (section.type === "tiers") {
    return (section.tiers || []).map((tier, tierIndex) => ({
      key: `${section.sectionId || section.title}-tier-${tierIndex}`,
      type: "list",
      title: tier.tierTitle,
      price: tier.price,
      items: menuKey === "catering" ? getCateringPackageConstraintBullets(section, tier) : tier.bullets || [],
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
