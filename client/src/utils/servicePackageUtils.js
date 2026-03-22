const CONSTRAINT_SORT_ORDER = {
  passed: 1,
  starter: 2,
  entree_signature_protein: 3,
  entree: 4,
  signature_protein: 5,
  sides_salads: 6,
  sides: 7,
  salads: 8,
  side: 7,
  salad: 8,
};

const CATERING_CONSTRAINT_ALIASES = {
  entree_signature_protein: "entree_signature_protein",
  entree_signature_proteins: "entree_signature_protein",
  entrees_signature_protein: "entree_signature_protein",
  entrees_signature_proteins: "entree_signature_protein",
  entree: "entree",
  entrees: "entree",
  protein: "signature_protein",
  proteins: "signature_protein",
  signature_protein: "signature_protein",
  signature_proteins: "signature_protein",
  side: "sides",
  sides: "sides",
  salad: "salads",
  salads: "salads",
  sides_salads: "sides_salads",
};

const FORMAL_CONSTRAINT_ALIASES = {
  passed: "passed",
  passed_appetizer: "passed",
  passed_appetizers: "passed",
  starter: "starter",
  starters: "starter",
  entree: "entree",
  entrees: "entree",
  side: "side",
  sides: "side",
};

export const CATERING_PACKAGE_CONSTRAINT_OPTIONS = [
  { value: "entree_signature_protein", label: "Entrees / Signature Proteins" },
  { value: "entree", label: "Entrees Only" },
  { value: "signature_protein", label: "Signature Proteins Only" },
  { value: "sides", label: "Sides Only" },
  { value: "salads", label: "Salads Only" },
  { value: "sides_salads", label: "Sides / Salads" },
];

export const FORMAL_PACKAGE_CONSTRAINT_OPTIONS = [
  { value: "passed", label: "Passed Appetizers" },
  { value: "starter", label: "Starters" },
  { value: "entree", label: "Entrees" },
  { value: "side", label: "Sides" },
];

const GENERATED_CATERING_COUNT_DETAIL_PATTERN =
  /^(?:select\s+)?\d+(?:\s*-\s*\d+)?\s+(?:entree(?:s)?(?:\/signature protein(?:s)?)?|protein(?:s)?|side(?:s)?(?:\/salad(?:s)?)?|salad(?:s)?)(?:\b|$)/i;

const normalizeCatalogKey = (catalogKey) => {
  const normalized = String(catalogKey || "").trim().toLowerCase();
  return normalized;
};

const normalizeConstraintKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const canonicalizeConstraintKey = (value, catalogKey = "") => {
  const normalizedKey = normalizeConstraintKey(value);
  if (!normalizedKey) return "";

  const normalizedCatalog = normalizeCatalogKey(catalogKey);
  if (normalizedCatalog === "formal") {
    return FORMAL_CONSTRAINT_ALIASES[normalizedKey] || normalizedKey;
  }
  if (normalizedCatalog === "catering") {
    return CATERING_CONSTRAINT_ALIASES[normalizedKey] || normalizedKey;
  }
  return normalizedKey;
};

const toConstraintEntries = (constraints) => {
  if (Array.isArray(constraints)) {
    return constraints
      .filter((row) => row && typeof row === "object")
      .map((row) => [
        row.selection_key || row.constraint_key || row.key,
        {
          min: row.min_select ?? row.min,
          max: row.max_select ?? row.max,
        },
      ]);
  }
  if (constraints && typeof constraints === "object") {
    return Object.entries(constraints);
  }
  return [];
};

const toNormalizedLimitValue = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const toNormalizedConstraintLimits = (value) => {
  if (typeof value === "number") {
    return {
      min: value >= 0 ? value : null,
      max: value >= 0 ? value : null,
    };
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  let min = toNormalizedLimitValue(value.min);
  let max = toNormalizedLimitValue(value.max);
  if (min === null) {
    min = toNormalizedLimitValue(value.min_select);
  }
  if (max === null) {
    max = toNormalizedLimitValue(value.max_select);
  }
  if (min === null && max === null) return null;
  if (min === null) min = max;
  if (max === null) max = min;
  if (max < min) {
    return { min: max, max: min };
  }
  return { min, max };
};

export const normalizePackageConstraintMap = (constraints, catalogKey = "") => {
  const normalized = {};
  toConstraintEntries(constraints).forEach(([rawKey, rawValue]) => {
    const selectionKey = canonicalizeConstraintKey(rawKey, catalogKey);
    const limits = toNormalizedConstraintLimits(rawValue);
    if (!selectionKey || !limits) return;
    if (normalized[selectionKey]) {
      normalized[selectionKey] = {
        min: (normalized[selectionKey].min || 0) + (limits.min || 0),
        max: (normalized[selectionKey].max || 0) + (limits.max || 0),
      };
      return;
    }
    normalized[selectionKey] = limits;
  });

  return Object.fromEntries(
    Object.entries(normalized).sort(
      ([leftKey], [rightKey]) =>
        (CONSTRAINT_SORT_ORDER[leftKey] ?? 99) - (CONSTRAINT_SORT_ORDER[rightKey] ?? 99) ||
        leftKey.localeCompare(rightKey)
    )
  );
};

export const normalizePackageConstraintRows = (constraints, catalogKey = "") =>
  Object.entries(normalizePackageConstraintMap(constraints, catalogKey)).map(([selection_key, limits]) => ({
    selection_key,
    min_select: limits.min ?? "",
    max_select: limits.max ?? "",
  }));

export const getPackageConstraintOptions = (catalogKey = "") =>
  normalizeCatalogKey(catalogKey) === "formal"
    ? FORMAL_PACKAGE_CONSTRAINT_OPTIONS
    : CATERING_PACKAGE_CONSTRAINT_OPTIONS;

export const filterGeneratedPackageDetails = (details, { catalogKey = "", selectionMode = "menu_groups" } = {}) => {
  if (!Array.isArray(details)) return [];
  const normalizedCatalog = normalizeCatalogKey(catalogKey);
  return details
    .map((detail) => String(detail || "").trim())
    .filter(Boolean)
    .filter(
      (detail) =>
        !(
          normalizedCatalog === "catering" &&
          selectionMode === "menu_groups" &&
          GENERATED_CATERING_COUNT_DETAIL_PATTERN.test(detail)
        )
    );
};

const toConstraintDetail = (limits, singularLabel, pluralLabel) => {
  if (!limits?.max) return null;
  const min = limits.min || 0;
  const max = limits.max;
  if (min && min === max) {
    return `${max} ${max === 1 ? singularLabel : pluralLabel}`;
  }
  if (min && min < max) {
    return `${min}-${max} ${pluralLabel}`;
  }
  return `${max} ${pluralLabel}`;
};

export const buildCateringConstraintDetails = (constraints) => {
  const normalizedConstraints = normalizePackageConstraintMap(constraints, "catering");
  return [
    toConstraintDetail(
      normalizedConstraints.entree_signature_protein,
      "Entree/Signature Protein",
      "Entrees/Signature Proteins"
    ),
    toConstraintDetail(normalizedConstraints.entree, "Entree", "Entrees"),
    toConstraintDetail(
      normalizedConstraints.signature_protein,
      "Signature Protein",
      "Signature Proteins"
    ),
    toConstraintDetail(normalizedConstraints.sides_salads, "Side/Salad", "Sides/Salads"),
    toConstraintDetail(normalizedConstraints.sides, "Side", "Sides"),
    toConstraintDetail(normalizedConstraints.salads, "Salad", "Salads"),
  ].filter(Boolean);
};
