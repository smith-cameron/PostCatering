START TRANSACTION;

UPDATE service_plan_constraints constraints_row
JOIN service_plans plans ON plans.id = constraints_row.service_plan_id
SET constraints_row.selection_key = 'entree_signature_protein'
WHERE plans.plan_key LIKE 'catering:%'
  AND plans.selection_mode IN ('menu_groups', 'hybrid')
  AND constraints_row.selection_key = 'entree';

UPDATE service_plan_constraints constraints_row
JOIN service_plans plans ON plans.id = constraints_row.service_plan_id
SET constraints_row.selection_key = 'signature_protein'
WHERE plans.plan_key = 'catering:taco_bar'
  AND constraints_row.selection_key = 'entree';

UPDATE service_plan_selection_groups groups_row
JOIN service_plans plans ON plans.id = groups_row.service_plan_id
SET groups_row.group_key = 'signature_protein'
WHERE plans.plan_key = 'catering:taco_bar'
  AND groups_row.group_key = 'entree';

COMMIT;
