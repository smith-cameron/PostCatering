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
