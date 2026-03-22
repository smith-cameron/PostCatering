import { describe, expect, it } from "vitest";
import { buildMenuSections, getApprovedFormalPlans, getFormalPlanDetails } from "./serviceMenuUtils";

describe("buildMenuSections", () => {
  it("removes formal items from non-formal include-menu blocks", () => {
    const sections = buildMenuSections({
      menuKey: "catering",
      data: {
        sections: [
          {
            sectionId: "catering_menu_options",
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

  it("uses active status as the only formal package gate", () => {
    const plans = getApprovedFormalPlans([
      {
        id: "formal:2-course",
        title: "Two-Course Dinner",
        isActive: false,
        details: ["1 Starter", "1 Entree", "Bread"],
      },
      {
        id: "formal:3-course",
        title: "Three-Course Dinner",
        isActive: true,
        details: ["2 Passed Appetizers", "1 Starter", "1 or 2 Entrees", "Bread"],
      },
    ]);

    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("formal:3-course");
    expect(getFormalPlanDetails(plans[0])).toEqual([
      "2 Passed Appetizers",
      "1 Starter",
      "1 or 2 Entrees",
      "Bread",
    ]);
  });
});
