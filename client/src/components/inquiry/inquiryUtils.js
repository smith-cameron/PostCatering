import {
  buildCateringConstraintDetails,
  filterGeneratedPackageDetails,
  normalizePackageConstraintMap,
} from "../../utils/servicePackageUtils";

export const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  event_type: "",
  event_date: "",
  guest_count: "",
  budget: "",
  service_interest: "",
  company_website: "",
  message: "",
};

const formatBudgetDigits = (digits) => {
  const normalized = String(digits || "").replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatBudgetPart = (part, useDollarPrefix = false) => {
  const raw = String(part || "");
  const hasDollar = useDollarPrefix || raw.includes("$");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return hasDollar ? "$" : "";
  const formattedDigits = formatBudgetDigits(digits);
  return `${hasDollar ? "$" : ""}${formattedDigits}`;
};

export const formatBudgetInput = (value) => {
  const raw = String(value || "");
  const cleaned = raw.replace(/[^0-9,$\-\s]/g, "");
  if (!cleaned.trim()) return "";

  const [firstRaw = "", secondRaw = ""] = cleaned.split("-", 2);
  const firstPart = formatBudgetPart(firstRaw);
  if (!cleaned.includes("-")) return firstPart;

  const secondDigits = secondRaw.replace(/\D/g, "");
  const useDollarOnSecond = cleaned.includes("$") && Boolean(secondDigits);
  const secondPart = formatBudgetPart(secondRaw, useDollarOnSecond);
  return `${firstPart}-${secondPart}`;
};

export const toIdPart = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const getPlanId = (plan) => String(plan?.planId || plan?.id || "").trim();
const CATERING_BUFFET_PACKAGE_IDS = new Set(["catering:buffet_tier_1", "catering:buffet_tier_2"]);
const isLegacyBuffetPackageTitle = (plan) => {
  const normalizedTitle = String(plan?.title || "").toLowerCase();
  return normalizedTitle.includes("tier 1") || normalizedTitle.includes("tier 2");
};
const isCateringBuffetPackage = (plan) =>
  CATERING_BUFFET_PACKAGE_IDS.has(getPlanId(plan)) ||
  isLegacyBuffetPackageTitle(plan);
const isSaladName = (value) => String(value || "").toLowerCase().includes("salad");
const splitSidesAndSalads = (items = []) =>
  items.reduce(
    (acc, item) => {
      if (isSaladName(item?.name)) {
        acc.salads.push(item);
      } else {
        acc.sides.push(item);
      }
      return acc;
    },
    { sides: [], salads: [] }
  );

const isPricedValue = (value) => /\$/.test(String(value || ""));

export const getMinEventDateISO = () => {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
};

const getPackageSelectionGroupDetail = (group) => {
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

const getPackageSelectionGroupDetails = (plan) =>
  (Array.isArray(plan?.selectionGroups) ? plan.selectionGroups : [])
    .map((group) => getPackageSelectionGroupDetail(group))
    .filter(Boolean);

export const buildCateringSelectionRules = (plan) => {
  if (!plan) return null;
  const normalizedConstraints = normalizePackageConstraintMap(plan.constraints, "catering");
  if (Object.keys(normalizedConstraints).length) {
    return normalizedConstraints;
  }

  const normalizedTitle = String(plan.title || "").toLowerCase();

  if (normalizedTitle.includes("hearty homestyle")) {
    return {
      entree_signature_protein: { min: 1, max: 1 },
      sides_salads: { min: 2, max: 2 },
    };
  }

  if (isCateringBuffetPackage(plan) && normalizedTitle.includes("tier 1")) {
    return {
      entree_signature_protein: { min: 2, max: 2 },
      sides_salads: { min: 3, max: 3 },
    };
  }

  if (isCateringBuffetPackage(plan) && normalizedTitle.includes("tier 2")) {
    return {
      entree_signature_protein: { min: 2, max: 3 },
      sides_salads: { min: 5, max: 5 },
    };
  }

  return null;
};

const toMatchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const getSelectionCategoryKeyFromText = (value) => {
  const lower = toMatchText(value);
  if (lower.includes("passed")) return "passed";
  if (lower.includes("starter")) return "starter";
  if (lower.includes("entree") && lower.includes("signature protein")) return "entree_signature_protein";
  if (lower.includes("side") && lower.includes("salad")) return "sides_salads";
  if (lower.includes("signature protein") || lower.includes("protein")) return "signature_protein";
  if (lower.includes("salad")) return "salads";
  if (lower.includes("side")) return "sides";
  if (lower.includes("entree")) return "entree";
  return null;
};

const getCateringPackageDetails = (plan) => {
  if (!plan) return [];
  const normalizedTitle = String(plan.title || "").toLowerCase();
  const filteredDetails = filterGeneratedPackageDetails(plan.details, {
    catalogKey: "catering",
    selectionMode: plan.selectionMode || "menu_groups",
  });
  if (filteredDetails.length) {
    return filteredDetails;
  }
  if (normalizedTitle.includes("hearty homestyle")) {
    return ["Bread"];
  }
  if (isCateringBuffetPackage(plan)) {
    return ["Bread"];
  }
  return [];
};

export const getDisplayPlanDetails = (serviceKey, plan, cateringLimits) => {
  if (!plan) return [];
  const selectionGroupDetails = getPackageSelectionGroupDetails(plan);
  const mergeDetails = (details) =>
    [...(Array.isArray(details) ? details : []), ...selectionGroupDetails].filter(
      (detail, index, rows) => detail && rows.indexOf(detail) === index
    );
  if (serviceKey === "formal") {
    if (Array.isArray(plan.details) && plan.details.length) {
      return mergeDetails(plan.details);
    }
    if (getPlanId(plan) === "formal:3-course") {
      return mergeDetails(["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"]);
    }
    if (getPlanId(plan) === "formal:2-course") {
      return mergeDetails(["1 Starter", "1 Entree", "Bread"]);
    }
  }
  if (serviceKey !== "catering") return mergeDetails(plan.details || []);
  const fixedDetails = getCateringPackageDetails(plan);
  if (plan.selectionMode === "menu_groups") {
    const constraintDetails = buildCateringConstraintDetails(cateringLimits || plan.constraints);
    return mergeDetails([...constraintDetails, ...fixedDetails]);
  }
  return mergeDetails(fixedDetails);
};

export const normalizeSizeOption = (option) => {
  if (typeof option === "string") {
    return {
      value: option,
      label: `${option} Tray`,
      price: null,
    };
  }
  return {
    value: option?.value || "",
    label: option?.label || `${option?.value || ""} Tray`,
    price: option?.price || null,
  };
};

export const getDisplayGroupTitle = (serviceKey, group) => {
  if (serviceKey !== "formal") return group.title;
  const map = {
    passed: "Passed Appetizers",
    starter: "Starters",
    entree: "Entrees",
    sides: "Sides",
  };
  return map[group.groupKey] || group.title;
};

const isPlanActive = (plan) =>
  Boolean(plan) &&
  plan.isActive !== false;

const getSectionPackages = (section) => {
  if (!section || typeof section !== "object") return [];

  if (section.type === "packages" && Array.isArray(section.packages)) {
    return section.packages
      .filter((pkg) => pkg && typeof pkg === "object")
      .map((pkg) => ({
        planId: pkg.planId || null,
        sectionId: section.sectionId || null,
        sectionTitle: section.title || "",
        title: pkg.title || section.title || "",
        price: pkg.price || "",
        details: Array.isArray(pkg.details) ? pkg.details : [],
        constraints: pkg.constraints || null,
        selectionMode: pkg.selectionMode || "menu_groups",
        selectionGroups: Array.isArray(pkg.selectionGroups) ? pkg.selectionGroups : [],
        isActive: pkg.isActive,
        priceMeta: pkg.priceMeta || null,
      }));
  }

  if (section.type === "package" && section.title) {
    return [
      {
        planId: section.planId || null,
        sectionId: section.sectionId || null,
        sectionTitle: section.title || "",
        title: section.title,
        price: section.price || "",
        details: Array.isArray(section.details) ? section.details : [],
        constraints: section.constraints || null,
        selectionMode: section.selectionMode || "menu_groups",
        selectionGroups: Array.isArray(section.selectionGroups) ? section.selectionGroups : [],
        isActive: section.isActive,
        priceMeta: section.priceMeta || null,
      },
    ];
  }

  if (section.type === "tiers" && Array.isArray(section.tiers)) {
    return section.tiers
      .filter((tier) => tier && typeof tier === "object")
      .map((tier) => ({
        planId: tier.planId || null,
        sectionId: section.sectionId || null,
        sectionTitle: section.title || "",
        title: tier.tierTitle || "",
        price: tier.price || "",
        details: Array.isArray(tier.bullets) ? tier.bullets : [],
        constraints: tier.constraints || null,
        selectionMode: tier.selectionMode || "menu_groups",
        selectionGroups: Array.isArray(tier.selectionGroups) ? tier.selectionGroups : [],
        isActive: tier.isActive,
        priceMeta: tier.priceMeta || null,
      }));
  }

  return [];
};

export const buildServicePlanOptions = (serviceKey, menu, formalPlanOptions) => {
  if (serviceKey === "formal") {
    return (formalPlanOptions || []).filter(isPlanActive);
  }

  const serviceMenu = menu[serviceKey];
  if (!serviceMenu?.sections) return [];

  const plans = [];
  serviceMenu.sections.forEach((section) => {
    getSectionPackages(section).forEach((pkg) => {
      if (pkg.isActive === false) {
        return;
      }
      plans.push({
        id: pkg.planId || `package:${pkg.sectionTitle || pkg.title}`,
        planId: pkg.planId || null,
        sectionId: pkg.sectionId || null,
        sectionTitle: pkg.sectionTitle || null,
        title: pkg.title,
        price: pkg.price || "",
        details: Array.isArray(pkg.details) ? pkg.details : [],
        constraints: pkg.constraints || null,
        selectionMode: pkg.selectionMode || "menu_groups",
        selectionGroups: Array.isArray(pkg.selectionGroups) ? pkg.selectionGroups : [],
        isActive: pkg.isActive,
        priceMeta: pkg.priceMeta || null,
      });
    });
  });

  return plans;
};

export const buildPackageSelectionItemGroups = (plan) => {
  if (!plan || !Array.isArray(plan.selectionGroups)) return [];

  return plan.selectionGroups
    .filter((group) => group && typeof group === "object")
    .map((group) => {
      const items = (group.options || [])
        .map((option) => ({
          id: option.optionKey || option.label || null,
          name: option.label || option.optionLabel || "",
          sizeOptions: [],
        }))
        .filter((item) => item.name);

      return {
        title: group.title || group.groupTitle || "Options",
        groupKey: group.groupKey || group.menuGroupKey || "other",
        items,
      };
    })
    .filter((group) => group.items.length);
};

const toCatalogTrayPrices = (item) => {
  const trayPrices = item?.trayPrices;
  if (trayPrices && typeof trayPrices === "object") {
    return {
      half: trayPrices.half ?? trayPrices.halfTray ?? null,
      full: trayPrices.full ?? trayPrices.fullTray ?? null,
    };
  }
  return {
    half: item?.trayPriceHalf ?? null,
    full: item?.trayPriceFull ?? null,
  };
};

const buildTraySizeOptionsFromTrayPrices = (trayPrices) => {
  const options = [];
  if (isPricedValue(trayPrices?.half)) {
    options.push({ value: "Half", label: `Half Tray (${trayPrices.half})`, price: trayPrices.half });
  }
  if (isPricedValue(trayPrices?.full)) {
    options.push({ value: "Full", label: `Full Tray (${trayPrices.full})`, price: trayPrices.full });
  }
  return options;
};

const buildTraySizeOptionsFromRowValues = (row, columns) => {
  const sizeOptions = [];
  if (!Array.isArray(columns)) return sizeOptions;

  columns.forEach((column, columnIndex) => {
    if (columnIndex === 0) return;
    const columnLabel = String(column || "").toLowerCase();
    if (!columnLabel.includes("half") && !columnLabel.includes("full")) return;

    const priceValue = row[columnIndex];
    if (!isPricedValue(priceValue)) return;
    if (columnLabel.includes("half")) {
      sizeOptions.push({ value: "Half", label: `Half Tray (${priceValue})`, price: priceValue });
    }
    if (columnLabel.includes("full")) {
      sizeOptions.push({ value: "Full", label: `Full Tray (${priceValue})`, price: priceValue });
    }
  });
  return sizeOptions;
};

export const buildServiceItemGroups = (serviceKey, menu, menuOptions) => {
  const serviceData = menu[serviceKey];
  if (!serviceData?.sections) return [];

  const groups = [];
  const addGroup = (title, items, groupKey = "other") => {
    const seen = new Set();
    const uniqueItems = items.filter((item) => {
      if (!item?.name) return false;
      const identityKey = item.id || item.name;
      if (seen.has(identityKey)) return false;
      seen.add(identityKey);
      return true;
    });
    if (!uniqueItems.length) return;
    groups.push({
      title: title || "Menu Items",
      groupKey,
      items: uniqueItems,
    });
  };

  serviceData.sections.forEach((section) => {
    if (!section.type && Array.isArray(section.rows)) {
      const sectionItems = section.rows
        .map((row, rowIndex) => {
          if (!Array.isArray(row) || !row[0]) return null;

          const rowItemRef = Array.isArray(section.rowItems) ? section.rowItems[rowIndex] : null;
          const trayPriceOptions = buildTraySizeOptionsFromTrayPrices(toCatalogTrayPrices(rowItemRef));
          const sizeOptions =
            serviceKey === "togo"
              ? trayPriceOptions.length
                ? trayPriceOptions
                : buildTraySizeOptionsFromRowValues(row, section.columns || [])
              : [];

          return {
            id: rowItemRef?.itemId || null,
            name: rowItemRef?.itemName || row[0],
            sizeOptions,
          };
        })
        .filter(Boolean);

      const sectionGroupKey = section.category || section.courseType || "other";
      if (sectionGroupKey === "sides_salads") {
        const { sides, salads } = splitSidesAndSalads(sectionItems);
        addGroup("Sides", sides, "sides");
        addGroup("Salads", salads, "salads");
      } else {
        addGroup(section.title, sectionItems, sectionGroupKey);
      }
      return;
    }

    if (section.type === "includeMenu" && Array.isArray(section.includeKeys)) {
      section.includeKeys.forEach((includeKey) => {
        const block = menuOptions[includeKey];
        const blockItemRefs = Array.isArray(block?.itemRefs) ? block.itemRefs : [];
        const blockItems = blockItemRefs.length
          ? blockItemRefs.map((itemRef) => {
              const trayPriceOptions = buildTraySizeOptionsFromTrayPrices(toCatalogTrayPrices(itemRef));
              const sizeOptions =
                serviceKey === "togo"
                  ? trayPriceOptions.length
                    ? trayPriceOptions
                    : ["Half", "Full"].map(normalizeSizeOption)
                  : [];
              return {
                id: itemRef?.itemId || null,
                name: itemRef?.itemName || "",
                sizeOptions,
              };
            })
          : (block?.items || []).map((itemName) => ({
              id: null,
              name: itemName,
              sizeOptions: serviceKey === "togo" ? ["Half", "Full"].map(normalizeSizeOption) : [],
            }));
        if (!blockItems.length) return;

        if (block.category === "sides_salads") {
          const { sides, salads } = splitSidesAndSalads(blockItems);
          addGroup("Sides", sides, "sides");
          addGroup("Salads", salads, "salads");
        } else {
          addGroup(block.title, blockItems, block.category || "other");
        }
      });
      return;
    }

    if (section.type === "tiers" && Array.isArray(section.tiers)) {
      if (serviceKey === "catering") return;
      const sectionItems = [];
      section.tiers.forEach((tier) => {
        const bulletItems = Array.isArray(tier?.bulletItems) ? tier.bulletItems : [];
        if (bulletItems.length) {
          bulletItems.forEach((item) =>
            sectionItems.push({
              id: item?.itemId || null,
              name: item?.itemName || "",
              sizeOptions: [],
            })
          );
          return;
        }
        tier?.bullets?.forEach((item) => sectionItems.push({ id: null, name: item, sizeOptions: [] }));
      });
      const sectionGroupKey = section.courseType || "other";
      addGroup(section.title, sectionItems, sectionGroupKey);
      return;
    }

    if (section.type === "packages" && Array.isArray(section.packages)) {
      if (serviceKey === "catering") return;
      const packageItems = section.packages
        .map((pkg) => ({ id: pkg?.planId || null, name: pkg?.title || "", sizeOptions: [] }))
        .filter((pkg) => pkg.name && pkg.name !== "Three-Course Dinner Pricing");
      if (packageItems.length) {
        addGroup("Packages", packageItems, "package");
      }
      return;
    }

    if (section.type === "package" && section.title) {
      if (serviceKey === "catering" || section.title === "Three-Course Dinner Pricing") return;
      addGroup("Packages", [{ id: null, name: section.title, sizeOptions: [] }], "package");
    }
  });

  return groups;
};

export const getPlanDisplayTitle = (serviceKey, plan) => {
  const title = String(plan?.title || "");
  if (serviceKey === "catering") {
    return title.replace(/\s*\([^)]*\)\s*/g, "").trim();
  }
  return title;
};

export const getPlanSectionDisplayTitle = (serviceKey, sectionTitle) => {
  const title = String(sectionTitle || "");
  if (serviceKey === "catering") {
    return title.replace(/Event Catering - Buffet Style/i, "Event/Crew Catering - Buffet Style");
  }
  return title;
};
