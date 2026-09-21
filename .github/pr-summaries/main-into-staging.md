## Summary

- Synchronize the current production state from `main` back into `staging`.
- Carry the released media, security, frontend, deployment, and documentation updates into the pre-production branch.
- Restore branch ancestry after the hotfix release and subsequent production documentation updates.

## Testing

- Required GitHub Actions checks must pass before merge.
- The release-line backend suite previously passed with 136 tests.
- No additional application changes are introduced by this synchronization PR.
