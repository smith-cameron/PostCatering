# Hotfix: Point Main Releases At The Production Site

## Summary

- replace the obsolete AWS SSM/EC2 deployment target with the configured production SSH host
- deploy the exact `main` commit that completed CI successfully
- publish deployments through GitHub's `production` environment with its public site URL
- verify both the host-local and public production health endpoints
- document the required production environment variables, secrets, and host-key pinning

## Why

The current `Deploy EC2` workflow authenticates to AWS but fails before deployment
because the configured `EC2_INSTANCE_ID` is no longer a valid managed instance.
As a result, successful updates to `main` do not reach the deployed production
site.

## Required GitHub Configuration

Create or update the `production` environment before merging:

- variables: `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_URL`
- secrets: `PRODUCTION_SSH_PRIVATE_KEY`, `PRODUCTION_SSH_KNOWN_HOSTS`

Optional deployment overrides are documented in
`docs/deploy-automation-production.md`.

## Validation

- workflow YAML syntax validated locally
- shell syntax validated for `ops/deploy-ec2.sh`
- whitespace and patch integrity checked with `git diff --check`

## Rollout

1. Configure the GitHub `production` environment.
2. Merge this pull request into `main` after CI succeeds.
3. Confirm `Deploy Production` completes for the merge commit.
4. Verify `${PRODUCTION_URL}/api/health` and a critical customer flow.

## Rollback

Revert this pull request to restore the previous SSM workflow. Restoring that
workflow also requires a valid SSM-managed EC2 instance and corrected
`EC2_INSTANCE_ID` value.
