# Production Cutover Checklist (Launch Day)

Use this checklist when moving production from a source environment to a
target environment. The environments may be in different accounts, Regions,
or hosting arrangements.
Target production domain: `your-production-domain.com`

## 1) 24-48 Hours Before Cutover

- Confirm the target infrastructure is ready (VPC, subnet, SG, EC2, IAM role, DNS zone).
- Confirm deployment has already been tested in the target environment with the same commit SHA you plan to release.
- Lower DNS TTL on records that will move (for example to 60-300 seconds).
- Export a fresh staging DB backup and store an encrypted copy.
- Freeze non-critical schema changes and content edits until cutover completes.
- Prepare rollback target (old endpoint/IP and previous DB backup timestamp).

## 2) Pre-Cutover Validation (Target Environment)

- Confirm `postcatering-api` service is healthy: `systemctl status postcatering-api --no-pager`.
- Confirm Nginx config test passes: `sudo nginx -t`.
- Confirm health endpoint responds: `curl -f http://127.0.0.1/api/health`.
- Confirm HTTPS certificate is valid and attached to the correct domain.
- Confirm environment file has production values (DB, SMTP, `MENU_ADMIN_TOKEN`, CORS origin).
- Confirm MySQL is not publicly exposed (no inbound port 3306 in SG).

## 3) Data Migration Window

- Announce brief write freeze window for inquiry submissions and admin menu changes.
- Take final source backup:
  - Use the source environment account named by `DB_USER` in its deployed API environment file, or `sudo mysqldump` for Ubuntu socket-authenticated MySQL root:
    `mysqldump -u <user> -p --single-transaction --routines --triggers --events --default-character-set=utf8mb4 post_catering > final_cutover.sql`
- Make a final copy of `<source-app-path>/api/flask_api/static/slides/`; uploaded media is stored on the source host and is not included in the database dump.
- Import the final backup into the target database.
- Run quick integrity checks:
  - Table row counts for `menu_config`, `menu_items`, `slides`, `inquiries`
  - Spot-check latest records and expected IDs

## 4) DNS Cutover

- Update DNS `A`/`AAAA` records to the target endpoint.
- Verify propagation from at least two external resolvers.
- Validate:
  - `https://your-production-domain.com/`
  - `https://your-production-domain.com/api/health`
  - One real frontend inquiry submission path end-to-end

## 5) Immediate Post-Cutover

- Monitor first 30-60 minutes:
  - `journalctl -u postcatering-api -n 200 --no-pager`
  - `sudo tail -n 200 /var/log/nginx/error.log`
- Confirm SMTP notifications and confirmation emails are sending.
- Confirm no spike in 4xx/5xx for `/api/*`.
- Re-enable normal write operations.

## 6) Security Rotation (Same Day)

- Rotate DB user password.
- Rotate `FLASK_SECRET_KEY`.
- Rotate `MENU_ADMIN_TOKEN`.
- Rotate SMTP credentials/app password.
- Invalidate old keys and secrets in the source environment.

## 7) Rollback Triggers

Rollback if any of these persist beyond the agreed threshold:

- `api/health` intermittently fails or stays non-200.
- Critical user path (open site, load menu, submit inquiry) is broken.
- TLS certificate or domain routing is incorrect.
- Database mismatch causes data loss or incorrect menus/slides.

Rollback steps:

- Point DNS back to prior target.
- Restore pre-cutover DB backup if writes occurred in failed window.
- Keep the target infrastructure running for investigation.

## 8) Decommission Source Environment Resources

- Stop and terminate source compute resources only after the rollback window closes.
- Delete attached EBS volumes/snapshots that contain sensitive app data.
- Remove old SG rules and unused Elastic IPs/public IPv4 resources.
- Delete old certificates, keys, and secrets no longer needed.
- Record final cutover completion timestamp and new production endpoint details.
