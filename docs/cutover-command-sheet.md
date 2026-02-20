# Owner Account Cutover Command Sheet

Command-focused checklist for launch day.
Target production domain: `post460catering.com`

## 0) Fill These Variables

```bash
# Source (temporary account) instance
export SRC_HOST=ubuntu@SOURCE_PUBLIC_DNS
export SRC_KEY=~/keys/source.pem

# Target (owner account) instance
export DST_HOST=ubuntu@OWNER_PUBLIC_DNS
export DST_KEY=~/keys/owner.pem

# Database
export DB_NAME=post_catering
export DB_USER=postcatering_app
export DB_PASS='CHANGE_ME_STRONG_PASSWORD'

# Domain verification
export DOMAIN=post460catering.com
```

## 1) Final Backup From Source

```bash
ssh -i "$SRC_KEY" "$SRC_HOST" "mysqldump -u \"$DB_USER\" -p\"$DB_PASS\" --single-transaction --routines --triggers \"$DB_NAME\" > /home/ubuntu/final_cutover.sql"
ssh -i "$SRC_KEY" "$SRC_HOST" "gzip -f /home/ubuntu/final_cutover.sql"
ssh -i "$SRC_KEY" "$SRC_HOST" "sha256sum /home/ubuntu/final_cutover.sql.gz"
```

## 2) Copy Backup To Local, Then To Owner

```bash
scp -i "$SRC_KEY" "$SRC_HOST:/home/ubuntu/final_cutover.sql.gz" .
sha256sum final_cutover.sql.gz
scp -i "$DST_KEY" ./final_cutover.sql.gz "$DST_HOST:/home/ubuntu/"
```

## 3) Import Backup Into Owner Environment

```bash
ssh -i "$DST_KEY" "$DST_HOST" "gunzip -c /home/ubuntu/final_cutover.sql.gz | mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\""
```

## 4) Quick Data Integrity Checks

```bash
ssh -i "$DST_KEY" "$DST_HOST" "mysql -u \"$DB_USER\" -p\"$DB_PASS\" -D \"$DB_NAME\" -e \"SELECT 'menu_items' AS table_name, COUNT(*) AS row_count FROM menu_items UNION ALL SELECT 'slides', COUNT(*) FROM slides UNION ALL SELECT 'inquiries', COUNT(*) FROM inquiries UNION ALL SELECT 'menu_config', COUNT(*) FROM menu_config;\""
```

## 5) Restart App Services On Owner

```bash
ssh -i "$DST_KEY" "$DST_HOST" "sudo systemctl restart postcatering-api && sudo systemctl reload nginx"
ssh -i "$DST_KEY" "$DST_HOST" "sudo systemctl status postcatering-api --no-pager"
ssh -i "$DST_KEY" "$DST_HOST" "curl -f http://127.0.0.1/api/health"
```

## 6) DNS Cutover (If Using Route53 CLI)

Create `route53-cutover.json`:

```json
{
  "Comment": "Cutover to owner account target",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "post460catering.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{ "Value": "OWNER_PUBLIC_IP" }]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.post460catering.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{ "Value": "OWNER_PUBLIC_IP" }]
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

# 2) Restore owner DB from pre-cutover backup if needed
ssh -i "$DST_KEY" "$DST_HOST" "gunzip -c /home/ubuntu/pre_cutover_backup.sql.gz | mysql -u \"$DB_USER\" -p\"$DB_PASS\" \"$DB_NAME\""

# 3) Verify rollback health
curl -f "https://$DOMAIN/api/health"
```
