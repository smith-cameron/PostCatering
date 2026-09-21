## Summary

- Generalize the deployment and launch-day cutover documentation around source and target environments.
- Remove hardcoded instance addresses, SSH key names, account ownership, and environment-specific labels.
- Retain the operational steps for database backup/import, uploaded-media transfer, DNS cutover, validation, rollback, secret rotation, and source-environment decommissioning.
- Add reusable connection variables and include uploaded-media transfer commands in the command-focused cutover sheet.

## Testing

- Ran `git diff --check` successfully.
- Confirmed the updated runbooks contain no known production hostnames or SSH key filenames.
- Application tests were not run because this PR changes documentation only.
