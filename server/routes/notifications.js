const express = require('express');
const { getAll, runInsert, runQuery } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, (req, res) => {
    const notifications = getAll(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [req.user.id]
    );
    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unreadCount });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, (req, res) => {
    runQuery('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Marked as read' });
});

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, (req, res) => {
    runQuery('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
});

module.exports = router;
