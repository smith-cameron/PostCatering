const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const resolveErrorMessage = (payload, fallbackMessage) => {
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (payload && Array.isArray(payload.errors) && payload.errors.length) {
    return String(payload.errors[0]);
  }
  return fallbackMessage;
};

const buildRequestError = (payload, fallbackMessage, status) => {
  const error = new Error(resolveErrorMessage(payload, fallbackMessage));
  error.status = status;
  error.payload = payload;
  error.fieldErrors = payload && typeof payload.field_errors === "object" ? payload.field_errors : null;
  return error;
};

const executeFetch = (url, options) => {
  if (!options || !Object.keys(options).length) {
    return fetch(url);
  }
  return fetch(url, options);
};

export const requestJson = async (url, options = {}) => {
  const { fallbackMessage = "Request failed.", ...fetchOptions } = options;
  const nextOptions = { ...fetchOptions };

  if (nextOptions.body && !(nextOptions.body instanceof FormData)) {
    nextOptions.headers = {
      "Content-Type": "application/json",
      ...(nextOptions.headers || {}),
    };
  }

  const response = await executeFetch(url, nextOptions);
  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw buildRequestError(payload, fallbackMessage, response.status);
  }
  return payload;
};

export const requestWithFormData = async (url, formData, options = {}) => {
  const { fallbackMessage = "Upload failed.", ...fetchOptions } = options;
  const nextOptions = {
    method: "POST",
    body: formData,
    ...fetchOptions,
  };

  const response = await executeFetch(url, nextOptions);
  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw buildRequestError(payload, fallbackMessage, response.status);
  }
  return payload;
};
