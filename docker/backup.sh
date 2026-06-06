#!/bin/sh
# Automated PostgreSQL backup script
# Runs inside the db-backup container via cron at 02:00 daily.
# Retains: 7 daily, 4 weekly (Sunday), 3 monthly (1st of month) backups.

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)   # 1=Monday ... 7=Sunday
DAY_OF_MONTH=$(date +%d)
FILENAME="pob_backup_${DATE}.sql.gz"

echo "=============================="
echo "POB Backup — $(date)"
echo "=============================="

# ── Run the backup ──────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-password \
  --format=plain \
  --blobs \
  | gzip > "${BACKUP_DIR}/daily/${FILENAME}"

echo "✓ Backup written: daily/${FILENAME}"
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/daily/${FILENAME}" | cut -f1)
echo "  Size: ${BACKUP_SIZE}"

# ── Promote to weekly backup (every Sunday) ─────────────────────────────────
if [ "${DAY_OF_WEEK}" = "7" ]; then
  cp "${BACKUP_DIR}/daily/${FILENAME}" "${BACKUP_DIR}/weekly/${FILENAME}"
  echo "✓ Weekly backup saved"
fi

# ── Promote to monthly backup (1st of every month) ──────────────────────────
if [ "${DAY_OF_MONTH}" = "01" ]; then
  cp "${BACKUP_DIR}/daily/${FILENAME}" "${BACKUP_DIR}/monthly/${FILENAME}"
  echo "✓ Monthly backup saved"
fi

# ── Purge old backups ────────────────────────────────────────────────────────
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
RETAIN_WEEKS="${BACKUP_RETAIN_WEEKS:-4}"
RETAIN_MONTHS="${BACKUP_RETAIN_MONTHS:-3}"

find "${BACKUP_DIR}/daily"   -name "*.sql.gz" -mtime +${RETAIN_DAYS}  -delete
find "${BACKUP_DIR}/weekly"  -name "*.sql.gz" -mtime +$((RETAIN_WEEKS * 7)) -delete
find "${BACKUP_DIR}/monthly" -name "*.sql.gz" -mtime +$((RETAIN_MONTHS * 31)) -delete

echo "✓ Old backups pruned (daily>${RETAIN_DAYS}d, weekly>${RETAIN_WEEKS}w, monthly>${RETAIN_MONTHS}m)"

# ── Summary ──────────────────────────────────────────────────────────────────
DAILY_COUNT=$(ls "${BACKUP_DIR}/daily/"*.sql.gz 2>/dev/null | wc -l)
WEEKLY_COUNT=$(ls "${BACKUP_DIR}/weekly/"*.sql.gz 2>/dev/null | wc -l)
MONTHLY_COUNT=$(ls "${BACKUP_DIR}/monthly/"*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

echo ""
echo "Backup inventory:"
echo "  Daily:   ${DAILY_COUNT} files"
echo "  Weekly:  ${WEEKLY_COUNT} files"
echo "  Monthly: ${MONTHLY_COUNT} files"
echo "  Total:   ${TOTAL_SIZE}"
echo ""
echo "Backup complete — $(date)"
