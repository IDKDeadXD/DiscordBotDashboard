const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', requireRole('super_admin', 'admin'), async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
        );

        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.post('/', requireRole('super_admin', 'admin'), [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['user', 'admin']).withMessage('Role must be user or admin')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body;

    if (req.user.role === 'admin' && role === 'admin') {
        return res.status(403).json({ error: 'Only super admins can create admin users' });
    }

    try {
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, passwordHash, role]
        );

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: result.insertId,
                username,
                email,
                role
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.patch('/:id', requireRole('super_admin', 'admin'), async (req, res) => {
    const { id } = req.params;
    const { is_active, role } = req.body;

    try {
        const [targetUser] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);

        if (targetUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user.role === 'admin' && (targetUser[0].role === 'super_admin' || role === 'super_admin')) {
            return res.status(403).json({ error: 'Admins cannot modify super admin users' });
        }

        const updates = [];
        const values = [];

        if (typeof is_active === 'boolean') {
            updates.push('is_active = ?');
            values.push(is_active);
        }

        if (role && ['user', 'admin'].includes(role)) {
            if (req.user.role !== 'super_admin' && role === 'admin') {
                return res.status(403).json({ error: 'Only super admins can grant admin role' });
            }
            updates.push('role = ?');
            values.push(role);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        values.push(id);

        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/:id', requireRole('super_admin'), async (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    try {
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
