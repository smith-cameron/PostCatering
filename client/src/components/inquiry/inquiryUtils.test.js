import { describe, expect, it } from "vitest";
import { buildCateringSelectionRules, buildServicePlanOptions, getDisplayPlanDetails } from "./inquiryUtils";

describe("inquiryUtils service-plan helpers", () => {
  it("uses stable plan ids and active status from the menu payload", () => {
    const plans = buildServicePlanOptions(
      "catering",
      {
        catering: {
          sections: [
            {
              sectionId: "catering_packages",
              type: "package",
              title: "Taco Bar",
              planId: "catering:taco_bar",
              details: ["Spanish rice", "Refried beans"],
              constraints: { signature_protein: { min: 1, max: 1 } },
              selectionMode: "custom_options",
              selectionGroups: [
                {
                  groupKey: "signature_protein",
                  title: "Taco Bar Proteins",
                  options: [{ optionKey: "chicken", label: "Chicken" }],
                },
              ],
              isActive: true,
            },
            {
              sectionId: "catering_packages",
              type: "packages",
              title: "Catering Packages",
              packages: [
                {
                  planId: "catering:buffet_tier_1",
                  title: "Tier 1: Casual Buffet",
                  details: ["Bread"],
                  constraints: {
                    entree_signature_protein: { min: 2, max: 2 },
                    sides_salads: { min: 3, max: 3 },
                  },
                  isActive: true,
                },
                {
                  planId: "catering:archived_dropoff",
                  title: "Archived Drop-Off Package",
                  details: ["Chef-selected assortment"],
                  isActive: false,
                },
              ],
            },
          ],
        },
      },
      []
    );

    expect(plans.map((plan) => plan.id)).toEqual(["catering:taco_bar", "catering:buffet_tier_1"]);
    expect(getDisplayPlanDetails("catering", plans[0], null)).toEqual([
      "Spanish rice",
      "Refried beans",
      "Taco Bar Proteins: Chicken",
    ]);
  });

  it("prefers payload constraints over legacy title matching", () => {
    const rules = buildCateringSelectionRules({
      id: "catering:custom_package",
      title: "Custom Package",
      constraints: {
        entree_signature_protein: { min: 2, max: 2 },
        sides_salads: { min: 3, max: 3 },
      },
    });

    expect(rules).toEqual({
      entree_signature_protein: { min: 2, max: 2 },
      sides_salads: { min: 3, max: 3 },
    });
  });

  it("preserves specific catering menu families when a package uses them", () => {
    const rules = buildCateringSelectionRules({
      id: "catering:entree_salad_lunch",
      title: "Entree and Salad Lunch",
      constraints: {
        entree: { min: 1, max: 1 },
        salads: { min: 1, max: 1 },
      },
    });

    expect(rules).toEqual({
      entree: { min: 1, max: 1 },
      salads: { min: 1, max: 1 },
    });
    expect(
      getDisplayPlanDetails(
        "catering",
        {
          id: "catering:entree_salad_lunch",
          title: "Entree and Salad Lunch",
          details: ["Bread"],
          selectionMode: "menu_groups",
        },
        rules
      )
    ).toEqual(["1 Entree", "1 Salad", "Bread"]);
  });
});
