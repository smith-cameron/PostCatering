import { Form } from "react-bootstrap";
import { getDisplayGroupTitle, normalizeSizeOption, toIdPart } from "./inquiryUtils";

const InquiryDesiredItemsSection = ({
  serviceInterest,
  shouldRequirePlanSelection,
  canShowDesiredItems,
  desiredItemGroups,
  desiredItems,
  traySizes,
  onToggleDesiredItem,
  onChangeTraySize,
}) => (
  <Form.Group className="mb-3">
    <Form.Label>
      Desired Menu Items <span className="text-danger">*</span>
    </Form.Label>
    {canShowDesiredItems ? (
      desiredItemGroups.length ? (
        <div className="border rounded p-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
          {desiredItemGroups.map((group) => (
            <div key={group.title} className="mb-3">
              <div className="fw-semibold small text-uppercase mb-1">{getDisplayGroupTitle(serviceInterest, group)}</div>
              {group.items.map((item, index) => {
                const isSelected = desiredItems.includes(item.name);
                const sizeOptions = (item.sizeOptions || []).map(normalizeSizeOption);
                return (
                  <div key={`${group.title}-${item.name}`} className="mb-2">
                    <Form.Check
                      id={`desired-item-${toIdPart(group.title)}-${index}`}
                      type="checkbox"
                      className="mb-1"
                      label={item.name}
                      checked={isSelected}
                      onChange={() => onToggleDesiredItem(item.name)}
                    />
                    {isSelected && sizeOptions.length ? (
                      <Form.Select
                        size="sm"
                        className="ms-4"
                        style={{ maxWidth: "200px" }}
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
        <div className="text-muted small">No items available for this service yet.</div>
      )
    ) : serviceInterest && shouldRequirePlanSelection ? (
      <div className="text-muted small">Select a package/tier first to choose desired menu items.</div>
    ) : (
      <div className="text-muted small">Select a service first to choose desired items.</div>
    )}
  </Form.Group>
);

export default InquiryDesiredItemsSection;
