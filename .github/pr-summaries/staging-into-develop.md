## Summary

- Synchronize the validated `staging` state back into `develop`.
- Carry the current production release, deployment documentation, and staging merge history into the integration branch.
- Re-establish `develop -> staging -> main` as the forward promotion path for subsequent work.

## Testing

- Required GitHub Actions checks must pass before merge.
- No additional application changes are introduced by this synchronization PR.
- Follow-up feature branches should start from the updated `develop` branch.
