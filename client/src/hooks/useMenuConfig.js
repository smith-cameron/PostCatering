import { useEffect, useState } from "react";

const EMPTY = {
  menu: {},
  menuOptions: {},
  formalPlanOptions: [],
};

let cachedMenuConfig = null;
let inFlightMenuConfigRequest = null;

const FIELD_KEY_MAP = {
  page_title: "pageTitle",
  intro_blocks: "introBlocks",
  section_id: "sectionId",
  course_type: "courseType",
  include_keys: "includeKeys",
  tier_title: "tierTitle",
  price_meta: "priceMeta",
  amount_min: "amountMin",
  amount_max: "amountMax",
  price_currency: "priceCurrency",
  price_unit: "priceUnit",
};

const toClientShape = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => toClientShape(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      const mappedKey = FIELD_KEY_MAP[key] || key;
      acc[mappedKey] = toClientShape(entry);
      return acc;
    }, {});
  }

  return value;
};

const normalizeMenuConfig = (body) => {
  const menuOptionsRaw = body.menu_options || {};
  const formalPlanOptionsRaw = body.formal_plan_options || [];
  const menuRaw = body.menu || {};

  const menuOptions = Object.entries(menuOptionsRaw).reduce((acc, [key, option]) => {
    acc[key] = toClientShape(option);
    return acc;
  }, {});

  const menu = Object.entries(menuRaw).reduce((acc, [catalogKey, catalog]) => {
    acc[catalogKey] = toClientShape(catalog);
    return acc;
  }, {});

  const formalPlanOptions = formalPlanOptionsRaw.map((plan) => toClientShape(plan));

  return {
    menu,
    menuOptions,
    formalPlanOptions,
  };
};

const fetchMenuConfig = async () => {
  const response = await fetch("/api/menus");
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Failed to load menu config.");
  }

  const normalized = normalizeMenuConfig(body);
  if (!normalized.menu || typeof normalized.menu !== "object" || !Object.keys(normalized.menu).length) {
    throw new Error("Unexpected /api/menus payload. Expected menu config keys are missing.");
  }

  return normalized;
};

const getSharedMenuConfig = async () => {
  if (cachedMenuConfig) {
    return cachedMenuConfig;
  }

  if (!inFlightMenuConfigRequest) {
    inFlightMenuConfigRequest = fetchMenuConfig()
      .then((config) => {
        cachedMenuConfig = config;
        return config;
      })
      .finally(() => {
        inFlightMenuConfigRequest = null;
      });
  }

  return inFlightMenuConfigRequest;
};

const useMenuConfig = () => {
  const [state, setState] = useState(() =>
    cachedMenuConfig
      ? {
          ...cachedMenuConfig,
          loading: false,
          error: "",
        }
      : {
          ...EMPTY,
          loading: true,
          error: "",
        }
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const { menu, menuOptions, formalPlanOptions } = await getSharedMenuConfig();
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
