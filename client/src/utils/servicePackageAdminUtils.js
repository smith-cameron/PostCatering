import {
  getPackageConstraintOptions,
  normalizePackageConstraintRows,
} from "./servicePackageUtils";

const toTrimmedString = (value) => String(value || "").trim();

const toLimitFieldValue = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
};

const toLimitPayloadValue = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const slugifyChoiceKey = (value, separator = "_") =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");

const parseOptionLabels = (value) =>
  String(value || "")
    .split(/\r?\n|,/)
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label, index, rows) => rows.indexOf(label) === index);

const joinOptionLabels = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option) => toTrimmedString(option?.option_label || option?.label || option?.name))
    .filter(Boolean)
    .join(", ");

const buildMenuChoiceRow = (constraintRow) => ({
  source_type: "menu_group",
  selection_key: toTrimmedString(constraintRow?.selection_key),
  group_title: "",
  min_select: toLimitFieldValue(constraintRow?.min_select),
  max_select: toLimitFieldValue(constraintRow?.max_select),
  options_text: "",
});

const buildCustomChoiceRow = (groupRow, matchingConstraintRow) => ({
  source_type: "custom_options",
  selection_key: toTrimmedString(groupRow?.group_key || groupRow?.groupKey),
  group_title: toTrimmedString(groupRow?.group_title || groupRow?.groupTitle || groupRow?.title),
  min_select: toLimitFieldValue(
    matchingConstraintRow?.min_select ?? groupRow?.min_select ?? groupRow?.min
  ),
  max_select: toLimitFieldValue(
    matchingConstraintRow?.max_select ?? groupRow?.max_select ?? groupRow?.max
  ),
  options_text: joinOptionLabels(groupRow?.options),
});

export const buildAdminChoiceRows = (plan, catalogKey = "") => {
  const normalizedCatalogKey = toTrimmedString(plan?.catalog_key || catalogKey);
  const constraintRows = normalizePackageConstraintRows(plan?.constraints, normalizedCatalogKey);
  const constraintsByKey = new Map(
    constraintRows.map((row) => [toTrimmedString(row?.selection_key), row])
  );
  const selectionGroups = Array.isArray(plan?.selection_groups || plan?.selectionGroups)
    ? plan.selection_groups || plan.selectionGroups
    : [];

  const customRows = selectionGroups
    .filter((group) => group && typeof group === "object")
    .map((group) => {
      const groupKey = toTrimmedString(group?.group_key || group?.groupKey);
      const matchingConstraintRow = constraintsByKey.get(groupKey);
      if (groupKey) {
        constraintsByKey.delete(groupKey);
      }
      return buildCustomChoiceRow(group, matchingConstraintRow);
    })
    .filter(
      (row) => row.selection_key || row.group_title || row.options_text || row.min_select || row.max_select
    );

  const menuRows = Array.from(constraintsByKey.values())
    .map((row) => buildMenuChoiceRow(row))
    .filter((row) => row.selection_key);

  return [...menuRows, ...customRows];
};

const normalizeMenuChoiceRows = (rows, catalogKey = "") => {
  const allowedKeys = new Set(getPackageConstraintOptions(catalogKey).map((option) => option.value));
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => toTrimmedString(row?.source_type) !== "custom_options")
    .map((row) => {
      const selectionKey = toTrimmedString(row?.selection_key);
      return {
        selection_key: selectionKey,
        min: toLimitPayloadValue(row?.min_select),
        max: toLimitPayloadValue(row?.max_select),
      };
    })
    .filter(
      (row) =>
        allowedKeys.has(row.selection_key) &&
        (Number.isFinite(row.min) || Number.isFinite(row.max))
    );
};

const normalizeCustomChoiceRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => toTrimmedString(row?.source_type) === "custom_options")
    .map((row, index) => {
      const selectionKey =
        toTrimmedString(row?.selection_key) || slugifyChoiceKey(row?.group_title || `custom_${index + 1}`);
      const options = parseOptionLabels(row?.options_text).map((label, optionIndex) => ({
        option_key: slugifyChoiceKey(label),
        option_label: label,
        sort_order: optionIndex + 1,
      }));
      return {
        group_key: selectionKey,
        group_title: toTrimmedString(row?.group_title) || selectionKey.replace(/_/g, " "),
        source_type: "custom_options",
        min: toLimitPayloadValue(row?.min_select),
        max: toLimitPayloadValue(row?.max_select),
        sort_order: index + 1,
        options,
      };
    })
    .filter((row) => row.group_key && row.options.length);

export const buildAdminChoicePayload = (rows, catalogKey = "") => {
  const customChoiceRows = normalizeCustomChoiceRows(rows);
  const customChoiceKeys = new Set(customChoiceRows.map((row) => row.group_key));
  const menuChoiceRows = normalizeMenuChoiceRows(rows, catalogKey).filter(
    (row) => !customChoiceKeys.has(row.selection_key)
  );

  const customChoiceConstraints = customChoiceRows
    .map((row) => ({
      selection_key: row.group_key,
      min: row.min,
      max: row.max,
    }))
    .filter((row) => Number.isFinite(row.min) || Number.isFinite(row.max));

  const selectionGroups = customChoiceRows.map((row) => ({
    group_key: row.group_key,
    group_title: row.group_title,
    source_type: row.source_type,
    min_select: row.min,
    max_select: row.max,
    sort_order: row.sort_order,
    options: row.options,
  }));

  const constraints = [...menuChoiceRows, ...customChoiceConstraints];
  const hasMenuChoices = menuChoiceRows.length > 0;
  const hasCustomChoices = selectionGroups.length > 0;

  let selectionMode = "none";
  if (hasMenuChoices && hasCustomChoices) {
    selectionMode = "hybrid";
  } else if (hasCustomChoices) {
    selectionMode = "custom_options";
  } else if (hasMenuChoices) {
    selectionMode = "menu_groups";
  }

  return {
    constraints,
    selection_groups: selectionGroups,
    selection_mode: selectionMode,
  };
};

export const buildEmptyAdminChoiceRow = (sourceType = "menu_group") => ({
  source_type: sourceType,
  selection_key: "",
  group_title: "",
  min_select: "",
  max_select: "",
  options_text: "",
});
