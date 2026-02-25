import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CatalogSectionsAccordion from "./CatalogSectionsAccordion";

describe("CatalogSectionsAccordion", () => {
  it("renders tray prices in To-Go sections", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="togo"
        data={{
          sections: [
            {
              sectionId: "togo_signature_proteins",
              title: "Signature Protein Trays",
              columns: ["Entree", "Half Tray", "Full Tray"],
              rows: [["Jerk Chicken", "$75", "$140"]],
              rowItems: [
                {
                  itemId: 101,
                  itemName: "Jerk Chicken",
                  trayPrices: { half: "$75", full: "$140" },
                },
              ],
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("$75")).toBeInTheDocument();
    expect(screen.getByText("$140")).toBeInTheDocument();
  });

  it("does not render tray prices in non-To-Go include sections", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="community"
        data={{
          sections: [
            {
              type: "includeMenu",
              title: "Menu Options",
              includeKeys: ["entrees"],
            },
          ],
        }}
        menuOptions={{
          entrees: {
            category: "entree",
            title: "Entrees",
            items: ["Jerk Chicken"],
            itemRefs: [
              {
                itemId: 101,
                itemName: "Jerk Chicken",
                trayPrices: { half: "$75", full: "$140" },
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText("Jerk Chicken")).toBeInTheDocument();
    expect(screen.queryByText("$75")).not.toBeInTheDocument();
    expect(screen.queryByText("$140")).not.toBeInTheDocument();
  });

  it("renders homestyle package copy without choose phrasing", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="community"
        data={{
          sections: [
            {
              sectionId: "community_homestyle",
              type: "package",
              title: "Hearty Homestyle Packages",
              description: "Choose 1 protein + 2 sides + bread",
              constraints: {
                entree: { min: 1, max: 1 },
                sides: { min: 2, max: 2 },
              },
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("1 Entree/Protein")).toBeInTheDocument();
    expect(screen.getByText("2 Sides")).toBeInTheDocument();
    expect(screen.queryByText(/choose/i)).not.toBeInTheDocument();
  });

  it("renders taco bar with a taco protein bullet", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="community"
        data={{
          sections: [
            {
              sectionId: "community_taco_bar",
              type: "package",
              title: "Taco Bar",
              description: "Includes Spanish rice, refried beans, tortillas, toppings",
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("Taco Bar Proteins")).toBeInTheDocument();
  });

  it("renders community tier entree label as in inquiry copy", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="community"
        data={{
          sections: [
            {
              sectionId: "community_buffet_tiers",
              type: "tiers",
              title: "Event Catering - Buffet Style",
              tiers: [
                {
                  tierTitle: "Tier 1: Casual Buffet",
                  constraints: {
                    entree: { min: 2, max: 2 },
                    sides: { min: 2, max: 2 },
                    salads: { min: 1, max: 1 },
                  },
                },
                {
                  tierTitle: "Tier 2: Elevated Buffet / Family-Style",
                  constraints: {
                    entree: { min: 2, max: 3 },
                    sides: { min: 3, max: 3 },
                    salads: { min: 2, max: 2 },
                  },
                },
              ],
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("2 Entrees/Protiens")).toBeInTheDocument();
    expect(screen.getByText("2-3 Entrees/Protiens")).toBeInTheDocument();
  });
});
