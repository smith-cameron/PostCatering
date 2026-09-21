# AWS EC2 Deployment Runbook (Flask API + Vite Client + MySQL)

This runbook deploys the current repository structure:

- `api/` (Flask backend)
- `client/` (Vite React frontend)

It is written for a single Ubuntu EC2 instance running:

- Flask via Gunicorn + systemd
- Nginx for static hosting and API proxy
- MySQL on the same instance

Commands use source/target placeholders so the same procedure works for a
staging-to-production cutover, a production host replacement, or an account
migration. Resolve and record those values before starting a deployment.

## 1) Local Preflight

### Backend

```bash
cd api
python -m venv venv
# Windows PowerShell: .\venv\Scripts\Activate.ps1
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m unittest discover -s tests -v
# From repo root, equivalent command:
# python -m unittest discover -s api/tests -v
deactivate
```

### Frontend

```bash
cd client
npm ci
npm run build
```

### Pipenv note

This repo currently uses `api/requirements.txt` and has no `Pipfile`.
If you use Pipenv in another workflow, prefer:

```bash
pipenv requirements > requirements.txt
```

## 2) Launch EC2

Use the intended target AWS Region unless there is a deliberate reason to
change it. Record the selected Region and use it consistently for
EC2, Systems Manager, IAM policies, and GitHub deployment configuration.

Use `Ubuntu Server 24.04 LTS` (x86_64). Keep the production instance in the
AWS account designated for long-term production ownership.

1. EC2 -> Launch instance
2. AMI: `Ubuntu Server 24.04 LTS`
3. Instance type: start with `t3a.small` where available (or `t3.small` to match
   development): both provide 2 GiB RAM. Do not assume `t3.micro` will be stable:
   this single host runs MySQL, Gunicorn, Nginx, and an on-host Node build.
4. Storage: `gp3`, 20+ GB
5. IAM role: attach `AmazonSSMManagedInstanceCore`
6. Metadata options: set IMDSv2 to required
7. Security group inbound:
- TCP 80 from `0.0.0.0/0`
- TCP 443 from `0.0.0.0/0`
- TCP 22 from your IP only (or skip SSH and use Session Manager)
- Do not open TCP 3306

For Session Manager, the instance also needs outbound HTTPS access. A public
subnet with normal outbound internet access is sufficient; a private subnet
needs the appropriate Systems Manager VPC endpoints instead.

Cost/security notes:

- Public IPv4 addresses are billable
- Use an Elastic IP only if the instance needs a stable IP for DNS; it does not
  avoid the public-IPv4 charge. A single Nginx EC2 host avoids the extra cost of an
  Application Load Balancer while traffic is small.
- Use `gp3` and configure EBS snapshot retention; do not delete the only database
  volume before verifying a backup restore.
- EC2 free tier eligibility changed on July 15, 2025
- Keep SSH restricted, or use Session Manager only

## 3) Connect

Preferred:

- EC2 Console -> Instance -> Connect -> Session Manager

SSH alternative:

```bash
export SOURCE_HOST=ubuntu@source-instance.example
export SOURCE_KEY=/path/to/source-instance.pem
export TARGET_HOST=ubuntu@target-instance.example
export TARGET_KEY=/path/to/target-instance.pem

chmod 400 "$SOURCE_KEY" "$TARGET_KEY"
ssh -i "$SOURCE_KEY" "$SOURCE_HOST"
ssh -i "$TARGET_KEY" "$TARGET_HOST"
```

Keep key files private and never add them to this repository. Session Manager
is preferred when it is available.

## 4) Install Server Packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3-venv python3-pip nginx git mysql-server curl
```

Install the Node.js version required by `client/package.json` (currently Node
24):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 5) MySQL Setup

```bash
sudo systemctl enable --now mysql
sudo mysql_secure_installation
```

Create DB and least-privilege app user:

```bash
sudo mysql <<'SQL'
CREATE DATABASE post_catering CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'postcatering_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON post_catering.* TO 'postcatering_app'@'localhost';
FLUSH PRIVILEGES;
SQL
```

## 6) Optional Data Import (Dev Snapshot)

Use this when you want staging to look like local/dev (sample inquiries, menu state, media metadata).

Important:
- A DB dump does **not** include media files in `api/flask_api/static/slides`.
- On Windows PowerShell, avoid `>` redirection for `mysqldump`; use `--result-file` to prevent encoding-related import failures.

### 6.1 Export DB on source machine

macOS/Linux:

```bash
mysqldump -u <source_db_user> -p \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --default-character-set=utf8mb4 \
  post_catering > post_catering.sql
```

Windows PowerShell:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" `
  -u <source_db_user> -p `
  --single-transaction `
  --routines `
  --triggers `
  --events `
  --default-character-set=utf8mb4 `
  --result-file="C:\path\to\post_catering.sql" `
  post_catering
```

Use the source environment account named by `DB_USER` in the deployed API
environment file; do not assume it is `root`. If that account lacks
the privileges needed for routines or events and the server uses Ubuntu's
socket-authenticated MySQL root account, run the export on the source server as
`sudo mysqldump --single-transaction --routines --triggers --events --default-character-set=utf8mb4 post_catering > post_catering.sql`.

### 6.2 Upload DB dump and media to EC2

Set the source and target connection values on your local machine:

```bash
export SOURCE_HOST=ubuntu@source-instance.example
export SOURCE_KEY=/path/to/source-instance.pem
export TARGET_HOST=ubuntu@target-instance.example
export TARGET_KEY=/path/to/target-instance.pem
export SOURCE_APP_DIR=/home/ubuntu/PostCatering

mkdir -p current-production-slides
scp -i "$SOURCE_KEY" -r \
  "$SOURCE_HOST:$SOURCE_APP_DIR/api/flask_api/static/slides/." \
  current-production-slides/
```

Copy the database dump from the source instance to the same local directory:

```bash
scp -i "$SOURCE_KEY" \
  "$SOURCE_HOST:/home/ubuntu/pre_cutover.sql" \
  pre_cutover.sql
```

Then upload the dump and downloaded media directory to the target instance:

```bash
scp -i "$TARGET_KEY" pre_cutover.sql \
  "$TARGET_HOST:/home/ubuntu/"
scp -i "$TARGET_KEY" -r current-production-slides/. \
  "$TARGET_HOST:/home/ubuntu/slides/"
```

### 6.3 Import DB on EC2

```bash
sudo mysql <<'SQL'
DROP DATABASE IF EXISTS post_catering;
CREATE DATABASE post_catering CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'postcatering_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
ALTER USER 'postcatering_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON post_catering.* TO 'postcatering_app'@'localhost';
FLUSH PRIVILEGES;
SQL

sudo mysql post_catering < /home/ubuntu/post_catering.sql
```

### 6.4 After repo clone, place media in app path

```bash
mkdir -p /home/ubuntu/PostCatering/api/flask_api/static/slides
cp -a /home/ubuntu/slides/. /home/ubuntu/PostCatering/api/flask_api/static/slides/
```

## 7) Clone Repo + Backend Install

```bash
cd /home/ubuntu
git clone https://github.com/yourUser/yourRepo.git PostCatering
cd /home/ubuntu/PostCatering/api

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt gunicorn cryptography
deactivate
```

Private repo note:
- If HTTPS clone prompts for credentials, authenticate first (`gh auth login`) or use an SSH remote (`git@github.com:...`) with a configured key.

If this is a fresh DB (not imported from step 6), initialize schema + seed:

```bash
cd /home/ubuntu/PostCatering/api
source venv/bin/activate
python scripts/menu_admin_sync.py --apply-schema --reset
deactivate
```

## 8) Production Environment File

```bash
sudo install -d -m 750 /etc/postcatering
sudo install -m 640 -o root -g ubuntu /dev/null /etc/postcatering/api.env
sudo nano /etc/postcatering/api.env
```

Use values that match `api/.env.example`:

```bash
FLASK_ENV=production
FLASK_DEBUG=false
FLASK_SECRET_KEY=replace-with-random-secret
SESSION_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=true
LOG_LEVEL=INFO

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=postcatering_app
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_NAME=post_catering

CORS_ALLOW_ORIGIN=https://your-domain.com
MENU_ADMIN_TOKEN=replace-with-strong-admin-token

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-smtp-app-password
SMTP_USE_TLS=true
INQUIRY_TO_EMAIL=owner@example.com
INQUIRY_FROM_EMAIL=your-email@example.com
INQUIRY_REPLY_TO_EMAIL=owner@example.com
INQUIRY_CONFIRMATION_ENABLED=true

INQUIRY_RATE_LIMIT_PER_IP_PER_MINUTE=3
INQUIRY_RATE_LIMIT_PER_IP_PER_HOUR=12
INQUIRY_DUPLICATE_WINDOW_SECONDS=900
INQUIRY_MAX_LINKS=2
INQUIRY_BLOCKED_EMAIL_DOMAINS=mailinator.com,tempmail.com,10minutemail.com,guerrillamail.com,yopmail.com
INQUIRY_ALLOWED_EMAIL_DOMAINS=
INQUIRY_REQUIRE_EMAIL_DOMAIN_DNS=false
INQUIRY_ABUSE_ALERT_THRESHOLD_PER_MINUTE=10
INQUIRY_ABUSE_ALERT_WINDOW_SECONDS=60
INQUIRY_INTEGRITY_FIELD=company_website
```

For pre-domain staging, set `CORS_ALLOW_ORIGIN` to the exact URL you are serving (EC2 DNS or IP), for example:
- `http://target-instance.example`
- `http://TARGET_PUBLIC_IP`

## 9) Gunicorn systemd Service

```bash
sudo tee /etc/systemd/system/postcatering-api.service > /dev/null <<'EOF'
[Unit]
Description=PostCatering Flask API (Gunicorn)
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/PostCatering/api
EnvironmentFile=/etc/postcatering/api.env
ExecStart=/home/ubuntu/PostCatering/api/venv/bin/gunicorn \
  --workers 2 \
  --threads 2 \
  --bind 127.0.0.1:5000 \
  --access-logfile - \
  --error-logfile - \
  server:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now postcatering-api
sudo systemctl status postcatering-api --no-pager
```

## 10) Frontend Build + Publish

```bash
cd /home/ubuntu/PostCatering/client
npm ci
npm run build

sudo mkdir -p /var/www/postcatering
sudo rm -rf /var/www/postcatering/*
sudo cp -a dist/. /var/www/postcatering/
```

## 11) Nginx Config

For domain-backed deploys, set `server_name` to your domain(s).
For IP/DNS staging, use `server_name _;`.

```bash
sudo tee /etc/nginx/sites-available/postcatering > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/postcatering;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Admin media uploads can include large photos and videos. 0 disables the
    # Nginx request-body size limit; the long timeouts avoid failed uploads on
    # slower connections.
    client_max_body_size 0;
    client_body_timeout 10m;
    proxy_send_timeout 10m;
    proxy_read_timeout 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

```bash
sudo ln -s /etc/nginx/sites-available/postcatering /etc/nginx/sites-enabled/postcatering
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 12) TLS (HTTPS)

Skip this for temporary staging environments.
Run this only when DNS already points to this instance and you are ready for production-style HTTPS.

Point DNS first, then issue cert:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 13) Verify

```bash
curl -f http://127.0.0.1/api/health
curl -f http://your-domain-or-ec2-dns/api/health
# If TLS is enabled:
curl -f https://your-domain.com/api/health
```

Open:

- `http://your-domain-or-ec2-dns/`
- `http://your-domain-or-ec2-dns/api/health`
- If TLS is enabled: `https://your-domain.com/`

## 14) Standard Update Procedure

```bash
cd /home/ubuntu/PostCatering
git pull

cd api
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart postcatering-api

cd ../client
npm ci
npm run build
sudo rm -rf /var/www/postcatering/*
sudo cp -a dist/. /var/www/postcatering/

sudo systemctl reload nginx
```

## 15) Troubleshooting

```bash
sudo systemctl status postcatering-api --no-pager
journalctl -u postcatering-api -n 200 --no-pager
sudo nginx -t
sudo tail -n 200 /var/log/nginx/error.log
sudo tail -n 200 /var/log/nginx/access.log
sudo ss -ltnp | grep :5000
```

Common runtime issue:

```bash
# If API logs show:
# RuntimeError: 'cryptography' package is required for sha256_password or caching_sha2_password auth methods
cd /home/ubuntu/PostCatering/api
source venv/bin/activate
pip install cryptography
deactivate
sudo systemctl restart postcatering-api
```

IMDSv2 public IP lookup from instance:

```bash
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4
```

## 16) Source Environment -> Target Production Handoff Plan

Use this sequence whenever production ownership moves between accounts,
instances, or environments. Do not decommission the source until the target is
validated and the rollback window has closed.

For launch-day execution details, use:

- `docs/pre-cutover-checklist.md`
- `docs/cutover-command-sheet.md`

1. Build the target environment baseline first:
- VPC/subnet/security groups
- IAM role for EC2 + SSM
- EC2 instance + EBS volume
- DNS and TLS certificates in the target account

2. Deploy the application in the target environment with this same runbook.

3. Migrate database:
- Export from staging (`mysqldump`)
- Import into the target database
- Validate row counts and critical endpoints

4. Cut over DNS:
- Lower DNS TTL in advance
- Switch A/AAAA records to the target instance or load balancer
- Verify HTTPS and `/api/health`

5. Rotate secrets after cutover:
- DB user password
- `FLASK_SECRET_KEY`
- `MENU_ADMIN_TOKEN`
- SMTP credentials

6. Decommission the source environment after validation:
- Stop/remove EC2
- Remove EBS snapshots with sensitive data
- Delete old keys/secrets

Account-bound resource reminder:

- ACM certificates are account and region scoped (not transferable)
- Route53 hosted zones live in one account at a time
- IAM roles/policies are account scoped

## References

- EC2 free tier usage update:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
- Public IPv4 pricing:
  - https://aws.amazon.com/en/vpc/pricing/
- Session Manager:
  - https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html
- IMDSv2:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-new-instances.html
- Vite 7 requirements:
  - https://vite.dev/blog/announcing-vite7
- Pipenv commands/changelog:
  - https://pipenv.pypa.io/en/latest/commands.html
  - https://pipenv.pypa.io/en/latest/changelog.html
