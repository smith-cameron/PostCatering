import { useMemo } from "react";
import {
  buildCateringSelectionRules,
  buildPackageSelectionItemGroups,
  buildServiceItemGroups,
  buildServicePlanOptions,
  getDisplayPlanDetails,
  normalizeSizeOption,
} from "./inquiryUtils";

const useInquirySelections = ({
  formServiceInterest,
  servicePlanId,
  menu,
  menuOptions,
  formalPlanOptions,
}) => {
  const serviceOptions = useMemo(
    () =>
      Object.entries(menu).map(([key, value]) => ({
        key,
        label: value.pageTitle,
      })),
    [menu]
  );

  const servicePlans = useMemo(
    () => buildServicePlanOptions(formServiceInterest, menu, formalPlanOptions),
    [formServiceInterest, menu, formalPlanOptions]
  );

  const selectedServicePlan = useMemo(
    () => servicePlans.find((plan) => plan.id === servicePlanId) || null,
    [servicePlans, servicePlanId]
  );

  const cateringSelectionRules = useMemo(() => {
    if (formServiceInterest !== "catering") return null;
    return buildCateringSelectionRules(selectedServicePlan);
  }, [formServiceInterest, selectedServicePlan]);

  const displayedPlanDetails = useMemo(
    () => getDisplayPlanDetails(formServiceInterest, selectedServicePlan, cateringSelectionRules),
    [formServiceInterest, selectedServicePlan, cateringSelectionRules]
  );

  const shouldRequirePlanSelection = formServiceInterest === "catering" || formServiceInterest === "formal";

  const desiredItemGroups = useMemo(() => {
    const groups = buildServiceItemGroups(formServiceInterest, menu, menuOptions);
    if (formServiceInterest === "catering") {
      if (selectedServicePlan?.selectionMode === "none") {
        return [];
      }
      if (selectedServicePlan?.selectionMode === "custom_options") {
        return buildPackageSelectionItemGroups(selectedServicePlan);
      }
      if (selectedServicePlan?.selectionMode === "hybrid") {
        return [...buildPackageSelectionItemGroups(selectedServicePlan), ...groups];
      }
    }

    if (formServiceInterest !== "formal") return groups;
    const groupsWithoutSides = groups.filter((group) => group.groupKey !== "sides");
    const selectedConstraintKeys = new Set(Object.keys(selectedServicePlan?.constraints || {}));
    if (!selectedConstraintKeys.size) {
      return groupsWithoutSides;
    }
    return groupsWithoutSides.filter(
      (group) => group.groupKey === "package" || selectedConstraintKeys.has(group.groupKey)
    );
  }, [formServiceInterest, selectedServicePlan, menu, menuOptions]);

  const itemSizeOptions = useMemo(() => {
    const map = {};
    desiredItemGroups.forEach((group) => {
      group.items.forEach((item) => {
        map[item.name] = (item.sizeOptions || []).map(normalizeSizeOption);
      });
    });
    return map;
  }, [desiredItemGroups]);

  const requiresDesiredItemSelection = desiredItemGroups.length > 0;
  const canShowDesiredItems = Boolean(formServiceInterest) && (!shouldRequirePlanSelection || Boolean(selectedServicePlan));

  return {
    serviceOptions,
    servicePlans,
    selectedServicePlan,
    cateringSelectionRules,
    displayedPlanDetails,
    shouldRequirePlanSelection,
    requiresDesiredItemSelection,
    canShowDesiredItems,
    desiredItemGroups,
    itemSizeOptions,
  };
};

export default useInquirySelections;
