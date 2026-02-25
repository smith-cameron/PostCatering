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

export const COMMUNITY_TACO_BAR_OPTIONS = ["Carne Asada", "Chicken", "Marinated Pork"];

export const toIdPart = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

export const buildCommunitySelectionRules = (plan) => {
  if (!plan) return null;
  const normalizedTitle = String(plan.title || "").toLowerCase();

  if (normalizedTitle.includes("hearty homestyle")) {
    return {
      entree: { min: 1, max: 1 },
      sides_salads: { min: 2, max: 2 },
    };
  }

  if (plan.sectionId === "community_buffet_tiers" && normalizedTitle.includes("tier 1")) {
    return {
      entree: { min: 2, max: 2 },
      sides: { min: 2, max: 2 },
      salads: { min: 1, max: 1 },
    };
  }

  if (plan.sectionId === "community_buffet_tiers" && normalizedTitle.includes("tier 2")) {
    return {
      entree: { min: 2, max: 3 },
      sides: { min: 3, max: 3 },
      salads: { min: 2, max: 2 },
    };
  }

  if (plan.constraints && typeof plan.constraints === "object") {
    const normalizedConstraints = Object.entries(plan.constraints).reduce((acc, [key, value]) => {
      if (typeof value === "number") {
        acc[key] = { min: value, max: value };
      } else if (value && typeof value === "object") {
        acc[key] = value;
      }
      return acc;
    }, {});
    if (normalizedConstraints.sides_salads && !normalizedConstraints.sides && !normalizedConstraints.salads) {
      const combined = normalizedConstraints.sides_salads;
      delete normalizedConstraints.sides_salads;
      normalizedConstraints.sides = combined;
    }
    return normalizedConstraints;
  }
  return null;
};

const toTitleCase = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const toMatchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const getSelectionCategoryKeyFromText = (value) => {
  const lower = toMatchText(value);
  if (lower.includes("passed")) return "passed";
  if (lower.includes("starter")) return "starter";
  if (lower.includes("salad")) return "salads";
  if (lower.includes("side")) return "sides";
  if (lower.includes("entree") || lower.includes("protein")) return "entree";
  return null;
};

const parseCommunityPackageDetails = (details) => {
  const joined = (details || []).join(" ").trim();
  if (!joined) return [];

  const cleaned = joined.replace(/^includes\s*/i, "");
  if (cleaned.includes("+")) {
    return cleaned
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase();
        if (/^\d+\s+/.test(lower)) return `Select ${toTitleCase(part)}`;
        return toTitleCase(part);
      });
  }
  if (cleaned.includes(",")) {
    return cleaned
      .split(",")
      .map((part) => toTitleCase(part.trim()))
      .filter(Boolean);
  }
  return [toTitleCase(cleaned)];
};

const getCommunityPackageDetails = (plan) => {
  if (!plan) return [];
  const normalizedTitle = String(plan.title || "").toLowerCase();
  if (normalizedTitle.includes("hearty homestyle")) {
    return ["1 Entree/Protein", "2 Side/Salad", "Bread"];
  }
  return parseCommunityPackageDetails(plan.details);
};

export const getDisplayPlanDetails = (serviceKey, plan, communityLimits) => {
  if (!plan) return [];
  if (serviceKey === "formal" && plan.level === "package") {
    if (plan.id === "formal:3-course") {
      return ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"];
    }
    if (plan.id === "formal:2-course") {
      return ["1 Starter", "1 Entree", "Bread"];
    }
  }
  if (serviceKey === "community" && plan.level === "package") {
    return getCommunityPackageDetails(plan);
  }
  if (serviceKey !== "community" || plan.level !== "tier") return plan.details || [];

  const normalizedTierTitle = String(plan.title || "").toLowerCase();
  if (plan.sectionId === "community_buffet_tiers" && normalizedTierTitle.includes("tier 1")) {
    return ["2 Entrees/Protiens", "2 Sides", "1 Salad", "Bread"];
  }
  if (plan.sectionId === "community_buffet_tiers" && normalizedTierTitle.includes("tier 2")) {
    return ["2-3 Entrees/Protiens", "3 Sides", "2 Salads", "Bread"];
  }

  const details = [];
  const toCommunityCountDetail = (limits, pluralLabel) => {
    if (!limits?.max) return null;
    const min = limits?.min || 0;
    const max = limits.max;
    const singularLabel = pluralLabel.replace(/s$/i, "");
    if (min && min === max) return `${max} ${max === 1 ? singularLabel : pluralLabel}`;
    if (min && min < max) return `${min}-${max} ${pluralLabel}`;
    return `${max} ${pluralLabel}`;
  };

  if (communityLimits?.entree?.max) {
    details.push(toCommunityCountDetail(communityLimits.entree, "entrees"));
  }

  const sideDetail = toCommunityCountDetail(communityLimits?.sides, "sides");
  if (sideDetail) details.push(sideDetail);
  const saladDetail = toCommunityCountDetail(communityLimits?.salads, "salads");
  if (saladDetail) details.push(saladDetail);

  if (!communityLimits?.sides && !communityLimits?.salads && communityLimits?.sides_salads?.max) {
    const combined = toCommunityCountDetail(communityLimits.sides_salads, "sides/salads");
    if (combined) details.push(combined);
  }
  details.push("bread");

  return details.length ? details : plan.details || [];
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

const getApprovedFormalPlans = (plans) => (plans || []).filter((plan) => plan.id !== "formal:2-course");

export const buildServicePlanOptions = (serviceKey, menu, formalPlanOptions) => {
  if (serviceKey === "formal") {
    return getApprovedFormalPlans(formalPlanOptions);
  }

  const serviceMenu = menu[serviceKey];
  if (!serviceMenu?.sections) return [];

  const plans = [];
  serviceMenu.sections.forEach((section) => {
    if (section.type === "package" && section.title) {
      plans.push({
        id: `package:${section.title}`,
        level: "package",
        sectionId: section.sectionId || null,
        title: section.title,
        price: section.price || "",
        details: section.description ? [section.description] : [],
        constraints: section.constraints || null,
      });
      return;
    }

    if (section.type === "tiers" && Array.isArray(section.tiers)) {
      section.tiers.forEach((tier) => {
        plans.push({
          id: `tier:${section.title}:${tier.tierTitle}`,
          level: "tier",
          sectionId: section.sectionId || null,
          courseType: section.courseType || null,
          sectionTitle: section.title,
          title: tier.tierTitle,
          price: tier.price || "",
          details: tier.bullets || [],
          constraints: tier.constraints || null,
        });
      });
    }
  });

  return plans;
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
      if (serviceKey === "community") return;
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

    if (section.type === "package" && section.title) {
      if (serviceKey === "community" || section.title === "Three-Course Dinner Pricing") return;
      addGroup("Packages", [{ id: null, name: section.title, sizeOptions: [] }], "package");
    }
  });

  return groups;
};

export const isCommunityTacoBarPlan = (plan) =>
  Boolean(plan && plan.level === "package" && String(plan.title || "").toLowerCase().includes("taco bar"));

export const getPlanDisplayTitle = (serviceKey, plan) => {
  const title = String(plan?.title || "");
  if (serviceKey === "community") {
    return title.replace(/\s*\([^)]*\)\s*/g, "").trim();
  }
  return title;
};

export const getPlanSectionDisplayTitle = (serviceKey, sectionTitle) => {
  const title = String(sectionTitle || "");
  if (serviceKey === "community") {
    return title.replace(/Event Catering - Buffet Style/i, "Event/Crew Catering - Buffet Style");
  }
  return title;
};
