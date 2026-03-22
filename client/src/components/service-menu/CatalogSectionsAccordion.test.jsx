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
        menuKey="catering"
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
        menuKey="catering"
        data={{
          sections: [
            {
              sectionId: "catering_packages",
              type: "package",
              title: "Hearty Homestyle Packages",
              constraints: {
                entree_signature_protein: { min: 1, max: 1 },
                sides_salads: { min: 2, max: 2 },
              },
              details: ["Bread"],
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("1 Entree/Signature Protein")).toBeInTheDocument();
    expect(screen.getByText("2 Sides/Salads")).toBeInTheDocument();
    expect(screen.queryByText(/choose/i)).not.toBeInTheDocument();
  });

  it("renders taco bar with an explicit protein list", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="catering"
        data={{
          sections: [
            {
              sectionId: "catering_packages",
              type: "package",
              title: "Taco Bar",
              details: ["Spanish rice", "Refried beans", "Tortillas", "Toppings"],
              selectionGroups: [
                {
                  title: "Taco Bar Proteins",
                  options: [{ label: "Chicken" }],
                },
              ],
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("Taco Bar Proteins: Chicken")).toBeInTheDocument();
  });

  it("renders catering package entree label as in inquiry copy", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="catering"
        data={{
          sections: [
            {
              sectionId: "catering_packages",
              type: "packages",
              title: "Event Catering - Buffet Style",
              packages: [
                {
                  title: "Tier 1: Casual Buffet",
                  details: ["Bread"],
                  constraints: {
                    entree_signature_protein: { min: 2, max: 2 },
                    sides_salads: { min: 3, max: 3 },
                  },
                },
                {
                  title: "Tier 2: Elevated Buffet / Family-Style",
                  details: ["Bread"],
                  constraints: {
                    entree_signature_protein: { min: 2, max: 3 },
                    sides_salads: { min: 5, max: 5 },
                  },
                },
              ],
            },
          ],
        }}
        menuOptions={{}}
      />
    );

    expect(screen.getByText("2 Entrees/Signature Proteins")).toBeInTheDocument();
    expect(screen.getByText("2-3 Entrees/Signature Proteins")).toBeInTheDocument();
    expect(screen.getByText("3 Sides/Salads")).toBeInTheDocument();
    expect(screen.getByText("5 Sides/Salads")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tier 1: Casual Buffet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tier 2: Elevated Buffet / Family-Style" })).toBeInTheDocument();
  });

  it("renders normalized sections through the shared block renderer", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="formal"
        sections={[
          {
            id: "formal-packages",
            title: "Formal Dinner Packages",
            blocks: [
              {
                key: "plan-1",
                type: "list",
                title: "Chef's Choice",
                price: "$38 / person",
                items: ["2 Passed Appetizers", "1 Starter"],
              },
              {
                key: "menu-options",
                type: "group",
                title: "Menu Options",
                blocks: [
                  {
                    key: "menu-options-entrees",
                    type: "list",
                    title: "Entrees",
                    items: ["Braised Short Rib"],
                  },
                ],
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "Chef's Choice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu Options" })).toBeInTheDocument();
    expect(screen.getByText("$38 / person")).toBeInTheDocument();
    expect(screen.queryByText("Formal Dinner Packages")).not.toBeInTheDocument();
  });

  it("renders formal packages and menu blocks as separate top-level accordion items", () => {
    render(
      <CatalogSectionsAccordion
        menuKey="formal"
        approvedFormalPlans={[
          {
            id: "formal:3-course",
            title: "3-Course Service",
            price: "$38 / person",
          },
        ]}
        formalMenuBlocks={[
          {
            key: "formal-entrees",
            title: "Entrees",
            items: ["Braised Short Rib"],
          },
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "3-Course Service" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrees" })).toBeInTheDocument();
    expect(screen.queryByText("Formal Dinner Packages")).not.toBeInTheDocument();
    expect(screen.queryByText("Menu Options")).not.toBeInTheDocument();
    expect(screen.queryByText("Menu Selections")).not.toBeInTheDocument();
  });
});
