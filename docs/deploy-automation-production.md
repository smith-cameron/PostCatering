# Production Deploy Automation (GitHub Actions + SSH)

The `Deploy Production` workflow updates the configured production host after
the `CI` workflow succeeds for a commit on `main`. It supports the existing
single-server Ubuntu layout on EC2 or another VPS provider:

- Backend service: `postcatering-api` (systemd)
- Frontend publish path: `/var/www/postcatering`
- Default repository path: `/home/ubuntu/PostCatering`

## One-Time Production Host Setup

The production host must contain a clone of this repository and a deployment
user that can:

- read the repository through its own read-only GitHub deploy key
- run the deployment script and create the Python virtual environment
- use `sudo` for frontend publishing and service management

Prepare the existing script once:

```bash
cd /home/ubuntu/PostCatering
chmod +x ops/deploy-ec2.sh
```

The script retains its historical EC2 filename, but it is provider-neutral and
can run on any compatible Ubuntu production host.

## GitHub Production Environment

Create a GitHub Actions environment named `production`. Configure environment
protection rules appropriate for the repository, then add these required values.

Variables:

- `PRODUCTION_SSH_HOST`: production hostname or IP address
- `PRODUCTION_SSH_USER`: restricted deployment user
- `PRODUCTION_URL`: public origin, for example `https://your-production-domain.com`

Secrets:

- `PRODUCTION_SSH_PRIVATE_KEY`: private key dedicated to GitHub deployments
- `PRODUCTION_SSH_KNOWN_HOSTS`: pinned `known_hosts` entry for the production host

Generate the host-key value from a trusted administrator workstation and verify
the fingerprint out of band before storing it:

```bash
ssh-keyscan -H your-production-host
```

Do not run `ssh-keyscan` inside the deployment workflow. Pinning the reviewed
host key prevents a network attacker from silently replacing the production
host during a deployment.

Optional variables override the deployment defaults:

- `PRODUCTION_DEPLOY_PATH` (default `/home/ubuntu/PostCatering`)
- `PRODUCTION_API_SERVICE` (default `postcatering-api`)
- `PRODUCTION_HEALTH_URL` (default `http://127.0.0.1/api/health`)
- `PRODUCTION_API_ENV_FILE` (default `/etc/postcatering/api.env`)
- `PRODUCTION_DB_MIGRATION_ARGS` (default `--apply-schema --no-seed`)

The old AWS-specific values `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, and
`EC2_INSTANCE_ID` are no longer used by this workflow. Remove them after the new
production deployment succeeds if no other automation requires them.

## Workflow Behavior

- Runs automatically only after `CI` succeeds for a `main` commit.
- Allows a manual run only from `main`.
- Checks out and deploys the exact commit SHA tested by CI.
- Uses the GitHub `production` environment and links it to `PRODUCTION_URL`.
- Copies the reviewed deployment script to the host over SSH.
- Fetches the tested commit, builds the frontend, syncs the database schema,
  restarts the API service, reloads Nginx, and validates health.
- Verifies the public `/api/health` endpoint configured by `PRODUCTION_URL`.

## Rollback

1. Revert the bad commit in GitHub.
2. Merge the revert to `main`.
3. Confirm `CI` and `Deploy Production` complete successfully.
4. Verify the public health endpoint and critical customer paths.

This keeps production state aligned with reviewed source control.

## Ongoing Maintenance

- For a normal release, merge a reviewed pull request into `main`, confirm `CI`
  and `Deploy Production`, then verify the public health endpoint and a critical
  customer path.
- Investigate failures with `journalctl -u postcatering-api -n 200 --no-pager`,
  `sudo nginx -t`, and `/var/log/nginx/error.log`.
- Do not edit tracked application files directly on the server. Fix, test, and
  merge changes through GitHub.
- Take an encrypted database backup and provider snapshot before schema changes
  or server maintenance, and test restoration periodically.
