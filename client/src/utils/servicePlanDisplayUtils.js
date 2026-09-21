const FORMAL_PLAN_FALLBACK_DETAILS = {
  "formal:2-course": ["1 Starter", "1 Entree", "Bread"],
  "formal:3-course": ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"],
};

export const getServicePlanId = (plan) => String(plan?.planId || plan?.id || "").trim();

export const getSelectionGroupBullet = (group) => {
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

export const getSelectionGroupBullets = (selectionGroups) =>
  (Array.isArray(selectionGroups) ? selectionGroups : []).map(getSelectionGroupBullet).filter(Boolean);

export const mergeUniquePlanDetails = (...detailGroups) =>
  detailGroups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .filter((detail, index, rows) => detail && rows.indexOf(detail) === index);

export const getFormalPlanDetails = (plan) => {
  if (!plan) return [];
  if (Array.isArray(plan.details) && plan.details.length) {
    return plan.details;
  }
  return FORMAL_PLAN_FALLBACK_DETAILS[getServicePlanId(plan)] || plan.details || [];
};
