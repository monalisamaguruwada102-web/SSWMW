const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

function generateOrderNumber() {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${prefix}-${timestamp}-${rand}`;
}

// GET /api/orders
router.get('/', requireAuth, async (req, res) => {
    const { status, type } = req.query;
    let sql = `
        SELECT o.*,
               u1.username as created_by_name,
               u2.username as approved_by_name,
               COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN users u1 ON o.created_by = u1.id
        LEFT JOIN users u2 ON o.approved_by = u2.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1
    `;
    const params = [];
    if (status) {
        sql += ` AND o.status = $${params.length + 1}`;
        params.push(status);
    }
    if (type) {
        sql += ` AND o.type = $${params.length + 1}`;
        params.push(type);
    }
    sql += ' GROUP BY o.id, u1.username, u2.username ORDER BY o.created_at DESC';
    res.json({ orders: await getAll(sql, params) });
});

// GET /api/orders/:id
router.get('/:id', requireAuth, async (req, res) => {
    const order = await getOne(`
        SELECT o.*, u1.username as created_by_name, u2.username as approved_by_name
        FROM orders o
        LEFT JOIN users u1 ON o.created_by = u1.id
        LEFT JOIN users u2 ON o.approved_by = u2.id
        WHERE o.id = $1
    `, [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = await getAll(`
        SELECT oi.*, p.name as product_name, p.sku, p.unit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
    `, [req.params.id]);
    res.json({ order, items });
});

// POST /api/orders
router.post('/', requireAuth, async (req, res) => {
    const { type, notes, items } = req.body;
    if (!type || !items || !items.length) {
        return res.status(400).json({ error: 'Type and at least one item required' });
    }
    const orderNumber = generateOrderNumber();
    const orderId = await runInsert(
        'INSERT INTO orders (order_number, type, notes, created_by) VALUES ($1,$2,$3,$4)',
        [orderNumber, type, notes || '', req.user.id]
    );
    for (const item of items) {
        await runInsert('INSERT INTO order_items (order_id, product_id, quantity_requested, notes) VALUES ($1,$2,$3,$4)',
            [orderId, item.product_id, item.quantity, item.notes || '']);
    }
    res.status(201).json({ id: orderId, order_number: orderNumber });
});

// PUT /api/orders/:id/status
router.put('/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only admin can approve
    if (status === 'approved' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can approve orders' });
    }

    const updates = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
    const params = [status];

    if (status === 'approved') {
        updates.push(`approved_by = $${params.length + 1}`);
        params.push(req.user.id);
    }

    params.push(req.params.id);
    await runQuery(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ message: `Order ${status}` });
});

module.exports = router;
