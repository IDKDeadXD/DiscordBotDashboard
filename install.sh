#!/bin/bash

# Discord Bot Dashboard - Automated Installer
# Usage: curl -sSL https://your-repo-url/install.sh | bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Discord Bot Dashboard - Auto Installer          ║"
echo "║              VPS Management System                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}Warning: Running as root. This is okay but consider using a regular user.${NC}"
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS. This script supports Ubuntu/Debian and CentOS/RHEL.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Detected OS: $OS${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install dependencies based on OS
install_dependencies() {
    echo -e "${BLUE}Installing system dependencies...${NC}"

    if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
        sudo apt-get update
        sudo apt-get install -y curl git docker.io docker-compose mysql-server nodejs npm
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo systemctl start mysql
        sudo systemctl enable mysql
    elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
        sudo yum install -y curl git docker docker-compose mysql-server nodejs npm
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo systemctl start mysqld
        sudo systemctl enable mysqld
    else
        echo -e "${RED}Unsupported OS: $OS${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ System dependencies installed${NC}"
}

# Check and install Node.js (v18+)
check_nodejs() {
    echo -e "${BLUE}Checking Node.js version...${NC}"

    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo -e "${YELLOW}Node.js version is too old. Installing Node.js 18...${NC}"
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            echo -e "${GREEN}✓ Node.js version is adequate${NC}"
        fi
    else
        echo -e "${YELLOW}Node.js not found. Installing...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
}

# Check Docker
check_docker() {
    if ! command_exists docker; then
        echo -e "${YELLOW}Docker not found. Installing...${NC}"
        install_dependencies
    else
        echo -e "${GREEN}✓ Docker is installed${NC}"
    fi

    # Add current user to docker group
    if ! groups $USER | grep -q docker; then
        echo -e "${YELLOW}Adding user to docker group...${NC}"
        sudo usermod -aG docker $USER
        echo -e "${YELLOW}Note: You may need to log out and back in for docker group to take effect${NC}"
    fi
}

# Setup MySQL
setup_mysql() {
    echo -e "${BLUE}Setting up MySQL database...${NC}"

    # Generate random MySQL password for app
    DB_PASSWORD=$(openssl rand -base64 32)

    # Create database and user
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS discord_bot_dashboard;" 2>/dev/null || true
    sudo mysql -e "CREATE USER IF NOT EXISTS 'botdashboard'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';" 2>/dev/null || true
    sudo mysql -e "GRANT ALL PRIVILEGES ON discord_bot_dashboard.* TO 'botdashboard'@'localhost';" 2>/dev/null || true
    sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true

    echo -e "${GREEN}✓ MySQL database configured${NC}"
}

# Get Super Admin credentials
get_admin_credentials() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║          Super Admin Account Setup                  ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""

    read -p "Enter Super Admin Username: " ADMIN_USERNAME
    while [ -z "$ADMIN_USERNAME" ]; do
        echo -e "${RED}Username cannot be empty!${NC}"
        read -p "Enter Super Admin Username: " ADMIN_USERNAME
    done

    read -p "Enter Super Admin Email: " ADMIN_EMAIL
    while [ -z "$ADMIN_EMAIL" ]; do
        echo -e "${RED}Email cannot be empty!${NC}"
        read -p "Enter Super Admin Email: " ADMIN_EMAIL
    done

    while true; do
        read -s -p "Enter Super Admin Password: " ADMIN_PASSWORD
        echo ""
        read -s -p "Confirm Password: " ADMIN_PASSWORD_CONFIRM
        echo ""

        if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD_CONFIRM" ]; then
            if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
                echo -e "${RED}Password must be at least 8 characters!${NC}"
            else
                break
            fi
        else
            echo -e "${RED}Passwords do not match!${NC}"
        fi
    done

    echo -e "${GREEN}✓ Super Admin credentials collected${NC}"
}

# Clone repository or use local files
setup_application() {
    echo -e "${BLUE}Setting up application...${NC}"

    INSTALL_DIR="/opt/discord-bot-dashboard"

    # Check if we should clone from repo or if files are already present
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Installation directory already exists. Backing up...${NC}"
        sudo mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
    fi

    sudo mkdir -p "$INSTALL_DIR"

    # If running from local directory, copy files
    if [ -f "package.json" ]; then
        echo -e "${BLUE}Using local files...${NC}"
        sudo cp -r . "$INSTALL_DIR/"
    else
        echo -e "${BLUE}Cloning from repository...${NC}"
        # TODO: Replace with your actual repository URL
        # sudo git clone https://github.com/yourusername/discord-bot-dashboard.git "$INSTALL_DIR"
        echo -e "${RED}Error: No repository URL configured. Please run this script from the project directory.${NC}"
        exit 1
    fi

    sudo chown -R $USER:$USER "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    echo -e "${GREEN}✓ Application files ready${NC}"
}

# Create environment configuration
create_env_file() {
    echo -e "${BLUE}Creating environment configuration...${NC}"

    JWT_SECRET=$(openssl rand -base64 64)

    cat > /opt/discord-bot-dashboard/backend/.env <<EOF
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=discord_bot_dashboard
DB_USER=botdashboard
DB_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Super Admin (First-time setup)
SUPER_ADMIN_USERNAME=${ADMIN_USERNAME}
SUPER_ADMIN_EMAIL=${ADMIN_EMAIL}
SUPER_ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Docker Configuration
DOCKER_SOCKET=/var/run/docker.sock
BOTS_NETWORK=discord-bots-network
EOF

    cat > /opt/discord-bot-dashboard/frontend/.env <<EOF
VITE_API_URL=http://localhost:3000/api
EOF

    echo -e "${GREEN}✓ Environment configuration created${NC}"
}

# Install Node.js dependencies
install_node_dependencies() {
    echo -e "${BLUE}Installing Node.js dependencies...${NC}"

    cd /opt/discord-bot-dashboard
    npm install

    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Build frontend
build_frontend() {
    echo -e "${BLUE}Building frontend...${NC}"

    cd /opt/discord-bot-dashboard
    npm run build

    echo -e "${GREEN}✓ Frontend built${NC}"
}

# Create systemd service
create_systemd_service() {
    echo -e "${BLUE}Creating systemd service...${NC}"

    sudo tee /etc/systemd/system/discord-bot-dashboard.service > /dev/null <<EOF
[Unit]
Description=Discord Bot Dashboard
After=network.target mysql.service docker.service
Requires=mysql.service docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/discord-bot-dashboard
ExecStart=/usr/bin/node backend/src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot-dashboard

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable discord-bot-dashboard

    echo -e "${GREEN}✓ Systemd service created${NC}"
}

# Setup Docker network for bots
setup_docker_network() {
    echo -e "${BLUE}Setting up Docker network for bots...${NC}"

    if ! docker network ls | grep -q discord-bots-network; then
        docker network create discord-bots-network
        echo -e "${GREEN}✓ Docker network created${NC}"
    else
        echo -e "${GREEN}✓ Docker network already exists${NC}"
    fi
}

# Initialize database
initialize_database() {
    echo -e "${BLUE}Initializing database schema...${NC}"

    cd /opt/discord-bot-dashboard
    node backend/src/scripts/init-db.js

    echo -e "${GREEN}✓ Database initialized${NC}"
}

# Start the service
start_service() {
    echo -e "${BLUE}Starting Discord Bot Dashboard...${NC}"

    sudo systemctl start discord-bot-dashboard
    sleep 3

    if sudo systemctl is-active --quiet discord-bot-dashboard; then
        echo -e "${GREEN}✓ Service started successfully${NC}"
    else
        echo -e "${RED}✗ Service failed to start. Check logs with: sudo journalctl -u discord-bot-dashboard -n 50${NC}"
        exit 1
    fi
}

# Get server IP
get_server_ip() {
    SERVER_IP=$(hostname -I | awk '{print $1}')
    if [ -z "$SERVER_IP" ]; then
        SERVER_IP=$(curl -s ifconfig.me)
    fi
    echo "$SERVER_IP"
}

# Main installation flow
main() {
    echo -e "${BLUE}Starting installation...${NC}"
    echo ""

    check_nodejs
    check_docker
    install_dependencies
    setup_mysql
    get_admin_credentials
    setup_application
    create_env_file
    setup_docker_network
    install_node_dependencies
    build_frontend
    initialize_database
    create_systemd_service
    start_service

    SERVER_IP=$(get_server_ip)

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Installation Complete! 🎉                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Dashboard URL:${NC} http://${SERVER_IP}:3000"
    echo ""
    echo -e "${BLUE}Super Admin Credentials:${NC}"
    echo -e "  Username: ${GREEN}${ADMIN_USERNAME}${NC}"
    echo -e "  Email:    ${GREEN}${ADMIN_EMAIL}${NC}"
    echo ""
    echo -e "${YELLOW}Important:${NC}"
    echo -e "  • Service is running as: ${GREEN}discord-bot-dashboard${NC}"
    echo -e "  • Logs: ${GREEN}sudo journalctl -u discord-bot-dashboard -f${NC}"
    echo -e "  • Restart: ${GREEN}sudo systemctl restart discord-bot-dashboard${NC}"
    echo -e "  • Stop: ${GREEN}sudo systemctl stop discord-bot-dashboard${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Open http://${SERVER_IP}:3000 in your browser"
    echo -e "  2. Login with your Super Admin credentials"
    echo -e "  3. Start managing your Discord bots!"
    echo ""
    echo -e "${BLUE}For production, consider:${NC}"
    echo -e "  • Setting up a reverse proxy (nginx/caddy)"
    echo -e "  • Configuring SSL/TLS certificates"
    echo -e "  • Setting up firewall rules"
    echo ""
}

# Run main installation
main
