const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function generateGRNNumber() {
    return 'GRN-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 100).toString().padStart(2, '0');
}

// GET /api/grn
router.get('/', requireAuth, async (req, res) => {
    const grns = await getAll(`
        SELECT g.*, o.order_number, u.username as received_by_name,
               COUNT(gi.id) as item_count
        FROM grn g
        LEFT JOIN orders o ON g.order_id = o.id
        LEFT JOIN users u ON g.received_by = u.id
        LEFT JOIN grn_items gi ON g.id = gi.grn_id
        GROUP BY g.id, o.order_number, u.username
        ORDER BY g.created_at DESC
    `);
    res.json({ grns });
});

// GET /api/grn/:id
router.get('/:id', requireAuth, async (req, res) => {
    const grn = await getOne(`
        SELECT g.*, o.order_number, u.username as received_by_name
        FROM grn g
        LEFT JOIN orders o ON g.order_id = o.id
        LEFT JOIN users u ON g.received_by = u.id
        WHERE g.id = $1
    `, [req.params.id]);

    if (!grn) return res.status(404).json({ error: 'GRN not found' });

    const items = await getAll(`
        SELECT gi.*, p.name as product_name, p.sku, p.unit
        FROM grn_items gi
        JOIN products p ON gi.product_id = p.id
        WHERE gi.grn_id = $1
    `, [req.params.id]);

    res.json({ grn, items });
});

// POST /api/grn (Receive Goods)
router.post('/', requireAuth, async (req, res) => {
    const { order_id, supplier_name, reference_number, notes, items, receive_to_location_id } = req.body;

    if (!items || !items.length || !receive_to_location_id) {
        return res.status(400).json({ error: 'Items and a receiving storage location are required' });
    }

    const grnNumber = generateGRNNumber();

    const grnId = await runInsert(
        'INSERT INTO grn (grn_number, order_id, supplier_name, reference_number, notes, received_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [grnNumber, order_id || null, supplier_name || '', reference_number || '', notes || '', req.user.id]
    );

    for (const item of items) {
        // Insert GRN Item
        await runInsert(
            'INSERT INTO grn_items (grn_id, product_id, quantity_ordered, quantity_received, condition) VALUES ($1,$2,$3,$4,$5)',
            [grnId, item.product_id, item.quantity_ordered, item.quantity_received, item.condition || 'Good']
        );

        // Auto-update Inventory
        if (item.quantity_received > 0) {
            const inv = await getOne('SELECT * FROM inventory WHERE product_id = $1 AND location_id = $2', [item.product_id, receive_to_location_id]);
            if (inv) {
                await runQuery('UPDATE inventory SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [item.quantity_received, inv.id]);
                await runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                    [item.product_id, receive_to_location_id, 'incoming', inv.quantity, inv.quantity + item.quantity_received, `GRN: ${grnNumber}`, req.user.id]);
            } else {
                await runInsert('INSERT INTO inventory (product_id, location_id, quantity) VALUES ($1,$2,$3)', [item.product_id, receive_to_location_id, item.quantity_received]);
                await runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                    [item.product_id, receive_to_location_id, 'incoming', 0, item.quantity_received, `GRN: ${grnNumber}`, req.user.id]);
            }
        }
    }

    // Auto-update Order status if an order was linked
    if (order_id) {
        await runQuery("UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [order_id]);
    }

    res.status(201).json({ id: grnId, grn_number: grnNumber, message: 'Goods received and inventory updated' });
});

module.exports = router;
