const express = require('express');
const router = express.Router();
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// Get all transfers
router.get('/', authenticateToken, async (req, res) => {
    const transfers = await getAll(`
        SELECT t.*, 
               fw.name as from_warehouse_name, 
               tw.name as to_warehouse_name,
               u.username as created_by_name,
               (SELECT COUNT(*) FROM transfer_items WHERE transfer_id = t.id) as item_count
        FROM transfers t
        JOIN warehouses fw ON t.from_warehouse_id = fw.id
        JOIN warehouses tw ON t.to_warehouse_id = tw.id
        LEFT JOIN users u ON t.created_by = u.id
        ORDER BY t.created_at DESC
    `);
    res.json({ transfers });
});

// Get transfer details
router.get('/:id', authenticateToken, async (req, res) => {
    const transfer = await getOne(`
        SELECT t.*, 
               fw.name as from_warehouse_name, 
               tw.name as to_warehouse_name,
               u.username as created_by_name
        FROM transfers t
        JOIN warehouses fw ON t.from_warehouse_id = fw.id
        JOIN warehouses tw ON t.to_warehouse_id = tw.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = $1
    `, [req.params.id]);

    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    const items = await getAll(`
        SELECT ti.*, p.name as product_name, p.sku
        FROM transfer_items ti
        JOIN products p ON ti.product_id = p.id
        WHERE ti.transfer_id = $1
    `, [req.params.id]);

    res.json({ transfer, items });
});

// Create new transfer
router.post('/', authenticateToken, async (req, res) => {
    const { from_warehouse_id, to_warehouse_id, notes, items } = req.body;

    if (!from_warehouse_id || !to_warehouse_id || !items || !items.length) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const transfer_number = 'TRF-' + Date.now();

    const transferId = await runInsert(`
        INSERT INTO transfers (transfer_number, from_warehouse_id, to_warehouse_id, notes, created_by, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [transfer_number, from_warehouse_id, to_warehouse_id, notes, req.user.id]);

    for (const item of items) {
        await runInsert(`
            INSERT INTO transfer_items (transfer_id, product_id, quantity)
            VALUES ($1, $2, $3)
        `, [transferId, item.product_id, item.quantity]);
    }

    res.status(201).json({ id: transferId, transfer_number });
});

// Update transfer status
router.put('/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const transferId = req.params.id;

    const transfer = await getOne('SELECT * FROM transfers WHERE id = $1', [transferId]);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    // Logical check: if status is 'completed', we should move the stock
    if (status === 'completed' && transfer.status !== 'completed') {
        const items = await getAll('SELECT * FROM transfer_items WHERE transfer_id = $1', [transferId]);

        for (const item of items) {
            // Check if stock exists at source warehouse (Simplified: we reduce from ANY location in that warehouse)
            // In a real system, we'd pick a specific bin. Here we'll just log the logic.

            // 1. Record movements
            await runInsert(`
                INSERT INTO movements (type, product_id, quantity, reference_number, notes, user_id, status)
                VALUES ('transfer', $1, $2, $3, $4, $5, 'completed')
            `, [item.product_id, item.quantity, transfer.transfer_number, `Transfer from ${transfer.from_warehouse_id} to ${transfer.to_warehouse_id}`, req.user.id]);
        }
    }

    await runQuery('UPDATE transfers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, transferId]);
    res.json({ success: true });
});

module.exports = router;
