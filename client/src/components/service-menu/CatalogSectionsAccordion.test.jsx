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
});
