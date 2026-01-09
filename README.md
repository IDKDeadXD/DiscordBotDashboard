# Discord Bot Dashboard

A powerful VPS dashboard for managing multiple Discord bots with Docker containers. Deploy, monitor, and manage all your Discord bots from a single, beautiful web interface.

## Features

- **User Management**: Multi-user system with role-based access control (Super Admin, Admin, User)
- **Bot Deployment**: Deploy Discord bots in isolated Docker containers
- **Real-time Monitoring**: View logs, stats, and bot status in real-time
- **Easy Management**: Start, stop, restart, and delete bots with one click
- **Secure Authentication**: JWT-based authentication with no public signup
- **Docker Integration**: Each bot runs in its own Docker container with resource limits
- **MySQL Database**: Reliable data storage with MySQL
- **Auto-restart**: Configure bots to automatically restart on failure

## Quick Installation

### One-Line Install (Recommended)

Run this command on your VPS as a regular user (not root):

```bash
curl -sSL https://raw.githubusercontent.com/IDKDeadXD/DiscordBotDashboard/main/install.sh | bash
```

Or if you have the files locally:

```bash
cd /path/to/discord-bot-dashboard
chmod +x install.sh
./install.sh
```

The installer will:
1. Check and install system dependencies (Node.js, Docker, MySQL)
2. Prompt you to create a Super Admin account
3. Set up the database and environment
4. Build and start the application
5. Display the dashboard URL

## Updating

### One-Line Update (Recommended)

To update your dashboard to the latest version:

```bash
curl -sSL https://raw.githubusercontent.com/IDKDeadXD/DiscordBotDashboard/main/update.sh | bash
```

Or if you have the files locally:

```bash
cd /opt/discord-bot-dashboard
chmod +x update.sh
./update.sh
```

The update script will:
1. Backup your configuration files (.env)
2. Backup your database
3. Pull the latest code from GitHub
4. Update Node.js dependencies
5. Rebuild the frontend
6. Restart the service
7. Keep all your running bots intact

**Note:** Running bots will NOT be affected by the update. Your bot containers will continue running without interruption.

## Manual Installation

### Prerequisites

- Ubuntu 20.04+ or Debian 11+ (or similar Linux distribution)
- Node.js 18+
- Docker and Docker Compose
- MySQL 8.0+
- 2GB+ RAM recommended
- Root or sudo access

### Step-by-Step Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/discord-bot-dashboard.git
cd discord-bot-dashboard
```

2. **Install system dependencies**

Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y curl git docker.io docker-compose mysql-server nodejs npm
sudo systemctl start docker
sudo systemctl enable docker
sudo systemctl start mysql
sudo systemctl enable mysql
```

3. **Setup MySQL database**
```bash
sudo mysql -e "CREATE DATABASE discord_bot_dashboard;"
sudo mysql -e "CREATE USER 'botdashboard'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';"
sudo mysql -e "GRANT ALL PRIVILEGES ON discord_bot_dashboard.* TO 'botdashboard'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

4. **Configure environment variables**

Create `backend/.env`:
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

DB_HOST=localhost
DB_PORT=3306
DB_NAME=discord_bot_dashboard
DB_USER=botdashboard
DB_PASSWORD=YOUR_PASSWORD

JWT_SECRET=your-secret-key-here-use-openssl-rand-base64-64
JWT_EXPIRES_IN=7d

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=your-secure-password

DOCKER_SOCKET=/var/run/docker.sock
BOTS_NETWORK=discord-bots-network
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000/api
```

5. **Install Node.js dependencies**
```bash
npm install
```

6. **Initialize database**
```bash
node backend/src/scripts/init-db.js
```

7. **Build frontend**
```bash
npm run build
```

8. **Create Docker network**
```bash
docker network create discord-bots-network
```

9. **Start the application**

For development:
```bash
npm run dev
```

For production (using systemd):
```bash
sudo cp systemd/discord-bot-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable discord-bot-dashboard
sudo systemctl start discord-bot-dashboard
```

10. **Access the dashboard**

Open your browser and navigate to:
```
http://YOUR_VPS_IP:3000
```

## Usage

### First Login

1. Open the dashboard URL in your browser
2. Login with your Super Admin credentials
3. You'll be redirected to the dashboard

### Adding a New Bot

1. Navigate to "My Bots" page
2. Click "Add New Bot"
3. Fill in the required information:
   - **Bot Name**: A friendly name for your bot
   - **Discord Bot Token**: Get this from [Discord Developer Portal](https://discord.com/developers/applications)
   - **Bot Application ID**: Also from Discord Developer Portal
   - **Description**: What your bot does (optional)
   - **Auto-restart**: Enable to automatically restart on failure
4. Click "Create Bot"

### Deploying a Bot

1. Go to your bot's detail page
2. Click "Deploy Bot"
3. Wait for the deployment to complete
4. The bot will automatically start

### Managing Bots

From the bot detail page, you can:
- **Start**: Start a stopped bot
- **Stop**: Stop a running bot
- **Restart**: Restart the bot (useful for applying updates)
- **View Logs**: See real-time logs from your bot
- **Delete**: Permanently remove the bot and its container

### Managing Users (Admin/Super Admin only)

1. Navigate to "Users" page
2. Click "Add New User"
3. Fill in user details and assign a role:
   - **User**: Can only manage their own bots
   - **Admin**: Can manage all bots and create users
   - **Super Admin**: Full access (only one, created during installation)
4. You can disable/enable or delete users from the users table

## Architecture

```
┌─────────────────────────────────────────────┐
│           React Frontend (Vite)             │
│  - Login Page                               │
│  - Dashboard                                │
│  - Bot Management                           │
│  - User Management                          │
└────────────────┬────────────────────────────┘
                 │ HTTP/REST API
┌────────────────▼────────────────────────────┐
│         Express.js Backend                  │
│  - JWT Authentication                       │
│  - API Routes                               │
│  - Docker Service                           │
└────────────┬──────────────┬─────────────────┘
             │              │
    ┌────────▼─────┐   ┌───▼──────────────┐
    │    MySQL     │   │   Docker Engine  │
    │   Database   │   │                  │
    └──────────────┘   └───┬──────────────┘
                           │
              ┌────────────┴────────────┐
              │  Discord Bot Containers │
              │  ┌─────┐ ┌─────┐ ┌─────┐
              │  │Bot 1│ │Bot 2│ │Bot 3│
              │  └─────┘ └─────┘ └─────┘
              └─────────────────────────┘
```

## Project Structure

```
discord-bot-dashboard/
├── backend/
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Auth middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── scripts/        # Utility scripts
│   │   ├── services/       # Docker service
│   │   └── server.js       # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service
│   │   ├── styles/         # CSS styles
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker/
│   └── templates/          # Bot Dockerfile templates
├── install.sh              # Automated installer
├── package.json            # Root package
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Bots
- `GET /api/bots` - List bots
- `GET /api/bots/:id` - Get bot details
- `POST /api/bots` - Create bot
- `POST /api/bots/:id/deploy` - Deploy bot
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/stop` - Stop bot
- `POST /api/bots/:id/restart` - Restart bot
- `GET /api/bots/:id/logs` - Get bot logs
- `GET /api/bots/:id/stats` - Get bot stats
- `DELETE /api/bots/:id` - Delete bot

## Service Management

### Systemd Commands

```bash
# Start the service
sudo systemctl start discord-bot-dashboard

# Stop the service
sudo systemctl stop discord-bot-dashboard

# Restart the service
sudo systemctl restart discord-bot-dashboard

# View status
sudo systemctl status discord-bot-dashboard

# View logs
sudo journalctl -u discord-bot-dashboard -f

# Enable auto-start on boot
sudo systemctl enable discord-bot-dashboard

# Disable auto-start
sudo systemctl disable discord-bot-dashboard
```

### Docker Commands

```bash
# List bot containers
docker ps -a --filter label=discord-bot-dashboard=true

# View bot logs
docker logs <container-id>

# Stop a bot container
docker stop <container-id>

# Remove a bot container
docker rm <container-id>

# List Docker network
docker network ls | grep discord-bots-network
```

## Troubleshooting

### Dashboard won't start

1. Check if all services are running:
```bash
sudo systemctl status discord-bot-dashboard
sudo systemctl status mysql
sudo systemctl status docker
```

2. Check the logs:
```bash
sudo journalctl -u discord-bot-dashboard -n 50
```

3. Verify database connection:
```bash
mysql -u botdashboard -p discord_bot_dashboard
```

### Bot deployment fails

1. Check Docker is running:
```bash
sudo systemctl status docker
docker ps
```

2. Verify Docker permissions:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

3. Check bot token is valid on [Discord Developer Portal](https://discord.com/developers/applications)

### Can't login

1. Verify database is accessible
2. Check JWT secret is set in `.env`
3. Clear browser cache and cookies
4. Try resetting your password via database:
```bash
node backend/src/scripts/reset-password.js <username>
```

### Port already in use

Change the port in `backend/.env`:
```env
PORT=3001
```

Then update the frontend API URL in `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001/api
```

## Security Considerations

1. **Change default passwords**: Always use strong, unique passwords
2. **Use HTTPS**: Set up a reverse proxy (nginx/caddy) with SSL/TLS
3. **Firewall**: Only expose necessary ports
4. **Regular updates**: Keep system and dependencies updated
5. **Backup database**: Regular MySQL backups
6. **Bot tokens**: Store securely, never commit to version control
7. **Restrict access**: Use strong passwords and limit user creation

## Production Deployment

### Using Nginx as Reverse Proxy

1. Install Nginx:
```bash
sudo apt-get install nginx certbot python3-certbot-nginx
```

2. Create Nginx config (`/etc/nginx/sites-available/discord-bot-dashboard`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/discord-bot-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. Get SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for any purpose.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/yourusername/discord-bot-dashboard).

## Changelog

### v1.0.0 (Initial Release)
- User authentication and management
- Discord bot deployment via Docker
- Real-time bot monitoring and logs
- Role-based access control
- Automated installation script
