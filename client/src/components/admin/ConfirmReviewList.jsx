const normalizeReviewValue = (value) => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const ConfirmReviewList = ({ rows = [], emptyMessage = "No changes detected." }) => (
  <div className="admin-confirm-review">
    {rows.length ? (
      rows.map((row, index) => {
        const label = String(row?.label || "").trim();
        const value = normalizeReviewValue(row?.value);
        const key = String(row?.key || label || `row-${index}`);
        return (
          <div key={key}>
            <strong>{label || "Value"}:</strong> {value}
          </div>
        );
      })
    ) : (
      <div>{emptyMessage}</div>
    )}
  </div>
);

export default ConfirmReviewList;
