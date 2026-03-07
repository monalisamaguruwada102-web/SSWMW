const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getOne, runQuery } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await getOne('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await runQuery('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?', [user.id]);

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        sameSite: 'lax'
    });

    res.json({
        user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getOne('SELECT id, username, email, role, last_login FROM users WHERE id = ?', [decoded.id]);
        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json({ user });
    } catch {
        res.status(403).json({ error: 'Invalid token' });
    }
});

module.exports = router;
