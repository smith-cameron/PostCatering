import { useMemo } from "react";
import { buildMenuSections, getApprovedFormalPlans, getFormalMenuBlocks } from "./serviceMenuUtils";

const useServiceMenuData = ({ menuKey, menu, menuOptions, formalPlanOptions }) => {
  const data = menu[menuKey];
  const formalCatalogSections = menu?.formal?.sections;
  const approvedFormalPlans = useMemo(
    () => getApprovedFormalPlans(formalPlanOptions),
    [formalPlanOptions]
  );
  const allFormalMenuBlocks = useMemo(
    () => getFormalMenuBlocks(formalCatalogSections),
    [formalCatalogSections]
  );
  const excludedNonFormalItemNames = useMemo(
    () =>
      new Set(
        allFormalMenuBlocks
          .flatMap((block) => block.items || [])
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean)
      ),
    [allFormalMenuBlocks]
  );
  const formalMenuBlocks = useMemo(
    () => (menuKey === "formal" ? allFormalMenuBlocks : []),
    [menuKey, allFormalMenuBlocks]
  );
  const sections = useMemo(
    () =>
      buildMenuSections({
        menuKey,
        data,
        menuOptions,
        approvedFormalPlans,
        formalMenuBlocks,
        excludedNonFormalItemNames,
      }),
    [menuKey, data, menuOptions, approvedFormalPlans, formalMenuBlocks, excludedNonFormalItemNames]
  );

  return {
    data,
    sections,
  };
};

export default useServiceMenuData;
