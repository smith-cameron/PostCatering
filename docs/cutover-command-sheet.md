# Production Cutover Command Sheet

Command-focused checklist for launch day.
Target production domain: `your-production-domain.com`

## 0) Fill These Variables

```bash
# Current source environment
export SRC_HOST=ubuntu@SOURCE_PUBLIC_DNS
export SRC_KEY=~/keys/source.pem
export SRC_APP_DIR=/home/ubuntu/PostCatering

# Replacement target environment
export DST_HOST=ubuntu@TARGET_PUBLIC_DNS
export DST_KEY=~/keys/target.pem
export DST_APP_DIR=/home/ubuntu/PostCatering

# Database
export DB_NAME=post_catering
export DB_USER=postcatering_app
export DB_PASS='CHANGE_ME_STRONG_PASSWORD'

# Domain verification
export DOMAIN=your-production-domain.com
```

## 1) Final Backup From Source

```bash
ssh -i "$SRC_KEY" "$SRC_HOST" "mysqldump -u \"$DB_USER\" -p\"$DB_PASS\" --single-transaction --routines --triggers \"$DB_NAME\" > /home/ubuntu/final_cutover.sql"
ssh -i "$SRC_KEY" "$SRC_HOST" "gzip -f /home/ubuntu/final_cutover.sql"
ssh -i "$SRC_KEY" "$SRC_HOST" "sha256sum /home/ubuntu/final_cutover.sql.gz"
```

## 2) Copy Backup And Uploaded Media Through Local

```bash
scp -i "$SRC_KEY" "$SRC_HOST:/home/ubuntu/final_cutover.sql.gz" .
sha256sum final_cutover.sql.gz
scp -i "$DST_KEY" ./final_cutover.sql.gz "$DST_HOST:/home/ubuntu/"

mkdir -p final_cutover_slides
scp -i "$SRC_KEY" -r "$SRC_HOST:$SRC_APP_DIR/api/flask_api/static/slides/." final_cutover_slides/
scp -i "$DST_KEY" -r final_cutover_slides/. "$DST_HOST:/home/ubuntu/slides/"
```

## 3) Import Backup And Media Into Target Environment

```bash
ssh -i "$DST_KEY" "$DST_HOST" "gunzip -c /home/ubuntu/final_cutover.sql.gz | mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\""
ssh -i "$DST_KEY" "$DST_HOST" "mkdir -p \"$DST_APP_DIR/api/flask_api/static/slides\" && cp -a /home/ubuntu/slides/. \"$DST_APP_DIR/api/flask_api/static/slides/\""
```

## 4) Quick Data Integrity Checks

```bash
ssh -i "$DST_KEY" "$DST_HOST" "mysql -u \"$DB_USER\" -p\"$DB_PASS\" -D \"$DB_NAME\" -e \"SELECT 'menu_items' AS table_name, COUNT(*) AS row_count FROM menu_items UNION ALL SELECT 'slides', COUNT(*) FROM slides UNION ALL SELECT 'inquiries', COUNT(*) FROM inquiries UNION ALL SELECT 'menu_config', COUNT(*) FROM menu_config;\""
```

## 5) Restart App Services On Target

```bash
ssh -i "$DST_KEY" "$DST_HOST" "sudo systemctl restart postcatering-api && sudo systemctl reload nginx"
ssh -i "$DST_KEY" "$DST_HOST" "sudo systemctl status postcatering-api --no-pager"
ssh -i "$DST_KEY" "$DST_HOST" "curl -f http://127.0.0.1/api/health"
```

## 6) DNS Cutover (Route53 Example)

Create `route53-cutover.json`:

```json
{
  "Comment": "Cutover to target production environment",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "your-production-domain.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{ "Value": "TARGET_PUBLIC_IP" }]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.your-production-domain.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{ "Value": "TARGET_PUBLIC_IP" }]
      }
    }
  ]
}
```

Apply:

```bash
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch file://route53-cutover.json
```

## 7) External Verification

```bash
curl -I "https://$DOMAIN/"
curl -f "https://$DOMAIN/api/health"
dig +short "$DOMAIN"
dig +short "www.$DOMAIN"
```

## 8) Live Monitoring (First Hour)

```bash
ssh -i "$DST_KEY" "$DST_HOST" "journalctl -u postcatering-api -n 200 --no-pager"
ssh -i "$DST_KEY" "$DST_HOST" "sudo tail -n 200 /var/log/nginx/error.log"
ssh -i "$DST_KEY" "$DST_HOST" "sudo tail -n 200 /var/log/nginx/access.log"
```

## 9) Rollback Command Stubs

```bash
# 1) Repoint DNS back to previous target
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch file://route53-rollback.json

# 2) Restore target DB from pre-cutover backup if needed
ssh -i "$DST_KEY" "$DST_HOST" "gunzip -c /home/ubuntu/pre_cutover_backup.sql.gz | mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\""

# 3) Verify rollback health
curl -f "https://$DOMAIN/api/health"
```
