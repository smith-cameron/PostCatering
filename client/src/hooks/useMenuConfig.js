import { useEffect, useState } from "react";

const EMPTY = {
  menu: {},
  menuOptions: {},
  formalPlanOptions: [],
  sharedNonFormalItems: [],
};

let cachedMenuConfig = null;
let inFlightMenuConfigRequest = null;

const FIELD_KEY_MAP = {
  page_title: "pageTitle",
  shared_non_formal_items: "sharedNonFormalItems",
  intro_blocks: "introBlocks",
  section_id: "sectionId",
  course_type: "courseType",
  include_keys: "includeKeys",
  tier_title: "tierTitle",
  row_items: "rowItems",
  bullet_items: "bulletItems",
  item_refs: "itemRefs",
  item_id: "itemId",
  item_name: "itemName",
  item_type: "itemType",
  item_category: "itemCategory",
  tray_prices: "trayPrices",
  tray_price_half: "trayPriceHalf",
  tray_price_full: "trayPriceFull",
  is_active: "isActive",
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
  const sharedNonFormalItemsRaw = body.shared_non_formal_items || [];

  const menuOptions = Object.entries(menuOptionsRaw).reduce((acc, [key, option]) => {
    acc[key] = toClientShape(option);
    return acc;
  }, {});

  const menu = Object.entries(menuRaw).reduce((acc, [catalogKey, catalog]) => {
    acc[catalogKey] = toClientShape(catalog);
    return acc;
  }, {});

  const formalPlanOptions = formalPlanOptionsRaw.map((plan) => toClientShape(plan));
  const sharedNonFormalItems = sharedNonFormalItemsRaw.map((item) => toClientShape(item));

  return {
    menu,
    menuOptions,
    formalPlanOptions,
    sharedNonFormalItems,
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
        const { menu, menuOptions, formalPlanOptions, sharedNonFormalItems } = await getSharedMenuConfig();
        if (!isMounted) return;
        setState({
          menu,
          menuOptions,
          formalPlanOptions,
          sharedNonFormalItems,
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
