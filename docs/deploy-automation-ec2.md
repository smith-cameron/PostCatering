# EC2 Deploy Automation (GitHub Actions + AWS Systems Manager)

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

The instance must be an SSM managed node. Attach an instance profile containing
`AmazonSSMManagedInstanceCore`, which is already required for Session Manager.

## One-Time AWS OIDC Role

Create an IAM OIDC provider for `https://token.actions.githubusercontent.com`
with audience `sts.amazonaws.com`, then create a role such as
`postcatering-github-deploy`. Its trust policy must be limited to this repository
and the `main` branch:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:smith-cameron/PostCatering:ref:refs/heads/main"
      }
    }
  }]
}
```

Attach this least-privilege policy, replacing the instance ID if it differs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:us-east-1::document/AWS-RunShellScript",
        "arn:aws:ec2:us-east-1:135053047681:instance/<INSTANCE_ID>"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

`SendCommand` is root-level access on the target, so do not broaden this role to
other repositories, branches, documents, or instances.

## Required GitHub Configuration

Repository Settings -> Secrets and variables -> Actions:

- Secret `AWS_DEPLOY_ROLE_ARN`: ARN of `postcatering-github-deploy`.
- Variable `AWS_REGION`: the instance region (currently `us-east-1`).
- Variable `EC2_INSTANCE_ID`: the production instance ID (`i-...`).

The EC2 clone still needs its read-only GitHub deploy key at
`/home/ubuntu/.ssh/postcatering_github` so it can pull source code. This differs
from the owner SSH recovery `.pem`; never store the owner key in GitHub.

## Workflow Behavior

- Triggers automatically only after the `CI` workflow for a `main` commit completes
  successfully (and can also be run manually).
- Manual runs are restricted to the `main` branch.
- Checks out and deploys the exact commit SHA tested by CI. A later commit that has
  not passed CI cannot be pulled accidentally by an earlier deployment.
- Can also be run manually via `workflow_dispatch`
- Uses GitHub OIDC to invoke `AWS-RunShellScript` through Systems Manager; SSH is
  not used by the deployment path.
- Deploy script:
  - pulls latest `main` with fast-forward only
  - installs backend deps in `api/venv`
  - loads API env from `/etc/postcatering/api.env`, the systemd `EnvironmentFile`, or `api/.env`, then runs `python scripts/menu_admin_sync.py --apply-schema --no-seed`
  - builds frontend with `npm ci && npm run build`
  - publishes `client/dist` to `/var/www/postcatering`
  - restarts API service and reloads Nginx
  - validates `/api/health`

If your service uses a non-default env path, set `EC2_API_ENV_FILE` or keep the systemd `EnvironmentFile` current.

## Rollback

Recommended rollback path:

1. Revert the bad commit in GitHub.
2. Merge the revert to `main`.
3. Re-run the `Deploy EC2` workflow.

This keeps server state aligned with source control.

## Production Access and GitHub Hardening

- In GitHub, protect `main`: require the CI status checks, require pull requests,
  and restrict who can merge.
- Attach `AmazonSSMManagedInstanceCore` to the EC2 instance role and prefer Session
  Manager for maintenance. Keep port 22 closed or restricted to approved human
  administrators; GitHub deployment does not need it.
- If the site is private on GitHub, give the EC2 clone a read-only deploy key (or a
  fine-grained, read-only token) that belongs only to this repository.

## Ongoing Maintenance

- Normal code release: merge a reviewed pull request into `main`, confirm CI and
  `Deploy EC2` both succeed, then check `https://<domain>/api/health` and the key
  customer path (open the site and submit a test inquiry if appropriate).
- Investigate a failed release with `journalctl -u postcatering-api -n 200
  --no-pager`, `sudo nginx -t`, and `/var/log/nginx/error.log`. Do not edit tracked
  application files directly on the server; fix, test, and merge the change.
- Before database/schema changes or server maintenance, take an encrypted MySQL
  dump and an EBS snapshot. Configure a backup retention/lifecycle policy and test
  a restore before relying on it.
- Monthly: apply Ubuntu security updates in a planned window, review EC2/EBS/IPv4
  charges and CloudWatch alarms, review IAM access, and confirm certificate renewal
  with `sudo certbot renew --dry-run`.
