
export const MENU_OPTIONS = {
  bakedHeartyEntrees: {
    title: "Baked & Hearty Entrées",
    items: [
      "Lasagna (Meat or Veg)",
      "Enchiladas (Cheese or Chicken, Red or Green)",
      "Baked Ziti (Veg or Beef)",
      "BBQ Pulled Pork",
      "Shepherd's Pie",
      "Beef Stroganoff",
      "Beef & Pancetta Bolognese Pappardelle",
    ],
  },
  signatureProteins: {
    title: "Signature Proteins",
    items: [
      "Bone-In Herb Roasted Chicken Thighs",
      "Apple Cider-Marinated Pork Chops",
      "Marinated Pork Stir-Fry",
      "Stuffed Chicken Breast (Spinach, Mushroom, Cheese)",
      "Herb-Marinated Tri-Tip w/ Chimichurri",
      "Braised Short Ribs",
    ],
  },
  sidesSalads: {
    title: "Sides & Salads",
    items: [
      "Garlic Mashed Potatoes",
      "Herb Roasted Fingerlings",
      "Rice Pilaf",
      "Mac & Cheese",
      "Pasta Salad (Creamy or Pesto)",
      "Coleslaw",
      "Roasted Seasonal Vegetables",
      "Caesar Salad",
      "Watermelon & Feta Salad",
      "Beet & Citrus Salad",
      "Cucumber Tomato Salad",
      "Caprese Salad",
      "Au Gratin Potatoes",
      "Strawberry Arugula Salad",
      "Garlic Bread / Rolls / Cornbread",
      "Fried Rice",
      "Lumpia",
      "Charcuterie Board (Serves 10-12)",
    ],
  },
};


export const MENU = {
  togo: {
    pageTitle: "To-Go & Take-and-Bake Trays",
    subtitle: "Served hot or chilled to reheat",
    introBlocks: [
      {
        title: "Tray Sizes",
        bullets: ["Half Tray: Serves 8-10", "Full Tray: Serves 16-20"],
      },
    ],
    sections: [
      {
        title: "Baked & Hearty Entrée Trays",
        columns: ["Entrée", "Half Tray", "Full Tray"],
        rows: [
          ["Lasagna (Meat or Veg)", "$75", "$135"],
          ["Enchiladas (Cheese or Chicken, Red or Green)", "$70", "$130"],
          ["Baked Ziti (Veg or Beef)", "$65", "$120"],
          ["BBQ Pulled Pork", "$75", "$140"],
          ["Shepherd's Pie", "$80", "$150"],
          ["Beef Stroganoff", "$85", "$160"],
          ["Beef & Pancetta Bolognese Pappardelle", "$90", "$170"],
        ],
      },
      {
        title: "Signature Protein Trays",
        columns: ["Entrée", "Half Tray", "Full Tray"],
        rows: [
          ["Bone-In Herb Roasted Chicken Thighs", "$75", "$140"],
          ["Apple Cider-Marinated Pork Chops", "$85", "$160"],
          ["Marinated Pork Stir-Fry", "$80", "$150"],
          ["Stuffed Chicken Breast (Spinach, Mushroom, Cheese)", "$90", "$170"],
          ["Herb-Marinated Tri-Tip w/ Chimichurri", "$110", "$210"],
          ["Braised Short Ribs", "$120", "$225"],
        ],
      },
      {
        title: "Sides & Salads",
        columns: ["Side", "Half", "Full"],
        rows: [
          ["Garlic Mashed Potatoes", "$40", "$75"],
          ["Herb Roasted Fingerlings", "$40", "$75"],
          ["Rice Pilaf", "$35", "$65"],
          ["Mac & Cheese", "$45", "$85"],
          ["Pasta Salad (Creamy or Pesto)", "$35", "$65"],
          ["Coleslaw", "$30", "$55"],
          ["Roasted Seasonal Vegetables", "$40", "$75"],
          ["Caesar Salad", "$35", "$65"],
          ["Watermelon & Feta Salad", "$40", "$75"],
          ["Beet & Citrus Salad", "$40", "$75"],
          ["Cucumber Tomato Salad", "$35", "$65"],
          ["Caprese Salad", "$45", "$85"],
          ["Au Gratin Potatoes", "$45", "$85"],
          ["Strawberry Arugula Salad", "$40", "$75"],
          ["Garlic Bread / Rolls / Cornbread", "$25", "$45"],
          ["Fried Rice", "$45", "$85"],
          ["Lumpia", "$55", "$100"],
          ["Charcuterie Board (Serves 10-12)", "—", "$95"],
        ],
      },
    ],
  },

  community: {
    pageTitle: "Community & Crew Catering (Per Person)",
    subtitle: "Drop-off or buffet setup • Minimums apply",
    sections: [
      {
        type: "package",
        title: "Taco Bar (Carne Asada or Chicken)",
        description: "Includes Spanish rice, refried beans, tortillas, toppings",
        price: "$18-$25 per person",
      },
      {
        type: "package",
        title: "Hearty Homestyle Packages",
        description: "Choose 1 protein + 2 sides + bread",
        price: "$20-$28 per person",
      },
      {
        type: "tiers",
        title: "Event Catering - Buffet Style",
        tiers: [
          {
            tierTitle: "Tier 1: Casual Buffet",
            price: "$30-$40 per person",
            bullets: ["2 Entrées", "2 Sides", "1 Salad", "Bread"],
          },
          {
            tierTitle: "Tier 2: Elevated Buffet / Family-Style",
            price: "$45-$65 per person",
            bullets: ["2-3 Entrées", "3 Sides", "2 Salads", "Bread"],
          },
        ],
      },
      {
        type: "includeMenu",
        title: "Menu Options (Entrées, Proteins, Sides & Salads)",
        includeKeys: ["bakedHeartyEntrees", "signatureProteins", "sidesSalads"],
        note: "These are the same menu options used to build the catering packages above.",
      },
    ],
  },
  // inside export const MENU = { ... }

  formal: {
    pageTitle: "Formal Events - Plated & Full Service",
    subtitle: "Three-course dinner",
    sections: [
      {
        type: "package",
        title: "Three-Course Dinner Pricing",
        description: "Per person pricing (final depends on selections and service details).",
        price: "$75-$110+ per person",
      },
      {
        type: "tiers",
        title: "Passed Appetizers (Choose Two)",
        tiers: [
          {
            tierTitle: "Options",
            price: "",
            bullets: ["Bruschetta", "Caprese Crostini", "Prosciutto & Brie Bites", "Sirloin Sliders"],
          },
        ],
      },
      {
        type: "tiers",
        title: "Starter (Choose One)",
        tiers: [
          {
            tierTitle: "Options",
            price: "",
            bullets: ["Caesar", "Beet & Citrus Salad", "Caprese", "Strawberry Arugula Salad"],
          },
        ],
      },
      {
        type: "tiers",
        title: "Entrée (Choose One or Two)",
        tiers: [
          {
            tierTitle: "Options",
            price: "",
            bullets: [
              "Braised Short Rib",
              "Apple Cider-Marinated Pork Chop",
              "Herb-Marinated Tri-Tip",
              "Spinach & Mushroom Stuffed Chicken Breast",
              "Mushroom Risotto (Vegetarian)",
            ],
          },
        ],
      },
      {
        type: "tiers",
        title: "Sides",
        tiers: [
          {
            tierTitle: "Options",
            price: "",
            bullets: ["Garlic Mashed Potatoes or Au Gratin", "Seasonal Vegetables", "Rice Pilaf"],
          },
        ],
      },
    ],
  },

};
