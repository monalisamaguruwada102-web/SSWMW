const express = require('express');
const bcrypt = require('bcryptjs');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', requireAdmin, (req, res) => {
    const users = getAll('SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC');
    res.json({ users });
});

// POST /api/users
router.post('/', requireAdmin, (req, res) => {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields required' });
    }
    if (!['admin', 'staff'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    const existing = getOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
        return res.status(409).json({ error: 'Username or email already exists' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const id = runInsert('INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)', [username, email, hash, role]);
    res.status(201).json({ user: { id, username, email, role } });
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, email, role, password } = req.body;
    const user = getOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (password) {
        const hash = bcrypt.hashSync(password, 10);
        runQuery('UPDATE users SET username=?, email=?, role=?, password_hash=? WHERE id=?',
            [username || user.username, email || user.email, role || user.role, hash, id]);
    } else {
        runQuery('UPDATE users SET username=?, email=?, role=? WHERE id=?',
            [username || user.username, email || user.email, role || user.role, id]);
    }
    res.json({ message: 'User updated' });
});

// DELETE /api/users/:id (deactivate)
router.delete('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    runQuery('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'User deactivated' });
});

module.exports = router;
