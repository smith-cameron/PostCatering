import { requestJson as requestJsonBase, requestWithFormData as requestWithFormDataBase } from "../../utils/http";

export const requestJson = (url, options = {}) =>
  requestJsonBase(url, {
    credentials: "include",
    ...options,
  });

export const requestWithFormData = (url, formData, options = {}) =>
  requestWithFormDataBase(url, formData, {
    credentials: "include",
    ...options,
  });

export const getAdminSession = () => requestJson("/api/admin/auth/me");

export const logoutAdminSession = () =>
  requestJson("/api/admin/auth/logout", {
    method: "POST",
  });

export const updateAdminProfile = (payload) =>
  requestJson("/api/admin/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const listAdminServicePlanSections = ({ catalogKey = "", includeInactive = true } = {}) => {
  const params = new URLSearchParams();
  if (catalogKey) {
    params.set("catalog_key", catalogKey);
  }
  params.set("include_inactive", includeInactive ? "true" : "false");
  const query = params.toString();
  return requestJson(`/api/admin/service-plans${query ? `?${query}` : ""}`);
};

export const createAdminServicePlan = (payload) =>
  requestJson("/api/admin/service-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAdminServicePlan = (planId, payload) =>
  requestJson(`/api/admin/service-plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteAdminServicePlan = (planId, { hardDelete = false } = {}) =>
  requestJson(`/api/admin/service-plans/${planId}${hardDelete ? "?hard_delete=true" : ""}`, {
    method: "DELETE",
  });

export const reorderAdminServicePlans = (payload) =>
  requestJson("/api/admin/service-plans/reorder", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
