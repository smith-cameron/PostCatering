import "@testing-library/jest-dom/vitest";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// JSDOM + react-bootstrap transitions can produce NaN timeouts in tests.
// Normalize invalid delay values so test output stays signal-only.
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
globalThis.setTimeout = (handler, timeout, ...args) => {
  const numericTimeout = Number(timeout);
  const safeTimeout = Number.isNaN(numericTimeout) ? 0 : timeout;
  return nativeSetTimeout(handler, safeTimeout, ...args);
};
