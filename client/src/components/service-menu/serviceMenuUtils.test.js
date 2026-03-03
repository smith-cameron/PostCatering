import { describe, expect, it } from "vitest";
import { buildMenuSections } from "./serviceMenuUtils";

describe("buildMenuSections", () => {
  it("removes formal items from non-formal include-menu blocks", () => {
    const sections = buildMenuSections({
      menuKey: "community",
      data: {
        sections: [
          {
            sectionId: "community_menu_options",
            type: "includeMenu",
            title: "Menu Options",
            includeKeys: ["entree"],
          },
        ],
      },
      menuOptions: {
        entree: {
          title: "Entrees",
          items: ["Jerk Chicken", "Braised Short Rib"],
        },
      },
      excludedNonFormalItemNames: new Set(["braised short rib"]),
    });

    expect(sections).toHaveLength(1);
    expect(sections[0].blocks).toHaveLength(1);
    expect(sections[0].blocks[0].items).toEqual(["Jerk Chicken"]);
  });

  it("removes formal items from to-go tray sections", () => {
    const sections = buildMenuSections({
      menuKey: "togo",
      data: {
        sections: [
          {
            sectionId: "togo_entree",
            title: "Entrees",
            columns: ["Item", "Half Tray", "Full Tray"],
            rows: [
              ["Jerk Chicken", "$75", "$140"],
              ["Braised Short Rib", "$95", "$180"],
            ],
          },
        ],
      },
      excludedNonFormalItemNames: new Set(["braised short rib"]),
    });

    expect(sections).toHaveLength(1);
    expect(sections[0].blocks).toHaveLength(1);
    expect(sections[0].blocks[0].rows).toEqual([["Jerk Chicken", "$75", "$140"]]);
  });
});
