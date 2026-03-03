import { Form } from "react-bootstrap";
import InquiryFieldLabel from "./InquiryFieldLabel";
import {
  getPlanDisplayTitle,
  getPlanSectionDisplayTitle,
  getSelectionCategoryKeyFromText,
} from "./inquiryUtils";

const InquiryServicePlanSection = ({
  serviceInterest,
  shouldRequirePlanSelection,
  servicePlanId,
  onChangeServicePlan,
  servicePlans,
  selectedServicePlan,
  displayedPlanDetails,
  highlightedDetailKeys,
  isInvalid = false,
}) => {
  if (!serviceInterest || !shouldRequirePlanSelection) return null;

  const tierSectionTitles = Array.from(
    new Set(servicePlans.filter((plan) => plan.level === "tier").map((plan) => plan.sectionTitle))
  );

  return (
    <Form.Group className="mb-3" controlId="inquiry-service-plan">
      <InquiryFieldLabel required>{serviceInterest === "community" ? "Package / Tier" : "Formal Dinner Package"}</InquiryFieldLabel>

      <Form.Select value={servicePlanId} onChange={onChangeServicePlan} isInvalid={isInvalid} required>
        <option value="">Select an option</option>
        <optgroup label={serviceInterest === "formal" ? "Dinner Packages" : "Packages"}>
          {servicePlans
            .filter((plan) => plan.level === "package")
            .map((plan) => (
              <option key={plan.id} value={plan.id}>
                {getPlanDisplayTitle(serviceInterest, plan)}
                {plan.price ? ` (${plan.price})` : ""}
              </option>
            ))}
        </optgroup>

        {serviceInterest !== "formal"
          ? tierSectionTitles.map((sectionTitle) => (
              <optgroup key={sectionTitle} label={getPlanSectionDisplayTitle(serviceInterest, sectionTitle)}>
                {servicePlans
                  .filter((plan) => plan.level === "tier" && plan.sectionTitle === sectionTitle)
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {getPlanDisplayTitle(serviceInterest, plan)}
                      {plan.price ? ` (${plan.price})` : ""}
                    </option>
                  ))}
              </optgroup>
            ))
          : null}
      </Form.Select>

      {selectedServicePlan ? (
        <div className="inquiry-selection-summary mt-2">
          <div className="inquiry-selection-summary-title">
            {selectedServicePlan.level === "package" ? "Package Includes" : "Tier Details"}
          </div>
          <ul className="inquiry-selection-summary-list mb-0">
            {displayedPlanDetails.map((detail) => {
              const detailKey = getSelectionCategoryKeyFromText(detail);
              const isHighlighted = Boolean(detailKey && highlightedDetailKeys.includes(detailKey));
              return (
                <li
                  key={detail}
                  className={`inquiry-selection-summary-item${isHighlighted ? " inquiry-selection-summary-item-highlighted" : ""}`}>
                  {detail}
                </li>
              );
            })}
          </ul>
          {serviceInterest === "community" && selectedServicePlan.level === "tier" ? (
            <div className="inquiry-selection-summary-note">Special requests can be added in the Message field.</div>
          ) : null}
        </div>
      ) : null}
    </Form.Group>
  );
};

export default InquiryServicePlanSection;
