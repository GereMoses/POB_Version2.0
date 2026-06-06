#!/bin/bash
# ─── POB System — Deployment Script ──────────────────────────────────────────
# Usage:
#   First deploy:   ./scripts/deploy.sh
#   Update (no downtime rebuild):  ./scripts/deploy.sh update
#   Full restart:   ./scripts/deploy.sh restart
#   View status:    ./scripts/deploy.sh status
#   View logs:      ./scripts/deploy.sh logs [service]
#   Backup now:     ./scripts/deploy.sh backup
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${BLUE}──── $* ────${NC}"; }

CMD="${1:-deploy}"

# ── Preflight checks ──────────────────────────────────────────────────────────
preflight() {
  [ -f ".env.prod" ]      || error ".env.prod not found. Copy .env.prod.example and fill in values."
  [ -f "nginx/certs/fullchain.pem" ] || warn "SSL cert not found at nginx/certs/fullchain.pem — HTTPS will not work."
  [ -f "nginx/certs/privkey.pem"  ] || warn "SSL key not found at nginx/certs/privkey.pem — HTTPS will not work."
  command -v docker &>/dev/null      || error "Docker not installed. Run: bash scripts/setup-server.sh"
  docker compose version &>/dev/null || error "Docker Compose not installed."
}

# ── Deploy (first time) ───────────────────────────────────────────────────────
deploy() {
  step "POB System — First Deploy"
  preflight

  info "Pulling latest base images..."
  $COMPOSE pull --quiet postgres redis nginx prometheus grafana 2>/dev/null || true

  info "Building application images..."
  $COMPOSE build --no-cache backend frontend celery-worker celery-beat

  info "Starting all services..."
  $COMPOSE up -d --remove-orphans

  step "Waiting for services to be healthy..."
  sleep 15

  show_status
}

# ── Update (rolling rebuild — minimal downtime) ───────────────────────────────
update() {
  step "POB System — Update"
  preflight

  info "Pulling latest code... (run git pull before this if not already done)"

  info "Rebuilding changed images..."
  $COMPOSE build backend frontend celery-worker celery-beat

  info "Restarting updated services (backend first, then frontend)..."
  $COMPOSE up -d --no-deps --remove-orphans backend
  sleep 10
  $COMPOSE up -d --no-deps --remove-orphans frontend celery-worker celery-beat
  $COMPOSE up -d --no-deps --remove-orphans nginx

  info "Update complete."
  show_status
}

# ── Restart all services ──────────────────────────────────────────────────────
restart() {
  step "POB System — Restart"
  $COMPOSE restart
  show_status
}

# ── Status ────────────────────────────────────────────────────────────────────
show_status() {
  step "Service Status"
  $COMPOSE ps

  echo ""
  info "Health endpoints:"
  echo "  Backend:  $(curl -sf http://localhost:8000/health 2>/dev/null && echo '✓ UP' || echo '✗ DOWN')"
  echo "  Frontend: $(curl -sf http://localhost/ 2>/dev/null && echo '✓ UP' || echo '✗ DOWN')"
  echo ""
  info "Recent backend logs (last 20 lines):"
  $COMPOSE logs --tail=20 backend
}

# ── Logs ──────────────────────────────────────────────────────────────────────
show_logs() {
  SERVICE="${2:-backend}"
  $COMPOSE logs -f --tail=100 "${SERVICE}"
}

# ── Manual backup ─────────────────────────────────────────────────────────────
run_backup() {
  step "Running manual database backup..."
  docker exec pob_db_backup /bin/sh /backup.sh
  info "Backup complete. Files are in the db_backups volume."
  docker exec pob_db_backup ls -lh /backups/daily/ | tail -5
}

# ── Restore from backup ───────────────────────────────────────────────────────
restore_backup() {
  BACKUP_FILE="${2:-}"
  [ -n "${BACKUP_FILE}" ] || error "Usage: ./scripts/deploy.sh restore <backup_file.sql.gz>"
  step "Restoring from backup: ${BACKUP_FILE}"
  warn "This will OVERWRITE the current database. Ctrl+C within 10 seconds to cancel..."
  sleep 10
  docker exec -i pob_postgres sh -c \
    "PGPASSWORD=\${POSTGRES_PASSWORD} dropdb -U \${POSTGRES_USER} \${POSTGRES_DB} && \
     PGPASSWORD=\${POSTGRES_PASSWORD} createdb -U \${POSTGRES_USER} \${POSTGRES_DB}"
  zcat "${BACKUP_FILE}" | docker exec -i pob_postgres sh -c \
    "PGPASSWORD=\${POSTGRES_PASSWORD} psql -U \${POSTGRES_USER} \${POSTGRES_DB}"
  info "Restore complete."
}

# ── Stop everything ───────────────────────────────────────────────────────────
stop() {
  step "Stopping all services..."
  $COMPOSE down
  info "All services stopped."
}

# ── Dispatcher ───────────────────────────────────────────────────────────────
case "${CMD}" in
  deploy)   deploy ;;
  update)   update ;;
  restart)  restart ;;
  status)   show_status ;;
  logs)     show_logs "$@" ;;
  backup)   run_backup ;;
  restore)  restore_backup "$@" ;;
  stop)     stop ;;
  *)
    echo "Usage: ./scripts/deploy.sh [deploy|update|restart|status|logs|backup|restore|stop]"
    echo ""
    echo "  deploy   — First-time deploy (builds + starts everything)"
    echo "  update   — Pull new code and rebuild (minimal downtime)"
    echo "  restart  — Restart all running services"
    echo "  status   — Show service health and recent logs"
    echo "  logs     — Follow logs (default: backend). e.g. logs nginx"
    echo "  backup   — Run a database backup immediately"
    echo "  restore  — Restore from a .sql.gz backup file"
    echo "  stop     — Stop all services"
    ;;
esac
