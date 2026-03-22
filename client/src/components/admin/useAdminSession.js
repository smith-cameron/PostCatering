import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminSession } from "./adminApi";
import { ACCESS_TIER_MANAGER, ACCESS_TIER_OWNER, toAccessTier } from "./adminShared";

const useAdminSession = ({ enabled = true } = {}) => {
  const [sessionLoading, setSessionLoading] = useState(enabled);
  const [authError, setAuthError] = useState("");
  const [adminUser, setAdminUserState] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setSessionLoading(false);
      setAuthError("");
      setAdminUserState(null);
      return undefined;
    }

    let mounted = true;

    const hydrateSession = async () => {
      try {
        const payload = await getAdminSession();
        if (!mounted) return;
        setAdminUserState(payload.user || null);
        setAuthError("");
      } catch {
        if (!mounted) return;
        setAdminUserState(null);
        setAuthError("unauthorized");
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    };

    hydrateSession();
    return () => {
      mounted = false;
    };
  }, [enabled]);

  const setAdminUser = useCallback((nextUser) => {
    setAdminUserState(nextUser || null);
  }, []);

  const adminAccessTier = useMemo(
    () => toAccessTier(adminUser?.access_tier, ACCESS_TIER_MANAGER),
    [adminUser?.access_tier]
  );
  const isOwnerSession = adminAccessTier === ACCESS_TIER_OWNER;
  const canAccessDashboardSettings = isOwnerSession || adminAccessTier === ACCESS_TIER_MANAGER;
  const canManageAdminUsers =
    isOwnerSession || (adminAccessTier === ACCESS_TIER_MANAGER && Boolean(adminUser?.can_manage_admin_users));

  return {
    adminUser,
    authError,
    sessionLoading,
    setAdminUser,
    canAccessDashboardSettings,
    canManageAdminUsers,
  };
};

export default useAdminSession;
