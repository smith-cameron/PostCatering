# Namecheap VPS Production Deployment Runbook

This runbook adapts the current single-server deployment model to a Namecheap VPS.
It is intended for a production migration to `your-production-domain.com` after the remaining updates have been shipped to the current EC2 staging environment.

Current app shape:

- `client/`: React + Vite frontend
- `api/`: Flask backend
- Nginx serving the frontend and proxying `/api`
- MySQL running on the same server

## Recommendation

Recommended Namecheap plan for this app:

- `Pulsar`
- `2 CPU`
- `2 GB RAM`
- `40 GB SSD RAID 10`

Recommended provisioning choices:

- `Ubuntu 24.04`
- `User-Responsible` management
- No `cPanel`
- No `Webuzo` unless you specifically want a control panel

Why this is the best fit:

- It is the closest match to the current repo runbook, which targets a small single-box Ubuntu deployment.
- It provides enough headroom for `Nginx + Gunicorn + Flask + MySQL` without jumping to a much higher monthly price.
- The lower `Spark` tier is too tight for this stack.
- `Quasar` and above are only worth it if you want more headroom or if you intentionally want Namecheap's managed options, which require a different OS/control-panel path than this repo currently uses.

## Migration Timing

Do not migrate yet if staging still has updates pending.

Recommended order:

1. Finish the remaining updates on the current EC2 staging deployment.
2. Verify the exact commit SHA you want to promote.
3. Freeze non-critical content and admin changes.
4. Build the Namecheap production server using that same commit SHA.
5. Perform final DB/media sync from EC2.
6. Cut over DNS to `your-production-domain.com`.

## 1) Provision The VPS

During checkout and provisioning:

- Select `Pulsar`
- Select `Ubuntu 24.04`
- Choose the unmanaged or `User-Responsible` option
- Make sure the plan includes the dedicated IPv4 address

After the VPS is created:

- Record the server IP address
- Record the initial root access details from Namecheap
- Create a non-root sudo user for ongoing administration
- Restrict SSH to key-based auth as soon as practical

Suggested first-pass Ubuntu hardening:

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Optional but recommended:

- Disable root SSH login after confirming the sudo user works
- Disable password authentication after confirming key-based login works
- Configure a basic firewall with only `22`, `80`, and `443` open

## 2) Install Base Packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3-venv python3-pip nginx git mysql-server curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
python3 --version
node -v
npm -v
mysql --version
nginx -v
```

## 3) Create The Database

```bash
sudo systemctl enable --now mysql
sudo mysql_secure_installation
```

Create the production DB and least-privilege user:

```bash
sudo mysql <<'SQL'
CREATE DATABASE post_catering CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'postcatering_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON post_catering.* TO 'postcatering_app'@'localhost';
FLUSH PRIVILEGES;
SQL
```

## 4) Clone The Repo

```bash
cd /home/deploy
git clone https://github.com/yourUser/yourRepo.git PostCatering
cd /home/deploy/PostCatering/api
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn cryptography
deactivate
```

If the repository remains private, use the same auth approach you trust today for EC2.

## 5) Import The Current Staging Data

Use the current EC2 deployment as the source of truth until cutover.

From the EC2 source host, create a final backup:

```bash
mysqldump -u postcatering_app -p --single-transaction --routines --triggers post_catering > final_cutover.sql
gzip -f final_cutover.sql
```

Copy it to the Namecheap VPS and import it:

```bash
scp final_cutover.sql.gz deploy@YOUR_NAMECHEAP_IP:/home/deploy/
ssh deploy@YOUR_NAMECHEAP_IP
gunzip -c /home/deploy/final_cutover.sql.gz | mysql -u postcatering_app -p post_catering
```

If the current environment has slide/media assets that are not stored in the DB, copy those too:

```bash
scp -r /path/to/slides deploy@YOUR_NAMECHEAP_IP:/home/deploy/
mkdir -p /home/deploy/PostCatering/api/flask_api/static/slides
cp -a /home/deploy/slides/. /home/deploy/PostCatering/api/flask_api/static/slides/
```

## 6) Create The Production Environment File

```bash
sudo install -d -m 750 /etc/postcatering
sudo install -m 640 -o root -g deploy /dev/null /etc/postcatering/api.env
sudo nano /etc/postcatering/api.env
```

Minimum production values:

```bash
FLASK_ENV=production
FLASK_DEBUG=false
FLASK_SECRET_KEY=replace-with-random-secret
LOG_LEVEL=INFO

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=postcatering_app
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_NAME=post_catering

CORS_ALLOW_ORIGIN=https://your-production-domain.com
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
```

Make sure the final values reflect real production credentials before cutover.

## 7) Configure The API Service

```bash
sudo tee /etc/systemd/system/postcatering-api.service > /dev/null <<'EOF'
[Unit]
Description=PostCatering Flask API (Gunicorn)
After=network.target

[Service]
User=deploy
Group=www-data
WorkingDirectory=/home/deploy/PostCatering/api
EnvironmentFile=/etc/postcatering/api.env
ExecStart=/home/deploy/PostCatering/api/venv/bin/gunicorn \
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

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now postcatering-api
sudo systemctl status postcatering-api --no-pager
```

## 8) Build And Publish The Frontend

```bash
cd /home/deploy/PostCatering/client
npm ci
npm run build
sudo mkdir -p /var/www/postcatering
sudo rm -rf /var/www/postcatering/*
sudo cp -a dist/. /var/www/postcatering/
```

If memory gets tight during the frontend build, add a small swap file before retrying.

## 9) Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/postcatering > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-production-domain.com www.your-production-domain.com;

    root /var/www/postcatering;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

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

Enable and validate:

```bash
sudo ln -s /etc/nginx/sites-available/postcatering /etc/nginx/sites-enabled/postcatering
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 10) Pre-Cutover Verification

Before changing DNS, verify the app directly by IP or temporary host mapping:

```bash
curl -f http://127.0.0.1/api/health
curl -H "Host: your-production-domain.com" http://YOUR_NAMECHEAP_IP/api/health
```

Manual checks:

- Open the homepage
- Confirm menus load
- Confirm admin login works
- Submit one real inquiry test
- Confirm SMTP messages are delivered correctly

## 11) DNS Cutover For `your-production-domain.com`

After the new server is verified:

1. Lower DNS TTL in advance if you have not already done so.
2. Update the root `A` record for `your-production-domain.com` to the Namecheap VPS IP.
3. Update the `www` `A` record to the same IP, or point `www` with a `CNAME` to the root if your DNS setup allows it.
4. Wait for propagation to begin.

Once the domain resolves to the new VPS, issue TLS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-production-domain.com -d www.your-production-domain.com
```

Then verify:

```bash
curl -I https://your-production-domain.com/
curl -f https://your-production-domain.com/api/health
```

## 12) Post-Cutover Tasks

- Monitor `journalctl -u postcatering-api -n 200 --no-pager`
- Monitor `sudo tail -n 200 /var/log/nginx/error.log`
- Confirm no spike in failed API requests
- Confirm SMTP notifications and confirmations are sending
- Re-enable normal admin/content activity

Rotate sensitive values the same day:

- DB password
- `FLASK_SECRET_KEY`
- `MENU_ADMIN_TOKEN`
- SMTP credentials or app password

## 13) Rollback Plan

Rollback triggers:

- `/api/health` fails repeatedly
- Menu or inquiry flows break
- TLS does not issue cleanly
- The imported DB state is wrong

Rollback path:

1. Point DNS back to the current EC2 target.
2. Restore the pre-cutover DB backup if writes occurred on the new VPS during the failed window.
3. Keep the Namecheap server running for investigation instead of tearing it down immediately.

## Notes Compared To AWS EC2

Expected differences from the current AWS docs:

- No IAM or Session Manager equivalent is assumed here.
- SSH hardening matters more because access is direct.
- The current GitHub Actions EC2 deploy workflow is not plug-and-play for Namecheap and should be updated separately if you move production there.
- Namecheap managed VPS options are not a good match for this repo's current Ubuntu-based runbook because their managed tiers depend on a different OS/control-panel path.
