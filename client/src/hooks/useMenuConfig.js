import { useEffect, useState } from "react";

const EMPTY = {
  menu: {},
  menuOptions: {},
  formalPlanOptions: [],
};

const useMenuConfig = () => {
  const [state, setState] = useState({
    ...EMPTY,
    loading: true,
    error: "",
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/menus");
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Failed to load menu config.");
        }
        const menu = body.menu || body.MENU || {};
        const menuOptions = body.menu_options || body.MENU_OPTIONS || {};
        const formalPlanOptions = body.formal_plan_options || body.FORMAL_PLAN_OPTIONS || [];
        if (!menu || typeof menu !== "object" || !Object.keys(menu).length) {
          throw new Error("Unexpected /api/menus payload. Expected menu config keys are missing.");
        }
        if (!isMounted) return;
        setState({
          menu,
          menuOptions,
          formalPlanOptions,
          loading: false,
          error: "",
        });
      } catch (error) {
        if (!isMounted) return;
        setState({
          ...EMPTY,
          loading: false,
          error: error?.message || "Failed to load menu config.",
        });
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return state;
};

export default useMenuConfig;
