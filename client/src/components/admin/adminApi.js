const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const resolveErrorMessage = (payload, fallback) => {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (payload && Array.isArray(payload.errors) && payload.errors.length) {
    return String(payload.errors[0]);
  }
  return fallback;
};

export const requestJson = async (url, options = {}) => {
  const nextOptions = {
    credentials: "include",
    ...options,
  };

  if (nextOptions.body && !(nextOptions.body instanceof FormData)) {
    nextOptions.headers = {
      "Content-Type": "application/json",
      ...(nextOptions.headers || {}),
    };
  }

  const response = await fetch(url, nextOptions);
  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, "Request failed."));
  }
  return payload;
};

export const requestWithFormData = async (url, formData, options = {}) => {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
    ...options,
  });
  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(resolveErrorMessage(payload, "Upload failed."));
  }
  return payload;
};

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
