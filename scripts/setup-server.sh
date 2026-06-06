#!/bin/bash
# ─── POB System — Fresh Server Setup ─────────────────────────────────────────
# Run this ONCE on a clean Ubuntu 22.04 server to install all prerequisites.
# Usage: bash scripts/setup-server.sh
#
# What this does:
#   1. Installs Docker + Docker Compose
#   2. Installs essential tools
#   3. Creates the pob system user
#   4. Sets up the systemd service for auto-start on reboot
#   5. Configures the firewall (ports 22, 80, 443 only)
#   6. Sets up log rotation
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Must run as root ──────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || error "Run as root: sudo bash scripts/setup-server.sh"

info "Starting POB System server setup..."

# ── 1. System update ─────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git vim htop unzip \
  ufw fail2ban \
  logrotate

# ── 2. Install Docker ────────────────────────────────────────────────────────
info "Installing Docker..."
if command -v docker &>/dev/null; then
  warn "Docker already installed: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  info "Docker installed: $(docker --version)"
fi

# ── 3. Install Docker Compose plugin ────────────────────────────────────────
info "Installing Docker Compose..."
if docker compose version &>/dev/null; then
  warn "Docker Compose already installed: $(docker compose version)"
else
  apt-get install -y -qq docker-compose-plugin
  info "Docker Compose installed: $(docker compose version)"
fi

# ── 4. Create pob system user ────────────────────────────────────────────────
info "Creating pob system user..."
if id "pob" &>/dev/null; then
  warn "User 'pob' already exists"
else
  useradd -m -s /bin/bash -G docker pob
  info "User 'pob' created and added to docker group"
fi

# ── 5. Create app directory ───────────────────────────────────────────────────
APP_DIR="/opt/pob-system"
info "Creating application directory at ${APP_DIR}..."
mkdir -p "${APP_DIR}"
mkdir -p "${APP_DIR}/nginx/certs"
mkdir -p "${APP_DIR}/docker/backup"
chown -R pob:pob "${APP_DIR}"

# ── 6. Install systemd service ───────────────────────────────────────────────
info "Installing systemd service..."
cat > /etc/systemd/system/pob-system.service <<'SERVICE'
[Unit]
Description=POB Personnel On Board System
Documentation=https://github.com/GereMoses/POB_Version2.0
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/pob-system
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.prod.yml pull && \
           /usr/bin/docker compose -f docker-compose.prod.yml up -d --remove-orphans
TimeoutStartSec=300
TimeoutStopSec=120
StandardOutput=journal
StandardError=journal
Restart=on-failure
RestartSec=30
User=pob

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable pob-system.service
info "systemd service installed and enabled (will start on boot)"

# ── 7. Configure firewall ─────────────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP (ZKTeco ADMS + redirect to HTTPS)"
ufw allow 443/tcp  comment "HTTPS (POB System UI + API)"
# All other ports (5432 PostgreSQL, 6379 Redis, 8000 Backend, 3000 Frontend)
# are blocked externally — they only communicate within the Docker internal network
ufw --force enable
info "Firewall configured. Open ports: 22 (SSH), 80 (ADMS/HTTP), 443 (HTTPS)"
ufw status

# ── 8. Configure fail2ban ────────────────────────────────────────────────────
info "Configuring fail2ban (brute-force protection)..."
cat > /etc/fail2ban/jail.local <<'FAIL2BAN'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled  = true
filter   = nginx-http-auth
port     = http,https
logpath  = /var/lib/docker/volumes/pob_system_nginx_logs/_data/error.log
FAIL2BAN

systemctl enable fail2ban
systemctl restart fail2ban
info "fail2ban configured"

# ── 9. Configure log rotation ────────────────────────────────────────────────
info "Configuring log rotation..."
cat > /etc/logrotate.d/pob-system <<'LOGROTATE'
/var/lib/docker/volumes/pob_system_logs_data/_data/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        docker exec pob_backend kill -USR1 1 2>/dev/null || true
    endscript
}

/var/lib/docker/volumes/pob_system_nginx_logs/_data/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        docker exec pob_nginx nginx -s reopen 2>/dev/null || true
    endscript
}
LOGROTATE

info "Log rotation configured (14-day retention)"

# ── 10. Set up automatic security updates ────────────────────────────────────
info "Enabling automatic security updates..."
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades || true

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════��════════════════════════${NC}"
echo -e "${GREEN}  Server setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Clone the repo:   cd /opt/pob-system && git clone https://github.com/GereMoses/POB_Version2.0.git ."
echo "  2. Create secrets:   cp .env.prod.example .env.prod && nano .env.prod"
echo "  3. Add SSL certs:    copy fullchain.pem + privkey.pem to nginx/certs/"
echo "  4. Deploy:           ./scripts/deploy.sh"
echo ""
echo "The system will auto-start on every server reboot."
