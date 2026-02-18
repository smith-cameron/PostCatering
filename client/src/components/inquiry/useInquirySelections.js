import { useMemo } from "react";
import {
  COMMUNITY_TACO_BAR_OPTIONS,
  buildCommunitySelectionRules,
  buildServiceItemGroups,
  buildServicePlanOptions,
  getDisplayPlanDetails,
  isCommunityTacoBarPlan,
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

  const communitySelectionRules = useMemo(() => {
    if (formServiceInterest !== "community") return null;
    return buildCommunitySelectionRules(selectedServicePlan);
  }, [formServiceInterest, selectedServicePlan]);

  const displayedPlanDetails = useMemo(
    () => getDisplayPlanDetails(formServiceInterest, selectedServicePlan, communitySelectionRules),
    [formServiceInterest, selectedServicePlan, communitySelectionRules]
  );

  const shouldRequirePlanSelection = formServiceInterest === "community" || formServiceInterest === "formal";

  const desiredItemGroups = useMemo(() => {
    const groups = buildServiceItemGroups(formServiceInterest, menu, menuOptions);
    if (formServiceInterest === "community" && isCommunityTacoBarPlan(selectedServicePlan)) {
      return [
        {
          title: "Taco Bar Proteins",
          groupKey: "entree",
          items: COMMUNITY_TACO_BAR_OPTIONS.map((item) => ({ name: item, sizeOptions: [] })),
        },
      ];
    }

    if (formServiceInterest !== "formal") return groups;
    const groupsWithoutSides = groups.filter((group) => group.groupKey !== "sides");
    if (servicePlanId === "formal:2-course") {
      return groupsWithoutSides.filter((group) => group.groupKey !== "passed");
    }
    return groupsWithoutSides;
  }, [formServiceInterest, servicePlanId, selectedServicePlan, menu, menuOptions]);

  const itemSizeOptions = useMemo(() => {
    const map = {};
    desiredItemGroups.forEach((group) => {
      group.items.forEach((item) => {
        map[item.name] = (item.sizeOptions || []).map(normalizeSizeOption);
      });
    });
    return map;
  }, [desiredItemGroups]);

  const canShowDesiredItems = Boolean(formServiceInterest) && (!shouldRequirePlanSelection || Boolean(selectedServicePlan));

  return {
    serviceOptions,
    servicePlans,
    selectedServicePlan,
    communitySelectionRules,
    displayedPlanDetails,
    shouldRequirePlanSelection,
    canShowDesiredItems,
    desiredItemGroups,
    itemSizeOptions,
  };
};

export default useInquirySelections;
