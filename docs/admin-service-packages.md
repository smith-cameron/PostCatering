# Admin Service Packages

Last updated: March 22, 2026

This document covers the current service-package model used by the admin dashboard and `/api/menus`.

## Scope

The runtime package catalogs are fixed:
- `catering`
- `formal`

There is no admin CRUD for section definitions. Sections are fixed operational buckets behind those catalogs.

Current seeded sections:
- `catering_packages` (`packages`)
- `catering_menu_options` (`include_menu`)
- `formal_packages` (`packages`)

## Admin Routes

The admin shell keeps one shared layout and renders routed pages inside it:
- `/admin/menu-items`
- `/admin/service-packages`
- `/admin/media`
- `/admin/settings`

`/admin/service-packages` is the package-management surface.

## Data Model

Menu dishes and service packages are separate domains.

Menu dishes:
- `menu_items`
- `menu_types`
- `menu_groups`
- `menu_type_groups`
- `menu_item_type_groups`

Service packages:
- `service_plan_sections`
- `service_section_menu_groups`
- `service_plans`
- `service_plan_constraints`
- `service_plan_details`
- `service_plan_selection_groups`
- `service_plan_selection_options`

## Admin Editing Model

The admin UI is intentionally simpler than the storage model.

What admins manage:
- destination package section
- core fields: title, price, active
- `Included Items`
- `Customer Chooses`

What that maps to under the hood:
- selected package section -> `service_plans.section_id`
- `Included Items` -> `service_plan_details`
- menu-backed customer choices -> `service_plan_constraints`
- custom-option customer choices -> `service_plan_selection_groups` + `service_plan_selection_options`
- `include_menu` section families -> `service_section_menu_groups` (fixed/seeded, not edited in the current admin UI)

The editor derives `selection_mode` instead of asking admins to manage it directly:
- `menu_groups`: menu-backed customer choices only
- `custom_options`: custom-option groups only
- `hybrid`: both menu-backed and custom-option choices
- `none`: no customer-choice rows

Plans cannot be created inside `include_menu` sections.

## Package Rules

- `is_active` is the only live package status.
- Inactive packages are hidden from public package data and the inquiry flow.
- Save-time validation rejects packages where `Included Items` duplicate `Customer Chooses`.
- Catering packages can use menu-backed choice families such as:
  - `entree_signature_protein`
  - `entree`
  - `signature_protein`
  - `sides`
  - `salads`
  - `sides_salads`
- Formal packages can use menu-backed choice families such as:
  - `passed`
  - `starter`
  - `entree`
  - `side`
- Package price display is stored in `service_plans.price_display`, with parsed numeric metadata persisted alongside it.

## Public Payload Notes

`/api/menus` remains the public source of truth for service-package rendering.

Current important behaviors:
- Catering package data renders through section entries, not one section per package.
- `packages` sections become package collections in the public payload.
- `include_menu` sections become `includeMenu` sections with `includeKeys`.
- Formal package options are separate from formal course-option lists.
- Formal course-option lists still use grouped `tiers` blocks, and the client mapping layer still carries legacy compatibility for `tier_title` while current payloads use `tierTitle` as presentation data.

## Operational Notes

Apply schema and sync menu/package seed data with:

```powershell
cd api
python scripts/menu_admin_sync.py --apply-schema --reset
```

Use `is_active = 0` for archival instead of deleting data unless you explicitly want a hard delete.

If package behavior changes, update both:
- the admin-facing save/load contract
- the `/api/menus` public payload contract

That keeps admin editing, inquiry validation, and service-page rendering aligned.
