const normalizeReviewValue = (value) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const toReviewLines = (value) => {
  const normalized = normalizeReviewValue(value);
  if (normalized === "-") return [normalized];

  return normalized
    .split(/\r?\n|\s\|\s/g)
    .map((part) => String(part || "").trim())
    .filter(Boolean);
};

const ConfirmReviewList = ({ rows = [], emptyMessage = "No changes detected." }) => (
  <div className="admin-confirm-review">
    {rows.length ? (
      rows.map((row, index) => {
        const label = String(row?.label || "").trim();
        const valueLines = toReviewLines(row?.value);
        const key = String(row?.key || label || `row-${index}`);
        return (
          <div key={key} className="admin-confirm-review-row">
            <div className="admin-confirm-review-label">{label || "Value"}</div>
            <div className="admin-confirm-review-value">
              {valueLines.map((line, lineIndex) => (
                <div key={`${key}-line-${lineIndex}`}>{line}</div>
              ))}
            </div>
          </div>
        );
      })
    ) : (
      <div>{emptyMessage}</div>
    )}
  </div>
);

export default ConfirmReviewList;
