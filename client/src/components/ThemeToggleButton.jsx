const ThemeToggleButton = ({ isDarkTheme = false, onToggle, className = "" }) => {
  const resolvedClassName = ["site-theme-toggle", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={resolvedClassName}
      aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} mode`}
      aria-pressed={isDarkTheme}
      onClick={() => onToggle?.()}>
      <span className="site-theme-toggle-label">Theme</span>
      <span className="site-theme-toggle-value">{isDarkTheme ? "Dark" : "Light"}</span>
    </button>
  );
};

export default ThemeToggleButton;
