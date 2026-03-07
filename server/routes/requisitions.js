const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function generateReqNumber() {
    return 'REQ-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 100).toString().padStart(2, '0');
}

// GET /api/requisitions
router.get('/', requireAuth, async (req, res) => {
    const { status } = req.query;
    let sql = `
        SELECT r.*, u1.username as raised_by_name, u2.username as buyer_name,
               COUNT(ri.id) as item_count
        FROM requisitions r
        LEFT JOIN users u1 ON r.raised_by = u1.id
        LEFT JOIN users u2 ON r.buyer_id = u2.id
        LEFT JOIN requisition_items ri ON r.id = ri.req_id
        WHERE 1=1
    `;
    const params = [];
    if (status) {
        sql += ' AND r.status = $1';
        params.push(status);
    }
    sql += ' GROUP BY r.id, u1.username, u2.username ORDER BY r.created_at DESC';

    res.json({ requisitions: await getAll(sql, params) });
});

// GET /api/requisitions/:id
router.get('/:id', requireAuth, async (req, res) => {
    const requisition = await getOne(`
        SELECT r.*, u1.username as raised_by_name, u2.username as buyer_name
        FROM requisitions r
        LEFT JOIN users u1 ON r.raised_by = u1.id
        LEFT JOIN users u2 ON r.buyer_id = u2.id
        WHERE r.id = $1
    `, [req.params.id]);

    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });

    const items = await getAll(`
        SELECT ri.*, p.name as product_name, p.sku
        FROM requisition_items ri
        LEFT JOIN products p ON ri.product_id = p.id
        WHERE ri.req_id = $1
    `, [req.params.id]);

    res.json({ requisition, items });
});

// POST /api/requisitions
router.post('/', requireAuth, async (req, res) => {
    const { notes, items } = req.body;

    if (!items || !items.length) {
        return res.status(400).json({ error: 'At least one item is required to raise a requisition' });
    }

    const reqNumber = generateReqNumber();

    const reqId = await runInsert(
        'INSERT INTO requisitions (req_number, notes, raised_by) VALUES ($1,$2,$3)',
        [reqNumber, notes || '', req.user.id]
    );

    for (const item of items) {
        await runInsert(
            'INSERT INTO requisition_items (req_id, description, quantity, uom, estimated_cost, product_id) VALUES ($1,$2,$3,$4,$5,$6)',
            [reqId, item.description, item.quantity, item.uom, item.estimated_cost || 0, item.product_id || null]
        );
    }

    res.status(201).json({ id: reqId, req_number: reqNumber, message: 'Requisition raised successfully' });
});

// PUT /api/requisitions/:id/status
router.put('/:id/status', requireAuth, async (req, res) => {
    const { status, buyer_id } = req.body;
    const validStatuses = ['pending', 'rfq', 'approved', 'po_issued', 'paid', 'closed', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const requisition = await getOne('SELECT * FROM requisitions WHERE id = $1', [req.params.id]);
    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });

    // Only admin can approve or assign buyers
    if ((status === 'approved' || buyer_id) && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can approve requisitions or assign buyers' });
    }

    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    let paramIndex = 2;

    if (buyer_id) {
        updates.push(`buyer_id = $${paramIndex}`);
        params.push(buyer_id);
    }

    params.push(req.params.id);
    await runQuery(`UPDATE requisitions SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

    res.json({ message: `Requisition marked as ${status}` });
});

module.exports = router;
