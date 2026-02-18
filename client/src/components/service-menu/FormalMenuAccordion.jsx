import { Accordion } from "react-bootstrap";
import { getFormalPlanDetails, normalizeMenuText } from "./serviceMenuUtils";

const FormalMenuAccordion = ({ menuKey, approvedFormalPlans, formalMenuBlocks }) => (
  <Accordion key={menuKey} defaultActiveKey="0" alwaysOpen={false}>
    <Accordion.Item eventKey="0">
      <Accordion.Header>Formal Dinner Packages</Accordion.Header>
      <Accordion.Body>
        {approvedFormalPlans.map((plan) => (
          <div key={plan.id} className="mb-3">
            <h4 className="h6 mb-1 menu-section-title">{normalizeMenuText(plan.title)}</h4>
            {plan.price ? (
              <p className="mb-2">
                <strong>{normalizeMenuText(plan.price)}</strong>
              </p>
            ) : null}
            <ul className="mb-0">
              {getFormalPlanDetails(plan).map((detail) => (
                <li key={`${plan.id}-${detail}`}>{normalizeMenuText(detail)}</li>
              ))}
            </ul>
          </div>
        ))}
      </Accordion.Body>
    </Accordion.Item>

    <Accordion.Item eventKey="1">
      <Accordion.Header>Menu Options</Accordion.Header>
      <Accordion.Body>
        {formalMenuBlocks.map((block) => (
          <div key={block.key} className="mb-3">
            <h4 className="h6 mb-2 menu-section-title">{block.title}</h4>
            <ul className="mb-0">
              {block.items.map((item) => (
                <li key={`${block.key}-${item}`}>{normalizeMenuText(item)}</li>
              ))}
            </ul>
          </div>
        ))}
      </Accordion.Body>
    </Accordion.Item>
  </Accordion>
);

export default FormalMenuAccordion;
