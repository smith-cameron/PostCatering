export const normalizeMenuText = (value) => value;

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
  if (!section?.description) return [];
  const trimmed = section.description.trim();
  const withoutIncludes = trimmed.replace(/^includes\s*/i, "");
  const bullets = [];

  const proteinMatch = section.title?.match(/\(([^)]+)\)/);
  if (section.sectionId === "community_taco_bar" && proteinMatch?.[1]) {
    bullets.push(`Protein: ${proteinMatch[1]}`);
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
      acc[key] = { max: value };
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
  if (min && min === max) return `${max} ${label}`;
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
