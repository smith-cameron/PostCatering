import { useMemo } from "react";
import { getApprovedFormalPlans, getFormalMenuBlocks } from "./serviceMenuUtils";

const useServiceMenuData = ({ menuKey, menu, formalPlanOptions }) => {
  const data = menu[menuKey];
  const approvedFormalPlans = useMemo(
    () => getApprovedFormalPlans(formalPlanOptions),
    [formalPlanOptions]
  );
  const formalMenuBlocks = useMemo(
    () => (menuKey === "formal" ? getFormalMenuBlocks(data?.sections) : []),
    [menuKey, data?.sections]
  );

  return {
    data,
    approvedFormalPlans,
    formalMenuBlocks,
  };
};

export default useServiceMenuData;
