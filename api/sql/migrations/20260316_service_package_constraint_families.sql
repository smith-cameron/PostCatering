INSERT INTO service_plan_constraints (
  service_plan_id,
  selection_key,
  min_select,
  max_select
)
SELECT
  aggregated.service_plan_id,
  'entree_signature_protein',
  aggregated.min_select,
  aggregated.max_select
FROM (
  SELECT
    spc.service_plan_id,
    SUM(COALESCE(spc.min_select, 0)) AS min_select,
    SUM(COALESCE(spc.max_select, 0)) AS max_select
  FROM service_plan_constraints spc
  JOIN service_plans p ON p.id = spc.service_plan_id
  WHERE p.plan_key LIKE 'catering:%'
    AND p.selection_mode IN ('menu_groups', 'hybrid')
    AND spc.selection_key IN ('entree', 'entrees', 'protein', 'proteins', 'signature_protein', 'signature_proteins')
  GROUP BY spc.service_plan_id
) aggregated
ON DUPLICATE KEY UPDATE
  min_select = VALUES(min_select),
  max_select = VALUES(max_select);

DELETE spc
FROM service_plan_constraints spc
JOIN service_plans p ON p.id = spc.service_plan_id
WHERE p.plan_key LIKE 'catering:%'
  AND p.selection_mode IN ('menu_groups', 'hybrid')
  AND spc.selection_key IN ('entree', 'entrees', 'protein', 'proteins', 'signature_protein', 'signature_proteins');

INSERT INTO service_plan_constraints (
  service_plan_id,
  selection_key,
  min_select,
  max_select
)
SELECT
  aggregated.service_plan_id,
  'sides_salads',
  aggregated.min_select,
  aggregated.max_select
FROM (
  SELECT
    spc.service_plan_id,
    SUM(COALESCE(spc.min_select, 0)) AS min_select,
    SUM(COALESCE(spc.max_select, 0)) AS max_select
  FROM service_plan_constraints spc
  JOIN service_plans p ON p.id = spc.service_plan_id
  WHERE p.plan_key LIKE 'catering:%'
    AND p.selection_mode = 'menu_groups'
    AND spc.selection_key IN ('side', 'sides', 'salad', 'salads')
  GROUP BY spc.service_plan_id
) aggregated
ON DUPLICATE KEY UPDATE
  min_select = VALUES(min_select),
  max_select = VALUES(max_select);

DELETE spc
FROM service_plan_constraints spc
JOIN service_plans p ON p.id = spc.service_plan_id
WHERE p.plan_key LIKE 'catering:%'
  AND p.selection_mode = 'menu_groups'
  AND spc.selection_key IN ('side', 'sides', 'salad', 'salads');

DELETE spd
FROM service_plan_details spd
JOIN service_plans p ON p.id = spd.service_plan_id
WHERE p.plan_key IN ('catering:homestyle', 'catering:buffet_tier_1', 'catering:buffet_tier_2')
  AND spd.detail_text IN (
    '1 Entree/Protein',
    '2 Side/Salad',
    '2 Entrees',
    '2 Sides',
    '1 Salad',
    '2-3 Entrees',
    '3 Sides',
    '2 Salads'
  );

INSERT INTO service_plan_details (
  service_plan_id,
  detail_text,
  sort_order
)
SELECT
  p.id,
  'Bread',
  1
FROM service_plans p
LEFT JOIN service_plan_details existing
  ON existing.service_plan_id = p.id
 AND existing.detail_text = 'Bread'
WHERE p.plan_key IN ('catering:homestyle', 'catering:buffet_tier_1', 'catering:buffet_tier_2')
  AND existing.id IS NULL;

UPDATE service_plan_details spd
JOIN service_plans p ON p.id = spd.service_plan_id
SET spd.sort_order = 1
WHERE p.plan_key IN ('catering:homestyle', 'catering:buffet_tier_1', 'catering:buffet_tier_2')
  AND spd.detail_text = 'Bread';
