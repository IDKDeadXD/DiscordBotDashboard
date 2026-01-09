#!/bin/bash

# Discord Bot Dashboard - Update Script
# Usage: curl -sSL https://raw.githubusercontent.com/IDKDeadXD/DiscordBotDashboard/main/update.sh | bash
# Or: ./update.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Discord Bot Dashboard - Update Script           ║"
echo "║              Updating to Latest Version             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

INSTALL_DIR="/opt/discord-bot-dashboard"

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}✗ Installation not found at $INSTALL_DIR${NC}"
    echo -e "${YELLOW}Please run the installer first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Installation found${NC}"

# Backup current .env files
echo -e "${BLUE}Backing up configuration files...${NC}"
if [ -f "$INSTALL_DIR/backend/.env" ]; then
    cp "$INSTALL_DIR/backend/.env" "$INSTALL_DIR/backend/.env.backup.$(date +%s)"
    echo -e "${GREEN}✓ Backend .env backed up${NC}"
fi

if [ -f "$INSTALL_DIR/frontend/.env" ]; then
    cp "$INSTALL_DIR/frontend/.env" "$INSTALL_DIR/frontend/.env.backup.$(date +%s)"
    echo -e "${GREEN}✓ Frontend .env backed up${NC}"
fi

# Stop the service
echo -e "${BLUE}Stopping Discord Bot Dashboard service...${NC}"
sudo systemctl stop discord-bot-dashboard 2>/dev/null || echo -e "${YELLOW}Service not running${NC}"

# Backup database (optional but recommended)
echo -e "${BLUE}Creating database backup...${NC}"
BACKUP_FILE="$HOME/discord-bot-dashboard-backup-$(date +%Y%m%d-%H%M%S).sql"
sudo mysqldump discord_bot_dashboard > "$BACKUP_FILE" 2>/dev/null && \
    echo -e "${GREEN}✓ Database backed up to $BACKUP_FILE${NC}" || \
    echo -e "${YELLOW}⚠ Database backup skipped${NC}"

# Navigate to installation directory
cd "$INSTALL_DIR"

# Check if it's a git repository
if [ -d ".git" ]; then
    echo -e "${BLUE}Pulling latest changes from GitHub...${NC}"

    # Stash any local changes
    git stash push -m "Auto-stash before update $(date +%Y%m%d-%H%M%S)"

    # Pull latest changes
    git pull origin main

    echo -e "${GREEN}✓ Latest code downloaded${NC}"
else
    echo -e "${BLUE}Not a git repository. Downloading fresh copy...${NC}"

    # Backup current installation
    cd /opt
    sudo mv discord-bot-dashboard discord-bot-dashboard.backup.$(date +%s)

    # Clone fresh copy
    sudo git clone https://github.com/IDKDeadXD/DiscordBotDashboard.git discord-bot-dashboard
    sudo chown -R $USER:$USER discord-bot-dashboard

    cd discord-bot-dashboard

    # Restore .env files
    if [ -f "../discord-bot-dashboard.backup.*/backend/.env" ]; then
        cp ../discord-bot-dashboard.backup.*/backend/.env backend/.env
        cp ../discord-bot-dashboard.backup.*/frontend/.env frontend/.env 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ Fresh installation downloaded${NC}"
fi

# Install/Update Node.js dependencies
echo -e "${BLUE}Updating Node.js dependencies...${NC}"

# Backend dependencies
cd "$INSTALL_DIR"
echo -e "${YELLOW}Installing root dependencies...${NC}"
npm install --silent

echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd "$INSTALL_DIR/backend"
npm install --silent

echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd "$INSTALL_DIR/frontend"
npm install --silent

echo -e "${GREEN}✓ Dependencies updated${NC}"

# Run database migrations (if any)
echo -e "${BLUE}Checking database schema...${NC}"
cd "$INSTALL_DIR"
node backend/src/scripts/init-db.js
echo -e "${GREEN}✓ Database schema updated${NC}"

# Rebuild frontend
echo -e "${BLUE}Building frontend...${NC}"
cd "$INSTALL_DIR"
npm run build
echo -e "${GREEN}✓ Frontend rebuilt${NC}"

# Restart the service
echo -e "${BLUE}Starting Discord Bot Dashboard service...${NC}"
sudo systemctl start discord-bot-dashboard

# Wait a moment for the service to start
sleep 3

# Check if service started successfully
if sudo systemctl is-active --quiet discord-bot-dashboard; then
    echo -e "${GREEN}✓ Service started successfully${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo -e "${YELLOW}Check logs with: sudo journalctl -u discord-bot-dashboard -n 50${NC}"
    exit 1
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Update Complete! 🎉                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Dashboard URL:${NC} http://${SERVER_IP}:3000"
echo ""
echo -e "${BLUE}What was updated:${NC}"
echo -e "  ✓ Application code updated to latest version"
echo -e "  ✓ Dependencies updated"
echo -e "  ✓ Database schema checked and updated"
echo -e "  ✓ Frontend rebuilt"
echo -e "  ✓ Service restarted"
echo ""
echo -e "${BLUE}Backup files:${NC}"
echo -e "  • Configuration: $INSTALL_DIR/backend/.env.backup.*"
[ -f "$BACKUP_FILE" ] && echo -e "  • Database: $BACKUP_FILE"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  • View logs: ${GREEN}sudo journalctl -u discord-bot-dashboard -f${NC}"
echo -e "  • Restart: ${GREEN}sudo systemctl restart discord-bot-dashboard${NC}"
echo -e "  • Status: ${GREEN}sudo systemctl status discord-bot-dashboard${NC}"
echo ""
echo -e "${YELLOW}Note: Running bots were not affected by this update.${NC}"
echo -e "${YELLOW}To update bot containers, redeploy them from the dashboard.${NC}"
echo ""
