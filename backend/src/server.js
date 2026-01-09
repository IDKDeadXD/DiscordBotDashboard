require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { testConnection } = require('./config/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const botRoutes = require('./routes/bots');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later'
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bots', botRoutes);

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

async function startServer() {
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.error('Failed to connect to database. Exiting...');
        process.exit(1);
    }

    app.listen(PORT, HOST, () => {
        console.log('╔══════════════════════════════════════════════════════╗');
        console.log('║     Discord Bot Dashboard - Server Running          ║');
        console.log('╚══════════════════════════════════════════════════════╝');
        console.log(`\n✓ Server: http://${HOST}:${PORT}`);
        console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`✓ Database: Connected`);
        console.log('\n Press Ctrl+C to stop\n');
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
