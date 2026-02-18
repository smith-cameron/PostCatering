import { useContext } from "react";
import { useParams } from "react-router-dom";
import { Accordion, Button } from "react-bootstrap";
import useMenuConfig from "../hooks/useMenuConfig";
import Context from "../context";

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
  return value;
};
const isSaladName = (value) => String(value || "").toLowerCase().includes("salad");
const splitItemsBySaladName = (items = []) =>
  items.reduce(
    (acc, item) => {
      if (isSaladName(item)) {
        acc.salads.push(item);
      } else {
        acc.sides.push(item);
      }
      return acc;
    },
    { sides: [], salads: [] }
  );

const normalizeMenuTitle = (value) => {
  const normalized = normalizeMenuText(value);
  if (typeof normalized !== "string") return normalized;
  return normalized
    .replace(/\s*\(Per Person\)\s*/i, "")
    .replace(/\s*\(Carne Asada or Chicken\)\s*/i, "")
    .replace(/Event Catering - Buffet Style/i, "Event/Crew Catering - Buffet Style")
    .trim();
};

const getCommunityPackageBullets = (section) => {
  if (!section?.description) return [];
  const trimmed = section.description.trim();
  const withoutIncludes = trimmed.replace(/^includes\s*/i, "");
  const bullets = [];

  const proteinMatch = section.title?.match(/\(([^)]+)\)/);
  if (section.sectionId === "community_taco_bar" && proteinMatch?.[1]) {
    bullets.push(`Protein: ${proteinMatch[1]}`);
  }

  if (withoutIncludes.includes("+")) {
    return bullets.concat(
      withoutIncludes
      .split("+")
      .map((item) => item.trim())
      .map((item) => {
        const lower = item.toLowerCase();
        if (lower.startsWith("choose")) return `Choose ${item.slice(6).trim().replace(/^./, (m) => m.toUpperCase())}`;
        if (/^\d+\s+/.test(lower)) return `Choose ${item.replace(/^./, (m) => m.toUpperCase())}`;
        return item.replace(/^./, (m) => m.toUpperCase());
      })
      .filter(Boolean)
    );
  }

  if (withoutIncludes.includes(",")) {
    return bullets.concat(
      withoutIncludes
      .split(",")
      .map((item) => item.trim())
      .map((item) => item.replace(/^./, (m) => m.toUpperCase()))
      .filter(Boolean)
    );
  }

  return bullets.concat([normalizeMenuText(trimmed)]);
};

const normalizeCommunityTierConstraints = (sectionId, tierTitle, constraints) => {
  const normalizedTitle = String(tierTitle || "").toLowerCase();
  if (sectionId === "community_buffet_tiers" && normalizedTitle.includes("tier 1")) {
    return {
      entree: { min: 2, max: 2 },
      sides: { min: 2, max: 2 },
      salads: { min: 1, max: 1 },
    };
  }
  if (sectionId === "community_buffet_tiers" && normalizedTitle.includes("tier 2")) {
    return {
      entree: { min: 2, max: 3 },
      sides: { min: 3, max: 3 },
      salads: { min: 2, max: 2 },
    };
  }
  if (!constraints || typeof constraints !== "object") return {};
  const normalizedConstraints = Object.entries(constraints).reduce((acc, [key, value]) => {
    if (typeof value === "number") {
      acc[key] = { max: value };
    } else if (value && typeof value === "object") {
      acc[key] = value;
    }
    return acc;
  }, {});
  if (normalizedConstraints.sides_salads && !normalizedConstraints.sides && !normalizedConstraints.salads) {
    normalizedConstraints.sides = normalizedConstraints.sides_salads;
    delete normalizedConstraints.sides_salads;
  }
  return normalizedConstraints;
};

const toCommunityTierBullet = (label, limits) => {
  if (!limits?.max) return null;
  const min = limits?.min || 0;
  const max = limits.max;
  if (min && min === max) return `${max} ${label}`;
  if (min && min < max) return `${min}-${max} ${label}`;
  return `${max} ${label}`;
};

const getFormalCourseLabel = (courseType) => {
  const map = {
    passed: "Passed Appetizers",
    starter: "Starters",
    entree: "Entrées",
    sides: "Sides",
  };
  return map[courseType] || "Menu Options";
};

const getFormalPlanDetails = (plan) => {
  if (!plan) return [];
  if (plan.id === "formal:3-course") {
    return ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrées", "Bread"];
  }
  if (plan.id === "formal:2-course") {
    return ["1 Starter", "1 Entrée", "Bread"];
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
  const { openInquiryModal } = useContext(Context);
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
        <h2 className="mb-1">{normalizeMenuTitle(data.pageTitle)}</h2>
        {data.subtitle ? <p className="mb-0">{normalizeMenuText(data.subtitle)}</p> : null}
        <div className="mt-3">
          <Button variant="secondary" onClick={() => openInquiryModal(menuKey)}>
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
      ) : (
        <Accordion key={menuKey} defaultActiveKey={data.sections?.length ? "0" : undefined} alwaysOpen={false}>
          {data.sections.map((s, idx) => (
            <Accordion.Item eventKey={String(idx)} key={s.title ?? idx}>
            <Accordion.Header>{normalizeMenuTitle(s.title)}</Accordion.Header>
            <Accordion.Body>
              {s.type === "package" ? (
                <>
                  {menuKey === "formal" && Array.isArray(formalPlanOptions) && formalPlanOptions.length ? (
                    <>
                      {formalPlanOptions.map((plan) => (
                        <div key={plan.id} className="mb-3">
                          <h4 className="h6 mb-1 menu-section-title">{normalizeMenuText(plan.title)}</h4>
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
                      {getCommunityPackageBullets(s).map((bullet) => (
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
                      <h4 className="h6 mb-1 menu-section-title">{t.tierTitle}</h4>
                      {t.price ? (
                        <p className="mb-2">
                        <strong>{normalizeMenuText(t.price)}</strong>
                        </p>
                      ) : null}
                      <ul className="mb-0">
                        {(menuKey === "community"
                          ? (() => {
                              const limits = normalizeCommunityTierConstraints(s.sectionId, t.tierTitle, t.constraints);
                              return [
                                toCommunityTierBullet("Entrées", limits.entree),
                                toCommunityTierBullet("Sides", limits.sides),
                                toCommunityTierBullet("Salads", limits.salads),
                                !limits.sides && !limits.salads
                                  ? toCommunityTierBullet("Sides/Salads", limits.sides_salads)
                                  : null,
                                "Bread",
                              ].filter(Boolean);
                            })()
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
                    if (block.category === "sides_salads") {
                      const { sides, salads } = splitItemsBySaladName(block.items || []);
                      return (
                        <div key={key} className="mb-3">
                          <h4 className="h6 mb-2 menu-section-title">{normalizeMenuText(block.title)}</h4>
                          {sides.length ? (
                            <>
                              <h5 className="h6 mb-2">Sides</h5>
                              <ul className="mb-2">
                                {sides.map((item) => (
                                  <li key={item}>{normalizeMenuText(item)}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                          {salads.length ? (
                            <>
                              <h5 className="h6 mb-2">Salads</h5>
                              <ul className="mb-0">
                                {salads.map((item) => (
                                  <li key={item}>{normalizeMenuText(item)}</li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="mb-3">
                        <h4 className="h6 mb-2 menu-section-title">{normalizeMenuText(block.title)}</h4>
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
                menuKey === "togo" && s.sectionId === "togo_sides_salads" ? (
                  (() => {
                    const normalizedColumns = (s.columns || []).map((col, colIndex) =>
                      colIndex === 0 ? "" : normalizeMenuText(col)
                    );
                    const normalizedRows = (s.rows || []).map((row) => row.map((cell) => normalizeMenuText(cell)));
                    const sideRows = normalizedRows.filter((row) => !isSaladName(row[0]));
                    const saladRows = normalizedRows.filter((row) => isSaladName(row[0]));
                    return (
                      <>
                        {sideRows.length ? (
                          <div className="mb-3">
                            <h4 className="h6 mb-2 menu-section-title">Sides</h4>
                            <MenuTable columns={normalizedColumns} rows={sideRows} />
                          </div>
                        ) : null}
                        {saladRows.length ? (
                          <div>
                            <h4 className="h6 mb-2 menu-section-title">Salads</h4>
                            <MenuTable columns={normalizedColumns} rows={saladRows} />
                          </div>
                        ) : null}
                      </>
                    );
                  })()
                ) : (
                  <MenuTable
                    columns={(s.columns || []).map((col) => normalizeMenuText(col))}
                    rows={(s.rows || []).map((row) => row.map((cell) => normalizeMenuText(cell)))}
                  />
                )
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
