const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/movements
router.get('/', requireAuth, (req, res) => {
    const { type, product_id, limit = 50, offset = 0 } = req.query;
    let sql = `
        SELECT m.*,
               p.name as product_name, p.sku, p.unit,
               fl.section as from_section, fl.rack as from_rack, fl.shelf as from_shelf,
               tl.section as to_section, tl.rack as to_rack, tl.shelf as to_shelf,
               u.username
        FROM movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN storage_locations fl ON m.from_location_id = fl.id
        LEFT JOIN storage_locations tl ON m.to_location_id = tl.id
        LEFT JOIN users u ON m.user_id = u.id
        WHERE 1=1
    `;
    const params = [];
    if (type) { sql += ' AND m.type = ?'; params.push(type); }
    if (product_id) { sql += ' AND m.product_id = ?'; params.push(product_id); }
    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    res.json({ movements: getAll(sql, params) });
});

// GET /api/movements/:id
router.get('/:id', requireAuth, (req, res) => {
    const movement = getOne(`
        SELECT m.*, p.name as product_name, p.sku, p.unit,
               fl.section as from_section, fl.rack as from_rack, fl.shelf as from_shelf,
               tl.section as to_section, tl.rack as to_rack, tl.shelf as to_shelf,
               u.username
        FROM movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN storage_locations fl ON m.from_location_id = fl.id
        LEFT JOIN storage_locations tl ON m.to_location_id = tl.id
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
    `, [req.params.id]);
    if (!movement) return res.status(404).json({ error: 'Movement not found' });
    res.json({ movement });
});

// POST /api/movements
router.post('/', requireAuth, (req, res) => {
    const { type, product_id, from_location_id, to_location_id, quantity, reference_number, supplier_or_customer, notes } = req.body;

    if (!type || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Type, product, and positive quantity required' });
    }
    if (!['incoming', 'outgoing', 'transfer'].includes(type)) {
        return res.status(400).json({ error: 'Invalid movement type' });
    }

    // Validate based on type
    if (type === 'incoming' && !to_location_id) {
        return res.status(400).json({ error: 'Destination location required for incoming' });
    }
    if (type === 'outgoing' && !from_location_id) {
        return res.status(400).json({ error: 'Source location required for outgoing' });
    }
    if (type === 'transfer' && (!from_location_id || !to_location_id)) {
        return res.status(400).json({ error: 'Source and destination required for transfer' });
    }

    // Validate source has enough stock for outgoing/transfer
    if (type === 'outgoing' || type === 'transfer') {
        const sourceInv = getOne('SELECT * FROM inventory WHERE product_id = ? AND location_id = ?', [product_id, from_location_id]);
        if (!sourceInv || sourceInv.quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock at source location' });
        }
    }

    // Record movement
    const movId = runInsert(
        'INSERT INTO movements (type, product_id, from_location_id, to_location_id, quantity, reference_number, supplier_or_customer, notes, user_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [type, product_id, from_location_id || null, to_location_id || null, quantity, reference_number || null, supplier_or_customer || null, notes || null, req.user.id]
    );

    // Update inventory
    if (type === 'incoming') {
        const inv = getOne('SELECT * FROM inventory WHERE product_id = ? AND location_id = ?', [product_id, to_location_id]);
        if (inv) {
            runQuery('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime(\'now\') WHERE id = ?', [quantity, inv.id]);
            runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
                [product_id, to_location_id, 'incoming', inv.quantity, inv.quantity + quantity, `Ref: ${reference_number || '-'}`, req.user.id]);
        } else {
            runInsert('INSERT INTO inventory (product_id, location_id, quantity) VALUES (?,?,?)', [product_id, to_location_id, quantity]);
            runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
                [product_id, to_location_id, 'incoming', 0, quantity, `Ref: ${reference_number || '-'}`, req.user.id]);
        }
    } else if (type === 'outgoing') {
        const inv = getOne('SELECT * FROM inventory WHERE product_id = ? AND location_id = ?', [product_id, from_location_id]);
        runQuery('UPDATE inventory SET quantity = quantity - ?, updated_at = datetime(\'now\') WHERE id = ?', [quantity, inv.id]);
        runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
            [product_id, from_location_id, 'outgoing', inv.quantity, inv.quantity - quantity, notes || null, req.user.id]);
    } else if (type === 'transfer') {
        const srcInv = getOne('SELECT * FROM inventory WHERE product_id = ? AND location_id = ?', [product_id, from_location_id]);
        runQuery('UPDATE inventory SET quantity = quantity - ?, updated_at = datetime(\'now\') WHERE id = ?', [quantity, srcInv.id]);
        runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
            [product_id, from_location_id, 'transfer_out', srcInv.quantity, srcInv.quantity - quantity, notes || null, req.user.id]);

        const dstInv = getOne('SELECT * FROM inventory WHERE product_id = ? AND location_id = ?', [product_id, to_location_id]);
        if (dstInv) {
            runQuery('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime(\'now\') WHERE id = ?', [quantity, dstInv.id]);
            runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
                [product_id, to_location_id, 'transfer_in', dstInv.quantity, dstInv.quantity + quantity, notes || null, req.user.id]);
        } else {
            runInsert('INSERT INTO inventory (product_id, location_id, quantity) VALUES (?,?,?)', [product_id, to_location_id, quantity]);
            runInsert('INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
                [product_id, to_location_id, 'transfer_in', 0, quantity, notes || null, req.user.id]);
        }
    }

    res.status(201).json({ id: movId, message: 'Movement recorded successfully' });
});

module.exports = router;
