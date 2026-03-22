import { Form } from "react-bootstrap";
import InquiryFieldLabel from "./InquiryFieldLabel";
import { getDisplayGroupTitle, normalizeSizeOption, toIdPart } from "./inquiryUtils";

const InquiryDesiredItemsSection = ({
  serviceInterest,
  shouldRequirePlanSelection,
  requiresDesiredItemSelection,
  canShowDesiredItems,
  desiredItemGroups,
  desiredItems,
  traySizes,
  onToggleDesiredItem,
  onChangeTraySize,
  hasError = false,
}) => (
  <Form.Group className="mb-3">
    <InquiryFieldLabel required={requiresDesiredItemSelection}>Desired Menu Items</InquiryFieldLabel>
    {canShowDesiredItems ? (
      desiredItemGroups.length ? (
        <div
          className={`inquiry-desired-items-panel${hasError ? " inquiry-desired-items-panel-invalid" : ""}`}
          aria-invalid={hasError ? "true" : undefined}>
          {desiredItemGroups.map((group) => (
            <div key={group.title} className="inquiry-desired-items-group">
              <div className="inquiry-desired-items-group-title">{getDisplayGroupTitle(serviceInterest, group)}</div>
              {group.items.map((item, index) => {
                const isSelected = desiredItems.includes(item.name);
                const sizeOptions = (item.sizeOptions || []).map(normalizeSizeOption);
                const identityKey = item.id || item.name || index;
                return (
                  <div key={`${group.title}-${identityKey}`} className="inquiry-desired-items-entry">
                    <Form.Check
                      id={`desired-item-${toIdPart(group.title)}-${toIdPart(identityKey)}`}
                      type="checkbox"
                      className="inquiry-desired-items-check"
                      label={item.name}
                      checked={isSelected}
                      onChange={() => onToggleDesiredItem(item.name)}
                    />
                    {isSelected && sizeOptions.length ? (
                      <Form.Select
                        size="sm"
                        className="inquiry-desired-items-size-select"
                        value={traySizes[item.name] || sizeOptions[0].value}
                        onChange={(event) => onChangeTraySize(item.name, event.target.value)}>
                        {sizeOptions.map((sizeOption) => (
                          <option key={`${item.name}-${sizeOption.value}`} value={sizeOption.value}>
                            {sizeOption.label}
                          </option>
                        ))}
                      </Form.Select>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="inquiry-selection-hint">
          {requiresDesiredItemSelection ? "No items available for this service yet." : "No menu item selections are required for this package."}
        </div>
      )
    ) : serviceInterest && shouldRequirePlanSelection ? (
      <div className="inquiry-selection-hint">Select a package first to view desired menu items.</div>
    ) : (
      <div className="inquiry-selection-hint">Select a service first to view desired items.</div>
    )}
  </Form.Group>
);

export default InquiryDesiredItemsSection;
