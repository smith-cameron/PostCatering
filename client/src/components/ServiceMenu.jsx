import { useParams, Link } from "react-router-dom";
import { Accordion, Button } from "react-bootstrap";
import useMenuConfig from "../hooks/useMenuConfig";

const MenuTable = ({ columns, rows }) => (
  <div className="table-responsive">
    <table className="table align-middle mb-0">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx}>
            {r.map((cell, cidx) => (
              <td key={cidx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const normalizeMenuText = (value) => {
  if (typeof value !== "string") return value;
  return value.replace(/Entr.{0,3}e/g, "Entree").replace(/Entr.{0,3}es/g, "Entrees");
};

const getCommunityPackageBullets = (description) => {
  if (!description) return [];
  const trimmed = description.trim();
  const withoutIncludes = trimmed.replace(/^includes\s*/i, "");

  if (withoutIncludes.includes("+")) {
    return withoutIncludes
      .split("+")
      .map((item) => item.trim())
      .map((item) => {
        const lower = item.toLowerCase();
        if (lower.startsWith("choose")) return `Choose ${item.slice(6).trim().replace(/^./, (m) => m.toUpperCase())}`;
        if (/^\d+\s+/.test(lower)) return `Choose ${item.replace(/^./, (m) => m.toUpperCase())}`;
        return item.replace(/^./, (m) => m.toUpperCase());
      })
      .filter(Boolean);
  }

  if (withoutIncludes.includes(",")) {
    return withoutIncludes
      .split(",")
      .map((item) => item.trim())
      .map((item) => item.replace(/^./, (m) => m.toUpperCase()))
      .filter(Boolean);
  }

  return [normalizeMenuText(trimmed)];
};

const getFormalCourseLabel = (courseType) => {
  const map = {
    passed: "Passed Appetizers",
    starter: "Starters",
    entree: "Entrees",
    sides: "Sides",
  };
  return map[courseType] || "Menu Options";
};

const getFormalPlanDetails = (plan) => {
  if (!plan) return [];
  if (plan.id === "formal:3-course") {
    return ["2 Passed Appetizers", "1 Starter", "1 Entree and 1 Side or 2 Entrees"];
  }
  if (plan.id === "formal:2-course") {
    return ["1 Starter", "1 Entree and 1 Side or 2 Entrees"];
  }
  return plan.details || [];
};

const getApprovedFormalPlans = (plans) => (plans || []).filter((plan) => plan.id !== "formal:2-course");

const getFormalMenuBlocks = (sections) => {
  return (sections || [])
    .filter((section) => section.type === "tiers" && section.courseType)
    .map((section) => ({
      key: section.sectionId || section.title,
      title: getFormalCourseLabel(section.courseType),
      items: section.tiers?.flatMap((tier) => tier.bullets || []) || [],
    }))
    .filter((block) => block.items.length);
};

const ServiceMenu = () => {
  const { menuKey } = useParams();
  const { menu, menuOptions, formalPlanOptions, loading, error } = useMenuConfig();
  const approvedFormalPlans = getApprovedFormalPlans(formalPlanOptions);
  const data = menu[menuKey];
  const formalMenuBlocks = menuKey === "formal" ? getFormalMenuBlocks(data?.sections) : [];

  if (loading) {
    return (
      <main className="container my-4">
        <p className="mb-0">Loading menu...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container my-4">
        <h2 className="mb-2">Menu unavailable</h2>
        <p className="mb-0">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container my-4">
        <h2 className="mb-2">Menu not found</h2>
        <p className="mb-0">Please choose a menu from Services.</p>
      </main>
    );
  }

  return (
    <main className="container my-4">
      <header className="mb-3">
        <h2 className="mb-1">{data.pageTitle}</h2>
        {data.subtitle ? <p className="mb-0">{normalizeMenuText(data.subtitle)}</p> : null}
        <div className="mt-3">
          <Button as={Link} to={`/inquiry?service=${menuKey}`} variant="secondary">
            Send Inquiry About This Menu
          </Button>
        </div>
      </header>

      {data.introBlocks?.map((b) => (
        <section key={b.title} className="mb-4">
            <h3 className="h5">{b.title}</h3>
            <ul className="mb-0">
              {b.bullets.map((x) => (
                <li key={x}>{normalizeMenuText(x)}</li>
              ))}
            </ul>
          </section>
      ))}

      {menuKey === "formal" ? (
        <Accordion key={menuKey} defaultActiveKey="0" alwaysOpen={false}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>Formal Dinner Packages</Accordion.Header>
            <Accordion.Body>
              {approvedFormalPlans.map((plan) => (
                <div key={plan.id} className="mb-3">
                  <h4 className="h6 mb-1">{normalizeMenuText(plan.title)}</h4>
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
                  <h4 className="h6 mb-2">{block.title}</h4>
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
      ) : (
        <Accordion key={menuKey} defaultActiveKey={data.sections?.length ? "0" : undefined} alwaysOpen={false}>
          {data.sections.map((s, idx) => (
            <Accordion.Item eventKey={String(idx)} key={s.title ?? idx}>
            <Accordion.Header>{normalizeMenuText(s.title)}</Accordion.Header>
            <Accordion.Body>
              {s.type === "package" ? (
                <>
                  {menuKey === "formal" && Array.isArray(formalPlanOptions) && formalPlanOptions.length ? (
                    <>
                      {formalPlanOptions.map((plan) => (
                        <div key={plan.id} className="mb-3">
                          <h4 className="h6 mb-1">{normalizeMenuText(plan.title)}</h4>
                          {plan.price ? (
                            <p className="mb-2">
                              <strong>{normalizeMenuText(plan.price)}</strong>
                            </p>
                          ) : null}
                          <ul className="mb-0">
                            {(plan.details || []).map((detail) => (
                              <li key={`${plan.id}-${detail}`}>{normalizeMenuText(detail)}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  ) : s.price ? (
                    <p className="mb-2">
                      <strong>{normalizeMenuText(s.price)}</strong>
                    </p>
                  ) : null}
                  {menuKey === "community" ? (
                    <ul className="mb-0">
                      {getCommunityPackageBullets(s.description).map((bullet) => (
                        <li key={bullet}>{normalizeMenuText(bullet)}</li>
                      ))}
                    </ul>
                  ) : menuKey !== "formal" ? (
                    <p className="mb-0">{normalizeMenuText(s.description)}</p>
                  ) : null}
                </>
              ) : null}

              {s.type === "tiers" ? (
                <>
                  {s.tiers.map((t) => (
                    <div key={t.tierTitle} className="mb-3">
                      <h4 className="h6 mb-1">{t.tierTitle}</h4>
                      {t.price ? (
                        <p className="mb-2">
                        <strong>{normalizeMenuText(t.price)}</strong>
                        </p>
                      ) : null}
                      <ul className="mb-0">
                        {(menuKey === "community" && t.constraints
                          ? [
                              t.constraints.entree ? `Up to ${t.constraints.entree} Entrees` : null,
                              t.constraints.sides_salads
                                ? `Up to ${t.constraints.sides_salads} Sides/Salads (combined)`
                                : null,
                              "Bread",
                            ].filter(Boolean)
                          : t.bullets
                        ).map((b) => (
                          <li key={b}>{normalizeMenuText(b)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}

              {s.type === "includeMenu" ? (
                <>
                  {s.note ? <p className="mb-3">{normalizeMenuText(s.note)}</p> : null}

                  {s.includeKeys.map((key) => {
                    const block = menuOptions[key];
                    if (!block) return null;

                    return (
                      <div key={key} className="mb-3">
                        <h4 className="h6 mb-2">{normalizeMenuText(block.title)}</h4>
                        <ul className="mb-0">
                          {block.items.map((item) => (
                            <li key={item}>{normalizeMenuText(item)}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {!s.type ? (
                <MenuTable
                  columns={(s.columns || []).map((col) => normalizeMenuText(col))}
                  rows={(s.rows || []).map((row) => row.map((cell) => normalizeMenuText(cell)))}
                />
              ) : null}
            </Accordion.Body>
          </Accordion.Item>
          ))}
        </Accordion>
      )}
    </main>
  );
};

export default ServiceMenu;

