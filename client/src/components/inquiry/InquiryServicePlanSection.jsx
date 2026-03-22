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

  const groupedCateringPlans = servicePlans.reduce(
    (acc, plan) => {
      const sectionTitle = String(plan?.sectionTitle || "").trim();
      if (!sectionTitle) {
        acc.standalone.push(plan);
        return acc;
      }
      const group = acc.bySection.get(sectionTitle) || [];
      group.push(plan);
      acc.bySection.set(sectionTitle, group);
      return acc;
    },
    { standalone: [], bySection: new Map() }
  );
  const groupedCateringSections = Array.from(groupedCateringPlans.bySection.entries());
  const groupedCateringSectionsWithMultiplePlans = groupedCateringSections.filter(([, plans]) => plans.length > 1);
  const showCateringSectionGroups =
    serviceInterest === "catering" && groupedCateringSectionsWithMultiplePlans.length > 1;
  const primaryPackageOptions =
    serviceInterest === "catering" && showCateringSectionGroups
      ? [
          ...groupedCateringPlans.standalone,
          ...groupedCateringSections.filter(([, plans]) => plans.length === 1).flatMap(([, plans]) => plans),
        ]
      : servicePlans;

  return (
    <Form.Group className="mb-3" controlId="inquiry-service-plan">
      <InquiryFieldLabel required>{serviceInterest === "catering" ? "Catering Package" : "Formal Dinner Package"}</InquiryFieldLabel>

      <Form.Select value={servicePlanId} onChange={onChangeServicePlan} isInvalid={isInvalid} required>
        <option value="">Select an option</option>
        <optgroup label={serviceInterest === "formal" ? "Dinner Packages" : "Packages"}>
          {primaryPackageOptions.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {getPlanDisplayTitle(serviceInterest, plan)}
                {plan.price ? ` (${plan.price})` : ""}
              </option>
            ))}
        </optgroup>

        {showCateringSectionGroups
          ? groupedCateringSections
              .filter(([, plans]) => plans.length > 1)
              .map(([sectionTitle, plans]) => (
              <optgroup key={sectionTitle} label={getPlanSectionDisplayTitle(serviceInterest, sectionTitle)}>
                {plans.map((plan) => (
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
          <div className="inquiry-selection-summary-title">Package Includes</div>
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
        </div>
      ) : null}
    </Form.Group>
  );
};

export default InquiryServicePlanSection;
