import {
  getPackageConstraintOptions,
  normalizePackageConstraintRows,
} from "./servicePackageUtils";

const PRICE_TOKEN_REGEX = /\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\+?/g;
const SIMPLE_PACKAGE_PRICE_PATTERN =
  /^\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\s*(\+)?(?:\s*(?:-|–|—|to)\s*\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\s*([kK])?\s*(\+)?)?\s*(per\s*person|\/person)?\s*$/i;
const PACKAGE_TITLE_MAX_LENGTH = 150;
const PACKAGE_PRICE_MAX_LENGTH = 120;
const PACKAGE_DETAIL_MAX_LENGTH = 255;
const PACKAGE_CHOICE_LABEL_MAX_LENGTH = 150;
const PACKAGE_CHOICE_OPTION_MAX_LENGTH = 150;

const toTrimmedString = (value) => String(value || "").trim();
const collapseWhitespace = (value) => String(value || "").trim().replace(/\s+/g, " ");

const parseWholeNumber = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPriceAmounts = (value) => {
  const normalized = String(value || "");
  const matches = normalized.matchAll(PRICE_TOKEN_REGEX);
  return Array.from(matches)
    .map(([, rawAmount, suffix = ""]) => {
      const parsed = Number.parseFloat(String(rawAmount || "").replace(/,/g, ""));
      if (!Number.isFinite(parsed)) return null;
      return suffix.toLowerCase() === "k" ? parsed * 1000 : parsed;
    })
    .filter(Number.isFinite);
};

const isPriceDisplayValid = (value) => getPriceAmounts(value).length > 0;

const toPriceAmount = (rawAmount, suffix = "") => {
  const parsed = Number.parseFloat(String(rawAmount || "").replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return suffix.toLowerCase() === "k" ? parsed * 1000 : parsed;
};

const formatPriceAmountDisplay = (amount) => {
  if (!Number.isFinite(amount)) return "";
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
  const [wholePart, decimalPart = ""] = fixed.split(".");
  const formattedWhole = Number.parseInt(wholePart, 10).toLocaleString("en-US");
  return decimalPart ? `$${formattedWhole}.${decimalPart}` : `$${formattedWhole}`;
};

export const normalizeSimplePackagePriceDisplay = (value) => {
  const normalized = collapseWhitespace(value);
  if (!normalized) return "";

  const match = normalized.match(SIMPLE_PACKAGE_PRICE_PATTERN);
  if (!match) return normalized;
  const [, amountMin, suffixMin = "", plusMin = "", amountMax = "", suffixMax = "", plusMax = ""] = match;
  if (amountMax && plusMin) return normalized;

  const minAmount = toPriceAmount(amountMin, suffixMin);
  const maxAmount = amountMax ? toPriceAmount(amountMax, suffixMax) : null;
  if (!Number.isFinite(minAmount) || (amountMax && !Number.isFinite(maxAmount))) {
    return normalized;
  }

  const formattedMin = formatPriceAmountDisplay(minAmount);
  if (!formattedMin) return normalized;
  if (amountMax) {
    const formattedMax = formatPriceAmountDisplay(maxAmount);
    if (!formattedMax) return normalized;
    return `${formattedMin}-${formattedMax}${plusMax ? "+" : ""} per person`;
  }
  return `${formattedMin}${plusMin ? "+" : ""} per person`;
};

const toLimitFieldValue = (value) => {
  const parsed = parseWholeNumber(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
};

const toLimitPayloadValue = (value) => {
  const parsed = parseWholeNumber(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const slugifyChoiceKey = (value, separator = "_") =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");

export const sanitizeAdminChoiceOptionLabels = (value) => {
  const seenExactLabels = new Set();
  return String(value || "")
    .split(/\r?\n+/)
    .map((label) => collapseWhitespace(String(label || "").replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, "")))
    .filter(Boolean)
    .filter((label) => {
      if (seenExactLabels.has(label)) return false;
      seenExactLabels.add(label);
      return true;
    });
};

const joinOptionLabels = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option) => collapseWhitespace(option?.option_label || option?.label || option?.name))
    .filter(Boolean)
    .join("\n");

const toDuplicateTextKey = (value) => collapseWhitespace(value).toLowerCase();
const hasTypedValue = (value) => String(value ?? "").trim() !== "";
const buildChoiceRowFieldErrors = () => ({
  message: "",
  source_type: "",
  selection_key: "",
  group_title: "",
  min_select: "",
  max_select: "",
  options_text: "",
});

const sanitizeChoiceRow = (row, index = 0) => {
  const sourceType = toTrimmedString(row?.source_type) === "custom_options" ? "custom_options" : "menu_group";
  const groupTitle = collapseWhitespace(row?.group_title);
  const selectionKey =
    sourceType === "custom_options"
      ? toTrimmedString(row?.selection_key || slugifyChoiceKey(groupTitle || `custom_${index + 1}`))
      : toTrimmedString(row?.selection_key);
  const optionLabels = sanitizeAdminChoiceOptionLabels(row?.options_text);
  return {
    source_type: sourceType,
    selection_key: selectionKey,
    group_title: groupTitle,
    min_select: toLimitFieldValue(row?.min_select),
    max_select: toLimitFieldValue(row?.max_select),
    options_text: optionLabels.join("\n"),
  };
};

export const sanitizeAdminPlanForm = (form, catalogKey = "") => ({
  ...form,
  sectionId: String(form?.sectionId || "").trim(),
  title: collapseWhitespace(form?.title),
  price: normalizeSimplePackagePriceDisplay(form?.price),
  details: Array.isArray(form?.details) ? form.details.map((detail) => collapseWhitespace(detail)) : [],
  choiceRows: Array.isArray(form?.choiceRows)
    ? form.choiceRows.map((row, index) => sanitizeChoiceRow(row, index, catalogKey))
    : [],
});

export const validateAdminPlanForm = (form, catalogKey = "") => {
  const sanitizedForm = sanitizeAdminPlanForm(form, catalogKey);
  const rawChoiceRows = Array.isArray(form?.choiceRows) ? form.choiceRows : [];
  const choiceRowErrors = (Array.isArray(sanitizedForm.choiceRows) ? sanitizedForm.choiceRows : []).map(() =>
    buildChoiceRowFieldErrors()
  );
  const fieldErrors = {
    title: "",
    price: "",
    details: "",
    choiceRows: "",
  };
  const normalizedCatalogKey = toTrimmedString(catalogKey || "").toLowerCase();
  const allowedConstraintKeys = new Set(getPackageConstraintOptions(normalizedCatalogKey).map((option) => option.value));
  const setChoiceRowError = (index, fields, message) => {
    const nextFields = Array.isArray(fields) ? fields : [fields];
    const rowError = choiceRowErrors[index] || buildChoiceRowFieldErrors();
    rowError.message = message;
    nextFields.filter(Boolean).forEach((field) => {
      rowError[field] = message;
    });
    choiceRowErrors[index] = rowError;
    fieldErrors.choiceRows = `Customer choice ${index + 1}: ${message}`;
  };

  if (!sanitizedForm.title) {
    fieldErrors.title = "Package title is required.";
  } else if (sanitizedForm.title.length > PACKAGE_TITLE_MAX_LENGTH) {
    fieldErrors.title = `Package title must be ${PACKAGE_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  if (sanitizedForm.price.length > PACKAGE_PRICE_MAX_LENGTH) {
    fieldErrors.price = `Price display must be ${PACKAGE_PRICE_MAX_LENGTH} characters or fewer.`;
  } else if (sanitizedForm.price && !isPriceDisplayValid(sanitizedForm.price)) {
    fieldErrors.price = "Price display must include at least one numeric amount.";
  }

  const detailRows = Array.isArray(sanitizedForm.details) ? sanitizedForm.details : [];
  const detailKeys = new Set();
  for (const detail of detailRows) {
    if (!detail) {
      fieldErrors.details = "Included items cannot be blank.";
      break;
    }
    if (detail.length > PACKAGE_DETAIL_MAX_LENGTH) {
      fieldErrors.details = `Included items must be ${PACKAGE_DETAIL_MAX_LENGTH} characters or fewer.`;
      break;
    }
    const duplicateKey = toDuplicateTextKey(detail);
    if (detailKeys.has(duplicateKey)) {
      fieldErrors.details = "Included items cannot repeat.";
      break;
    }
    detailKeys.add(duplicateKey);
  }

  const menuSelectionKeys = new Set();
  const customChoiceKeys = new Set();
  const choiceRows = Array.isArray(sanitizedForm.choiceRows) ? sanitizedForm.choiceRows : [];
  for (const [index, row] of choiceRows.entries()) {
    const rawRow = rawChoiceRows[index] || {};
    const minSelect = parseWholeNumber(row?.min_select);
    const maxSelect = parseWholeNumber(row?.max_select);
    const hasMinValue = hasTypedValue(rawRow?.min_select);
    const hasMaxValue = hasTypedValue(rawRow?.max_select);

    if (row?.source_type === "custom_options") {
      if ((hasMinValue && minSelect === null) || (hasMaxValue && maxSelect === null)) {
        setChoiceRowError(
          index,
          [hasMinValue && minSelect === null ? "min_select" : "", hasMaxValue && maxSelect === null ? "max_select" : ""],
          "Custom customer choice Min and Max must use whole numbers when provided."
        );
        break;
      }
      if (maxSelect !== null && maxSelect < 1) {
        setChoiceRowError(index, "max_select", "Each customer choice must allow at least 1 selection.");
        break;
      }
      if (minSelect !== null && maxSelect !== null && minSelect > maxSelect) {
        setChoiceRowError(index, ["min_select", "max_select"], "Each customer choice must use Min less than or equal to Max.");
        break;
      }

      if (!row?.group_title) {
        setChoiceRowError(index, "group_title", "Each custom customer choice needs a label.");
        break;
      }
      if (row.group_title.length > PACKAGE_CHOICE_LABEL_MAX_LENGTH) {
        setChoiceRowError(
          index,
          "group_title",
          `Custom customer choice labels must be ${PACKAGE_CHOICE_LABEL_MAX_LENGTH} characters or fewer.`
        );
        break;
      }

      const customChoiceKey = slugifyChoiceKey(row.group_title);
      if (!customChoiceKey) {
        setChoiceRowError(index, "group_title", "Each custom customer choice needs a label.");
        break;
      }
      if (customChoiceKeys.has(customChoiceKey)) {
        setChoiceRowError(index, "group_title", "Custom customer choice labels must stay unique.");
        break;
      }
      customChoiceKeys.add(customChoiceKey);

      const optionLabels = sanitizeAdminChoiceOptionLabels(row?.options_text);
      if (optionLabels.length < 2) {
        setChoiceRowError(index, "options_text", "Each custom customer choice needs at least 2 unique options.");
        break;
      }

      const optionSlugKeys = new Set();
      for (const optionLabel of optionLabels) {
        if (optionLabel.length > PACKAGE_CHOICE_OPTION_MAX_LENGTH) {
          setChoiceRowError(
            index,
            "options_text",
            `Custom customer choice options must be ${PACKAGE_CHOICE_OPTION_MAX_LENGTH} characters or fewer.`
          );
          break;
        }
        const optionSlugKey = slugifyChoiceKey(optionLabel);
        if (!optionSlugKey) {
          setChoiceRowError(index, "options_text", "Each custom customer choice option needs a label.");
          break;
        }
        if (optionSlugKeys.has(optionSlugKey)) {
          setChoiceRowError(index, "options_text", "Custom customer choice options must stay unique after formatting.");
          break;
        }
        optionSlugKeys.add(optionSlugKey);
      }
      if (fieldErrors.choiceRows) break;
      continue;
    }

    if (minSelect === null || maxSelect === null) {
      setChoiceRowError(
        index,
        [minSelect === null ? "min_select" : "", maxSelect === null ? "max_select" : ""],
        "Each customer choice needs whole-number Min and Max values."
      );
      break;
    }
    if (maxSelect < 1) {
      setChoiceRowError(index, "max_select", "Each customer choice must allow at least 1 selection.");
      break;
    }
    if (minSelect > maxSelect) {
      setChoiceRowError(index, ["min_select", "max_select"], "Each customer choice must use Min less than or equal to Max.");
      break;
    }

    if (!allowedConstraintKeys.has(row?.selection_key)) {
      setChoiceRowError(index, "selection_key", "Each menu-based customer choice must select a menu family.");
      break;
    }
    if (menuSelectionKeys.has(row.selection_key)) {
      setChoiceRowError(index, "selection_key", "Each menu-based customer choice must use a unique menu family.");
      break;
    }
    menuSelectionKeys.add(row.selection_key);
  }

  return {
    sanitizedForm,
    fieldErrors,
    choiceRowErrors,
  };
};

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
  group_title: collapseWhitespace(groupRow?.group_title || groupRow?.groupTitle || groupRow?.title),
  min_select: toLimitFieldValue(
    groupRow?.min_select ?? groupRow?.min ?? matchingConstraintRow?.min_select
  ),
  max_select: toLimitFieldValue(
    groupRow?.max_select ?? groupRow?.max ?? matchingConstraintRow?.max_select
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
      const options = sanitizeAdminChoiceOptionLabels(row?.options_text).map((label, optionIndex) => ({
        option_key: slugifyChoiceKey(label),
        option_label: label,
        sort_order: optionIndex + 1,
      }));
      return {
        group_key: selectionKey,
        group_title: collapseWhitespace(row?.group_title) || selectionKey.replace(/_/g, " "),
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
