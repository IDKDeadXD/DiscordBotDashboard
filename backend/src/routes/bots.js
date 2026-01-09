const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const dockerService = require('../services/dockerService');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        let query = `
            SELECT b.*, u.username as owner_username
            FROM discord_bots b
            JOIN users u ON b.owner_id = u.id
        `;
        const params = [];

        if (req.user.role === 'user') {
            query += ' WHERE b.owner_id = ?';
            params.push(req.user.id);
        }

        query += ' ORDER BY b.created_at DESC';

        const [bots] = await pool.query(query, params);

        res.json({ bots });
    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ error: 'Failed to fetch bots' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query(
            `SELECT b.*, u.username as owner_username
             FROM discord_bots b
             JOIN users u ON b.owner_id = u.id
             WHERE b.id = ?`,
            [id]
        );

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [settings] = await pool.query(
            'SELECT setting_key, setting_value FROM bot_settings WHERE bot_id = ?',
            [id]
        );

        bot.settings = settings.reduce((acc, s) => {
            acc[s.setting_key] = s.setting_value;
            return acc;
        }, {});

        if (bot.container_id) {
            try {
                const status = await dockerService.getContainerStatus(bot.container_id);
                bot.container_status = status;
            } catch (error) {
                bot.container_status = { status: 'error' };
            }
        }

        res.json({ bot });
    } catch (error) {
        console.error('Get bot error:', error);
        res.status(500).json({ error: 'Failed to fetch bot' });
    }
});

router.post('/', [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name required (1-100 chars)'),
    body('token').trim().notEmpty().withMessage('Discord bot token required'),
    body('bot_id').trim().notEmpty().withMessage('Discord bot ID required'),
    body('description').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, token, bot_id, description, auto_restart = true } = req.body;

    try {
        const [existing] = await pool.query(
            'SELECT id FROM discord_bots WHERE bot_id = ?',
            [bot_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Bot ID already exists' });
        }

        const [result] = await pool.query(
            `INSERT INTO discord_bots (name, token, bot_id, description, owner_id, auto_restart, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, token, bot_id, description, req.user.id, auto_restart, 'stopped']
        );

        res.status(201).json({
            message: 'Bot created successfully',
            bot: {
                id: result.insertId,
                name,
                bot_id,
                description,
                status: 'stopped'
            }
        });
    } catch (error) {
        console.error('Create bot error:', error);
        res.status(500).json({ error: 'Failed to create bot' });
    }
});

router.post('/:id/deploy', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query(
            'SELECT * FROM discord_bots WHERE id = ?',
            [id]
        );

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.query(
            'UPDATE discord_bots SET status = ? WHERE id = ?',
            ['deploying', id]
        );

        const [settings] = await pool.query(
            'SELECT setting_key, setting_value FROM bot_settings WHERE bot_id = ?',
            [id]
        );

        bot.settings = settings.reduce((acc, s) => {
            acc[s.setting_key] = s.setting_value;
            return acc;
        }, {});

        const { containerId, containerName } = await dockerService.createBotContainer({
            bot_id: bot.bot_id,
            name: bot.name,
            token: bot.token,
            owner_id: bot.owner_id,
            auto_restart: bot.auto_restart,
            settings: bot.settings
        });

        await dockerService.startContainer(containerId);

        await pool.query(
            'UPDATE discord_bots SET container_id = ?, container_name = ?, status = ? WHERE id = ?',
            [containerId, containerName, 'running', id]
        );

        await pool.query(
            'INSERT INTO bot_deployments (bot_id, deployed_by, status, message) VALUES (?, ?, ?, ?)',
            [id, req.user.id, 'success', 'Bot deployed successfully']
        );

        res.json({ message: 'Bot deployed successfully' });
    } catch (error) {
        console.error('Deploy bot error:', error);

        await pool.query(
            'UPDATE discord_bots SET status = ? WHERE id = ?',
            ['error', id]
        );

        await pool.query(
            'INSERT INTO bot_deployments (bot_id, deployed_by, status, message) VALUES (?, ?, ?, ?)',
            [id, req.user.id, 'failed', error.message]
        );

        res.status(500).json({ error: 'Failed to deploy bot' });
    }
});

router.post('/:id/start', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query('SELECT * FROM discord_bots WHERE id = ?', [id]);

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!bot.container_id) {
            return res.status(400).json({ error: 'Bot not deployed yet. Deploy first.' });
        }

        await dockerService.startContainer(bot.container_id);
        await pool.query('UPDATE discord_bots SET status = ? WHERE id = ?', ['running', id]);

        res.json({ message: 'Bot started successfully' });
    } catch (error) {
        console.error('Start bot error:', error);
        res.status(500).json({ error: 'Failed to start bot' });
    }
});

router.post('/:id/stop', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query('SELECT * FROM discord_bots WHERE id = ?', [id]);

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!bot.container_id) {
            return res.status(400).json({ error: 'Bot not deployed' });
        }

        await dockerService.stopContainer(bot.container_id);
        await pool.query('UPDATE discord_bots SET status = ? WHERE id = ?', ['stopped', id]);

        res.json({ message: 'Bot stopped successfully' });
    } catch (error) {
        console.error('Stop bot error:', error);
        res.status(500).json({ error: 'Failed to stop bot' });
    }
});

router.post('/:id/restart', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query('SELECT * FROM discord_bots WHERE id = ?', [id]);

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!bot.container_id) {
            return res.status(400).json({ error: 'Bot not deployed' });
        }

        await dockerService.restartContainer(bot.container_id);

        res.json({ message: 'Bot restarted successfully' });
    } catch (error) {
        console.error('Restart bot error:', error);
        res.status(500).json({ error: 'Failed to restart bot' });
    }
});

router.get('/:id/logs', async (req, res) => {
    const { id } = req.params;
    const tail = parseInt(req.query.tail) || 100;

    try {
        const [bots] = await pool.query('SELECT * FROM discord_bots WHERE id = ?', [id]);

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!bot.container_id) {
            return res.status(400).json({ error: 'Bot not deployed' });
        }

        const logs = await dockerService.getContainerLogs(bot.container_id, tail);

        res.json({ logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

router.get('/:id/stats', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query('SELECT * FROM discord_bots WHERE id = ?', [id]);

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!bot.container_id) {
            return res.status(400).json({ error: 'Bot not deployed' });
        }

        const stats = await dockerService.getContainerStats(bot.container_id);

        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [bots] = await pool.query('SELECT * FROM discord_bots WHERE id = ?', [id]);

        if (bots.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const bot = bots[0];

        if (req.user.role === 'user' && bot.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (bot.container_id) {
            try {
                await dockerService.removeContainer(bot.container_id);
            } catch (error) {
                console.error('Error removing container:', error);
            }
        }

        await pool.query('DELETE FROM discord_bots WHERE id = ?', [id]);

        res.json({ message: 'Bot deleted successfully' });
    } catch (error) {
        console.error('Delete bot error:', error);
        res.status(500).json({ error: 'Failed to delete bot' });
    }
});

module.exports = router;
