# Admin Service Packages

This document covers the current service-package model used by the admin dashboard and `/api/menus`.

## Scope

The runtime package catalogs are fixed:
- `catering`
- `formal`

There is no admin CRUD for package sections. Sections are fixed operational buckets behind those catalogs.

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
- `service_plans`
- `service_plan_constraints`
- `service_plan_details`
- `service_plan_selection_groups`
- `service_plan_selection_options`

## Admin Editing Model

The admin UI is intentionally simpler than the storage model.

What admins manage:
- Core fields: title, price, active
- `Included Items`
- `Customer Chooses`

What that maps to under the hood:
- `Included Items` -> `service_plan_details`
- Menu-backed customer choices -> `service_plan_constraints`
- Custom-option customer choices -> `service_plan_selection_groups` + `service_plan_selection_options`

The editor derives `selection_mode` instead of asking admins to manage it directly.

## Package Rules

- `is_active` is the only live package status.
- Inactive packages are archived and hidden from public service pages and the inquiry flow.
- Save-time validation rejects packages where `Included Items` duplicate `Customer Chooses`.
- Catering packages can use combined or specific choice families such as:
  - `entree_signature_protein`
  - `entree`
  - `signature_protein`
  - `sides`
  - `salads`
  - `sides_salads`

## Public Payload Notes

`/api/menus` remains the public source of truth for service-package rendering.

Current important behaviors:
- Catering packages render through package sections, not one section per package.
- Formal package options are separate from formal course-option lists.
- Formal course-option lists still use grouped option blocks, which is why `tier_title` remains in the `/api/menus` field mapping.

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
