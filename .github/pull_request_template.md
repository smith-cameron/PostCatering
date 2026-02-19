## Summary

Describe what changed and why.

## Validation

- [ ] Backend tests run (if backend changed)
- [ ] Frontend lint/tests/build run (if frontend changed)
- [ ] Manual smoke check performed for affected flows

## Deployment Impact

- [ ] No production deployment impact
- [ ] Production deployment impact exists (details below)

Deployment notes:

Add required deploy steps, environment changes, and timing constraints.

## Cutover Readiness (Complete If Production/Cutover Impact Exists)

- [ ] `docs/deployment-aws-ec2.md` reviewed and updated if needed
- [ ] `docs/pre-cutover-checklist.md` reviewed
- [ ] `docs/cutover-command-sheet.md` reviewed and placeholders verified
- [ ] Database migration/backup plan documented
- [ ] Rollback plan documented
- [ ] Required secret rotation documented (`DB`, `FLASK_SECRET_KEY`, `MENU_ADMIN_TOKEN`, `SMTP`)
- [ ] DNS/certificate changes documented (if applicable)
