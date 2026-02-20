# EC2 Deploy Automation (GitHub Actions + SSH)

This adds automated deploys for the existing EC2 layout:

- Backend service: `postcatering-api` (systemd)
- Frontend publish path: `/var/www/postcatering`
- Repo path on server: `/home/ubuntu/PostCatering`

## New Files

- `.github/workflows/deploy-ec2.yml`
- `ops/deploy-ec2.sh`

## One-Time EC2 Prep

Run on the EC2 instance:

```bash
cd /home/ubuntu/PostCatering
chmod +x ops/deploy-ec2.sh
```

Ensure the SSH login user can run:

- `sudo systemctl restart postcatering-api`
- `sudo systemctl reload nginx`
- `sudo cp` and `sudo rm` under `/var/www/postcatering`

## Required GitHub Secrets

Repository Settings -> Secrets and variables -> Actions:

- `EC2_SSH_HOST`: public DNS or IP of the EC2 instance
- `EC2_SSH_USER`: usually `ubuntu`
- `EC2_SSH_PRIVATE_KEY`: private key contents (OpenSSH format)

Optional overrides:

- `EC2_DEPLOY_PATH` (default: `/home/ubuntu/PostCatering`)
- `EC2_API_SERVICE` (default: `postcatering-api`)
- `EC2_HEALTH_URL` (default: `http://127.0.0.1/api/health`)

## Workflow Behavior

- Triggers automatically on push to `main`
- Can also be run manually via `workflow_dispatch`
- Uploads `ops/deploy-ec2.sh` to EC2 and executes it remotely
- Deploy script:
  - pulls latest `main` with fast-forward only
  - installs backend deps in `api/venv`
  - builds frontend with `npm ci && npm run build`
  - publishes `client/dist` to `/var/www/postcatering`
  - restarts API service and reloads Nginx
  - validates `/api/health`

## Rollback

Recommended rollback path:

1. Revert the bad commit in GitHub.
2. Merge the revert to `main`.
3. Re-run the `Deploy EC2` workflow.

This keeps server state aligned with source control.
