#!/usr/bin/env bash
set -Eeuo pipefail

# Expected overrides via environment:
# APP_DIR, BRANCH, API_SERVICE, WEB_ROOT, HEALTH_URL, API_ENV_FILE, DB_MIGRATION_ARGS
APP_DIR="${APP_DIR:-/home/ubuntu/PostCatering}"
BRANCH="${BRANCH:-main}"
API_SERVICE="${API_SERVICE:-postcatering-api}"
WEB_ROOT="${WEB_ROOT:-/var/www/postcatering}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/api/health}"
API_ENV_FILE="${API_ENV_FILE:-/etc/postcatering/api.env}"
DB_MIGRATION_ARGS="${DB_MIGRATION_ARGS:---apply-schema --no-seed}"

if sudo -n true >/dev/null 2>&1; then
  SUDO="sudo -n"
else
  SUDO="sudo"
fi

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

load_api_env() {
  local env_path="$1"
  if [ ! -f "$env_path" ]; then
    return 1
  fi

  log "Loading API environment from $env_path"
  set -a
  if ! source "$env_path"; then
    set +a
    return 1
  fi
  set +a
  return 0
}

lock_file="/tmp/postcatering-deploy.lock"
exec 9>"$lock_file"
if ! flock -n 9; then
  log "Deploy already in progress. Exiting."
  exit 1
fi

log "Starting deploy in $APP_DIR (branch: $BRANCH)"
cd "$APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
DEPLOY_SHA="$(git rev-parse --short HEAD)"
log "Checked out $DEPLOY_SHA"

log "Installing backend dependencies"
cd api
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install gunicorn cryptography

if ! load_api_env "$API_ENV_FILE"; then
  if ! load_api_env ".env"; then
    log "No API environment file found at $API_ENV_FILE or $(pwd)/.env; relying on current shell environment"
  fi
fi

log "Running database schema sync ($DB_MIGRATION_ARGS)"
# Intentional word splitting so multiple flags can be supplied via DB_MIGRATION_ARGS.
# shellcheck disable=SC2086
python scripts/menu_admin_sync.py $DB_MIGRATION_ARGS
deactivate

log "Building frontend"
cd ../client
npm ci
npm run build

log "Publishing frontend build to $WEB_ROOT"
$SUDO mkdir -p "$WEB_ROOT"
$SUDO rm -rf "$WEB_ROOT"/*
$SUDO cp -a dist/. "$WEB_ROOT"/

log "Restarting API service ($API_SERVICE)"
$SUDO systemctl restart "$API_SERVICE"

if systemctl list-unit-files | grep -q '^nginx\.service'; then
  log "Reloading nginx"
  $SUDO systemctl reload nginx
fi

log "Waiting for health check ($HEALTH_URL)"
for attempt in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    log "Deploy successful at commit $DEPLOY_SHA"
    exit 0
  fi
  sleep 2
done

log "Health check failed after deploy."
$SUDO systemctl status "$API_SERVICE" --no-pager || true
exit 1
