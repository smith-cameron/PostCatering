# Color Scheme Reference

Prepared on March 7, 2026 for non-destructive theme evaluation.
Updated on March 8, 2026 after selecting the runtime light/dark pair.

This file does not change runtime styling. It records the selected theme pair now used in `client/src/App.css` and keeps the other trial palettes below as archived reference for future fine tuning.

## Quick palette cheat sheet

Use this section when you only need the short version.

### Original baseline

- Vibe: clean blue-and-slate default UI with green success states
- Page: `#ffffff`
- Surface: `#fbfcff`
- Accent: `#3473a4`
- Accent hover/active: `#2d648f`, `#295a80`
- Text: `#1f2937`
- Muted: `#5f6e81`
- Border: `#bcc8d8`
- Danger: `#dc3545`
- Positive/selected: `#2f9d56`

### Selected runtime pair

- Light mode: `Cream & Oxblood`
  Page `#f7f3ea`, surface `#fffdf8`, alt `#f3ecdf`, accent `#5a728a`, text `#2a2a2a`, muted `#70675d`, border `#d9cfbe`, danger `#6e2c2c`, highlight `#d0a648`
- Dark mode: `Midnight Bistro`
  Page `#20262b`, surface `#2a3137`, alt `#343d45`, accent `#6f8ca3`, text `#f3ebdd`, muted `#d2c4b1`, border `#4b555d`, danger `#a0524a`, highlight `#c9a35a`
- Admin dark mode now follows the same Midnight Bistro family instead of a separate legacy dark palette

### Harbor Rustic

- Vibe: warm cream, dusty blue, brick red, soft brass
- Page: `#f5f1e8`
- Surface: `#fcfaf6`
- Surface alt: `#f1ebdf`
- Accent: `#4f6b7a`
- Text: `#232629`
- Muted: `#6a685f`
- Border: `#d7cfc2`
- Danger: `#8a3b34`
- Highlight: `#c29a4b`

### Slate & Brass

- Vibe: cooler, more restrained, slightly formal
- Page: `#eee8dd`
- Surface: `#f8f4ec`
- Surface alt: `#ece5d8`
- Accent: `#3f5870`
- Text: `#1f2328`
- Muted: `#68655d`
- Border: `#d2c7b7`
- Danger: `#7a2f2f`
- Highlight: `#b88a2e`

### Cream & Oxblood

- Vibe: warmer, richer, more handcrafted
- Page: `#f7f3ea`
- Surface: `#fffdf8`
- Surface alt: `#f3ecdf`
- Accent: `#5a728a`
- Text: `#2a2a2a`
- Muted: `#70675d`
- Border: `#d9cfbe`
- Danger: `#6e2c2c`
- Highlight: `#d0a648`

### Midnight Bistro

- Vibe: darker, dramatic, evening-service feel
- Page: `#20262b`
- Surface: `#2a3137`
- Surface alt: `#343d45`
- Accent: `#6f8ca3`
- Text: `#f3ebdd`
- Muted: `#d2c4b1`
- Border: `#4b555d`
- Danger: `#a0524a`
- Highlight: `#c9a35a`

## Original color families that were replaced

- Primary blue family: `#3473a4`, `#2d648f`, `#295a80`, `#214e73`, `#173a58`
- Light surface family: `#ffffff`, `#fff`, `#fbfcff`, `#f4f7fb`, `#eef3f8`, `#eaf0fb`
- Text family: `#1f2937`, `#1a2433`, `#334155`
- Muted copy family: `#5f6e81`, `#728399`, `#6b7f98`
- Border family: `#bcc8d8`, `#c7d3e0`, `#8fa0b5`, `#3d4b61`
- Destructive and required family: `#dc3545`, `#e18992`, `#9f1239`, `#b91c1c`
- Positive and selected family: `#2f9d56`, `#41b26a`, `#7ecf9c`

## Application notes

- Keep pure white and pure black out of the main surfaces. Use warm off-white and charcoal instead.
- The selected production pair is `Cream & Oxblood` for light mode and `Midnight Bistro` for dark mode.
- The archived palettes below remain useful if we want to revisit accent contrast, warmth, or surface tone during later fine tuning.

## 1. Harbor Rustic

Recommended first trial. Warm cream surfaces, dusty blue actions, brick red alerts, and soft brass highlights.

### Token set

```css
:root {
  --bg-color: #f5f1e8;
  --text-color: #232629;
  --border-color: #d7cfc2;
  --accent-color: #4f6b7a;
  --app-form-focus-border: #4f6b7a;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(79, 107, 122, 0.22);
  --app-form-invalid-border: #8a3b34;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(138, 59, 52, 0.22);

  --trial-surface: #fcfaf6;
  --trial-surface-alt: #f1ebdf;
  --trial-border-strong: #c7b7a2;
  --trial-text-strong: #1f2528;
  --trial-text-muted: #6a685f;
  --trial-highlight: #c29a4b;
  --trial-highlight-soft: rgba(194, 154, 75, 0.16);
  --trial-accent-hover: #435d6a;
  --trial-accent-active: #384f59;
  --trial-accent-soft: rgba(79, 107, 122, 0.12);
  --trial-danger-soft: rgba(138, 59, 52, 0.1);
}

.admin-dashboard {
  --admin-bg: #efe8dc;
  --admin-surface: #fcfaf6;
  --admin-border: #c7b7a2;
  --admin-text: #232629;
  --admin-muted: #6a685f;
  --admin-row-hover-text: #384f59;
}

.admin-dashboard.admin-dashboard-dark {
  --admin-bg: #232629;
  --admin-surface: #2d3438;
  --admin-border: #5f6b72;
  --admin-text: #f5f1e8;
  --admin-muted: #c9bcab;
  --admin-row-hover-text: #fcfaf6;
  --app-form-focus-border: #7f98a5;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(127, 152, 165, 0.24);
  --app-form-invalid-border: #b97068;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(185, 112, 104, 0.24);
}
```

### Color mapping

- Blue family to dusty blue: `#4f6b7a`, hover `#435d6a`, active `#384f59`
- Surface family to warm cream: `#fcfaf6`, alt `#f1ebdf`, page `#f5f1e8`
- Text family to charcoal: `#232629`, headings `#1f2528`, muted `#6a685f`
- Destructive family to brick red: `#8a3b34`, soft `rgba(138, 59, 52, 0.1)`
- Yellow accents to brass: `#c29a4b`
- Positive and selected states to steel blue or brass instead of green

## 2. Slate & Brass

Cooler and slightly more formal than Harbor Rustic. Better if the site should feel restrained and corporate, but still not sterile.

### Token set

```css
:root {
  --bg-color: #eee8dd;
  --text-color: #1f2328;
  --border-color: #d2c7b7;
  --accent-color: #3f5870;
  --app-form-focus-border: #3f5870;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(63, 88, 112, 0.22);
  --app-form-invalid-border: #7a2f2f;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(122, 47, 47, 0.22);

  --trial-surface: #f8f4ec;
  --trial-surface-alt: #ece5d8;
  --trial-border-strong: #baa992;
  --trial-text-strong: #1a1f24;
  --trial-text-muted: #68655d;
  --trial-highlight: #b88a2e;
  --trial-highlight-soft: rgba(184, 138, 46, 0.16);
  --trial-accent-hover: #34495d;
  --trial-accent-active: #2b3d4f;
  --trial-accent-soft: rgba(63, 88, 112, 0.12);
  --trial-danger-soft: rgba(122, 47, 47, 0.1);
}

.admin-dashboard {
  --admin-bg: #e9e1d2;
  --admin-surface: #f8f4ec;
  --admin-border: #baa992;
  --admin-text: #1f2328;
  --admin-muted: #68655d;
  --admin-row-hover-text: #2b3d4f;
}

.admin-dashboard.admin-dashboard-dark {
  --admin-bg: #1f2328;
  --admin-surface: #2a2f35;
  --admin-border: #5a6470;
  --admin-text: #f4eee5;
  --admin-muted: #c7bbab;
  --admin-row-hover-text: #fcfaf6;
  --app-form-focus-border: #70869b;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(112, 134, 155, 0.24);
  --app-form-invalid-border: #b66b6b;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(182, 107, 107, 0.24);
}
```

### Color mapping

- Blue family to slate blue: `#3f5870`
- Surface family to parchment: `#f8f4ec`, alt `#ece5d8`, page `#eee8dd`
- Text family to near-black slate: `#1f2328`
- Destructive family to muted oxblood: `#7a2f2f`
- Yellow accents to aged brass: `#b88a2e`
- Positive and selected states to the accent blue family

## 3. Cream & Oxblood

Warmer and slightly richer. Best if you want the brand to feel more handcrafted or restaurant-led without losing polish.

### Token set

```css
:root {
  --bg-color: #f7f3ea;
  --text-color: #2a2a2a;
  --border-color: #d9cfbe;
  --accent-color: #5a728a;
  --app-form-focus-border: #5a728a;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(90, 114, 138, 0.22);
  --app-form-invalid-border: #6e2c2c;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(110, 44, 44, 0.22);

  --trial-surface: #fffdf8;
  --trial-surface-alt: #f3ecdf;
  --trial-border-strong: #c9b59d;
  --trial-text-strong: #222222;
  --trial-text-muted: #70675d;
  --trial-highlight: #d0a648;
  --trial-highlight-soft: rgba(208, 166, 72, 0.16);
  --trial-accent-hover: #4c6176;
  --trial-accent-active: #415464;
  --trial-accent-soft: rgba(90, 114, 138, 0.12);
  --trial-danger-soft: rgba(110, 44, 44, 0.1);
}

.admin-dashboard {
  --admin-bg: #f1e8da;
  --admin-surface: #fffdf8;
  --admin-border: #c9b59d;
  --admin-text: #2a2a2a;
  --admin-muted: #70675d;
  --admin-row-hover-text: #415464;
}

.admin-dashboard.admin-dashboard-dark {
  --admin-bg: #2a2a2a;
  --admin-surface: #343231;
  --admin-border: #665f58;
  --admin-text: #f7f0e4;
  --admin-muted: #d0c2af;
  --admin-row-hover-text: #fffdf8;
  --app-form-focus-border: #89a0b6;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(137, 160, 182, 0.24);
  --app-form-invalid-border: #bf7c7c;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(191, 124, 124, 0.24);
}
```

### Color mapping

- Blue family to softened denim: `#5a728a`
- Surface family to cream linen: `#fffdf8`, alt `#f3ecdf`, page `#f7f3ea`
- Text family to warm charcoal: `#2a2a2a`
- Destructive family to oxblood: `#6e2c2c`
- Yellow accents to warm mustard: `#d0a648`
- Positive and selected states to blue with yellow support accents

## 4. Midnight Bistro

Darker and more dramatic. This is the least rustic of the four, but still usable if you want a more upscale evening-service look.

### Token set

```css
:root {
  --bg-color: #20262b;
  --text-color: #f3ebdd;
  --border-color: #4b555d;
  --accent-color: #6f8ca3;
  --app-form-focus-border: #6f8ca3;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(111, 140, 163, 0.22);
  --app-form-invalid-border: #a0524a;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(160, 82, 74, 0.22);

  --trial-surface: #2a3137;
  --trial-surface-alt: #343d45;
  --trial-border-strong: #65727c;
  --trial-text-strong: #fbf6ed;
  --trial-text-muted: #d2c4b1;
  --trial-highlight: #c9a35a;
  --trial-highlight-soft: rgba(201, 163, 90, 0.16);
  --trial-accent-hover: #5d788d;
  --trial-accent-active: #506675;
  --trial-accent-soft: rgba(111, 140, 163, 0.12);
  --trial-danger-soft: rgba(160, 82, 74, 0.1);
}

.admin-dashboard {
  --admin-bg: #20262b;
  --admin-surface: #2a3137;
  --admin-border: #4b555d;
  --admin-text: #f3ebdd;
  --admin-muted: #c8b8a2;
  --admin-row-hover-text: #fbf6ed;
}

.admin-dashboard.admin-dashboard-dark {
  --admin-bg: #171c20;
  --admin-surface: #20262b;
  --admin-border: #5a6670;
  --admin-text: #f5ede1;
  --admin-muted: #cfbea8;
  --admin-row-hover-text: #fff9f0;
  --app-form-focus-border: #8fa9bd;
  --app-form-focus-ring: 0 0 0 0.2rem rgba(143, 169, 189, 0.24);
  --app-form-invalid-border: #c37d74;
  --app-form-invalid-ring: 0 0 0 0.2rem rgba(195, 125, 116, 0.24);
}
```

### Color mapping

- Blue family to muted steel blue: `#6f8ca3`
- Surface family to blue-black charcoal: `#2a3137`, alt `#343d45`, page `#20262b`
- Text family to warm ivory: `#f3ebdd`
- Destructive family to softened brick: `#a0524a`
- Yellow accents to antique gold: `#c9a35a`
- Positive and selected states to lighter steel blue

## Recommendation order

1. Harbor Rustic
2. Cream & Oxblood
3. Slate & Brass
4. Midnight Bistro

## Next step when ready

Apply one palette in a dedicated pass to:

- root variables
- inquiry button and focus states
- accordion and section backgrounds
- nav inquiry highlight styles
- inquiry summary and desired-item panels
- showcase card and modal surfaces
- admin light and dark variables
- remaining one-off hardcoded accents
