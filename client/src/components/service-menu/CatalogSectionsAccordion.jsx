import { Accordion } from "react-bootstrap";
import MenuTable from "./MenuTable";
import {
  getCommunityPackageBullets,
  normalizeCommunityTierConstraints,
  normalizeMenuText,
  normalizeMenuTitle,
  splitItemsBySaladName,
  toCommunityTierBullet,
} from "./serviceMenuUtils";

const isSaladName = (value) => String(value || "").toLowerCase().includes("salad");

const CatalogSectionsAccordion = ({ menuKey, data, menuOptions }) => (
  <Accordion key={menuKey} defaultActiveKey={data.sections?.length ? "0" : undefined} alwaysOpen={false}>
    {data.sections.map((section, index) => (
      <Accordion.Item eventKey={String(index)} key={section.title ?? index}>
        <Accordion.Header>{normalizeMenuTitle(section.title)}</Accordion.Header>
        <Accordion.Body>
          {section.type === "package" ? (
            <>
              {section.price ? (
                <p className="mb-2">
                  <strong>{normalizeMenuText(section.price)}</strong>
                </p>
              ) : null}
              {menuKey === "community" ? (
                <ul className="mb-0">
                  {getCommunityPackageBullets(section).map((bullet) => (
                    <li key={bullet}>{normalizeMenuText(bullet)}</li>
                  ))}
                </ul>
              ) : menuKey !== "formal" ? (
                <p className="mb-0">{normalizeMenuText(section.description)}</p>
              ) : null}
            </>
          ) : null}

          {section.type === "tiers" ? (
            <>
              {section.tiers.map((tier) => (
                <div key={tier.tierTitle} className="mb-3">
                  <h4 className="h6 mb-1 menu-section-title">{tier.tierTitle}</h4>
                  {tier.price ? (
                    <p className="mb-2">
                      <strong>{normalizeMenuText(tier.price)}</strong>
                    </p>
                  ) : null}
                  <ul className="mb-0">
                    {(menuKey === "community"
                      ? (() => {
                          const limits = normalizeCommunityTierConstraints(section.sectionId, tier.tierTitle, tier.constraints);
                          return [
                            toCommunityTierBullet("Entrees/Protiens", limits.entree),
                            toCommunityTierBullet("Sides", limits.sides),
                            toCommunityTierBullet("Salads", limits.salads),
                            !limits.sides && !limits.salads ? toCommunityTierBullet("Sides/Salads", limits.sides_salads) : null,
                            "Bread",
                          ].filter(Boolean);
                        })()
                      : tier.bullets
                    ).map((bullet) => (
                      <li key={bullet}>{normalizeMenuText(bullet)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : null}

          {section.type === "includeMenu" ? (
            <>
              {section.note ? <p className="mb-3">{normalizeMenuText(section.note)}</p> : null}

              {section.includeKeys.map((key) => {
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

          {!section.type ? (
            menuKey === "togo" && section.sectionId === "togo_sides_salads" ? (
              (() => {
                const normalizedColumns = (section.columns || []).map((column, columnIndex) =>
                  columnIndex === 0 ? "" : normalizeMenuText(column)
                );
                const normalizedRows = (section.rows || []).map((row) => row.map((cell) => normalizeMenuText(cell)));
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
                columns={(section.columns || []).map((column) => normalizeMenuText(column))}
                rows={(section.rows || []).map((row) => row.map((cell) => normalizeMenuText(cell)))}
              />
            )
          ) : null}
        </Accordion.Body>
      </Accordion.Item>
    ))}
  </Accordion>
);

export default CatalogSectionsAccordion;
