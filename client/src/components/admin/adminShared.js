export const ADMIN_TAB_MENU = "menu";
export const ADMIN_TAB_PACKAGES = "packages";
export const ADMIN_TAB_MEDIA = "media";
export const ADMIN_TAB_SETTINGS = "settings";

export const ACCESS_TIER_OWNER = 0;
export const ACCESS_TIER_MANAGER = 1;
export const ACCESS_TIER_OPERATOR = 2;

export const ADMIN_NAV_ITEMS = [
  {
    key: ADMIN_TAB_MENU,
    to: "/admin/menu-items",
    ariaLabel: "Menu Operations",
    fullLabel: "Menu Operations",
    shortLabel: "Menu",
  },
  {
    key: ADMIN_TAB_PACKAGES,
    to: "/admin/service-packages",
    ariaLabel: "Service Packages",
    fullLabel: "Service Packages",
    shortLabel: "Packages",
  },
  {
    key: ADMIN_TAB_MEDIA,
    to: "/admin/media",
    ariaLabel: "Media Manager",
    fullLabel: "Media Manager",
    shortLabel: "Media",
  },
  {
    key: ADMIN_TAB_SETTINGS,
    to: "/admin/settings",
    ariaLabel: "Dashboard Settings",
    fullLabel: "Dashboard Settings",
    shortLabel: "Settings",
    requiresSettingsAccess: true,
  },
];

export const toAccessTier = (value, fallback = ACCESS_TIER_MANAGER) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if ([ACCESS_TIER_OWNER, ACCESS_TIER_MANAGER, ACCESS_TIER_OPERATOR].includes(parsed)) return parsed;
  return fallback;
};

export const resolveActiveAdminTab = (pathname) => {
  if (pathname.startsWith("/admin/service-packages")) return ADMIN_TAB_PACKAGES;
  if (pathname.startsWith("/admin/media")) return ADMIN_TAB_MEDIA;
  if (pathname.startsWith("/admin/settings")) return ADMIN_TAB_SETTINGS;
  return ADMIN_TAB_MENU;
};
