#!/bin/bash
# ─── POB System — SSL Certificate Setup ──────────────────────────────────────
# Sets up a free Let's Encrypt SSL certificate for your domain.
# Run this AFTER setup-server.sh and BEFORE deploy.sh.
#
# Usage: bash scripts/ssl-setup.sh your-domain.com admin@your-company.com
#
# For organisations with their own CA certificate (enterprise):
#   Skip this script and copy your cert files manually:
#     nginx/certs/fullchain.pem  — your certificate + chain
#     nginx/certs/privkey.pem    — your private key
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

[ -n "${DOMAIN}" ] || { echo "Usage: bash scripts/ssl-setup.sh <domain> <email>"; exit 1; }
[ -n "${EMAIL}"  ] || { echo "Usage: bash scripts/ssl-setup.sh <domain> <email>"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo -e "${RED}Run as root: sudo bash scripts/ssl-setup.sh${NC}"; exit 1; }

echo -e "${GREEN}Setting up SSL certificate for: ${DOMAIN}${NC}"

# Install certbot if not present
if ! command -v certbot &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi

# Stop nginx if running (certbot needs port 80)
docker stop pob_nginx 2>/dev/null || true

# Obtain certificate (standalone mode — uses port 80 directly)
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  -d "${DOMAIN}"

# Copy certs to nginx/certs
mkdir -p nginx/certs
cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem nginx/certs/fullchain.pem
cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem   nginx/certs/privkey.pem
chmod 644 nginx/certs/fullchain.pem
chmod 600 nginx/certs/privkey.pem

# Set up auto-renewal cron (runs twice daily, standard certbot practice)
(crontab -l 2>/dev/null; echo "0 3,15 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /opt/pob-system/nginx/certs/fullchain.pem && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /opt/pob-system/nginx/certs/privkey.pem && docker exec pob_nginx nginx -s reload'") | crontab -

echo -e "${GREEN}✓ SSL certificate installed at nginx/certs/${NC}"
echo -e "${GREEN}✓ Auto-renewal configured (runs at 03:00 and 15:00 daily)${NC}"
echo ""
echo "Certificate details:"
openssl x509 -in nginx/certs/fullchain.pem -noout -subject -dates
echo ""
echo "Start nginx: docker compose -f docker-compose.prod.yml up -d nginx"
