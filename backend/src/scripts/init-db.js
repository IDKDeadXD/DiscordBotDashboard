const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'admin', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- Discord Bots table
CREATE TABLE IF NOT EXISTS discord_bots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    token VARCHAR(255) NOT NULL,
    bot_id VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    owner_id INT NOT NULL,
    container_id VARCHAR(255),
    container_name VARCHAR(255),
    status ENUM('stopped', 'running', 'error', 'deploying') DEFAULT 'stopped',
    auto_restart BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id),
    INDEX idx_status (status)
);

-- Bot Settings table (for custom configuration)
CREATE TABLE IF NOT EXISTS bot_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES discord_bots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bot_setting (bot_id, setting_key)
);

-- Bot Logs table
CREATE TABLE IF NOT EXISTS bot_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    log_level ENUM('info', 'warn', 'error', 'debug') DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES discord_bots(id) ON DELETE CASCADE,
    INDEX idx_bot_time (bot_id, created_at)
);

-- User Sessions table (for JWT token management)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at)
);

-- Bot Deployments history table
CREATE TABLE IF NOT EXISTS bot_deployments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    deployed_by INT NOT NULL,
    version VARCHAR(50),
    status ENUM('success', 'failed') NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES discord_bots(id) ON DELETE CASCADE,
    FOREIGN KEY (deployed_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_bot (bot_id),
    INDEX idx_status (status)
);
`;

async function initializeDatabase() {
    let connection;

    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ Connected to MySQL database');

        console.log('Creating database schema...');
        const statements = schema.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
            }
        }
        console.log('✓ Database schema created');

        // Check if super admin exists
        const [users] = await connection.query('SELECT COUNT(*) as count FROM users WHERE role = ?', ['super_admin']);

        if (users[0].count === 0) {
            console.log('Creating Super Admin account...');

            const username = process.env.SUPER_ADMIN_USERNAME;
            const email = process.env.SUPER_ADMIN_EMAIL;
            const password = process.env.SUPER_ADMIN_PASSWORD;

            if (!username || !email || !password) {
                throw new Error('Super Admin credentials not found in environment variables');
            }

            const passwordHash = await bcrypt.hash(password, 12);

            await connection.query(
                'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
                [username, email, passwordHash, 'super_admin']
            );

            console.log('✓ Super Admin account created');
            console.log(`  Username: ${username}`);
            console.log(`  Email: ${email}`);
        } else {
            console.log('✓ Super Admin account already exists');
        }

        console.log('✓ Database initialization complete');

    } catch (error) {
        console.error('✗ Database initialization failed:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };
