const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory
router.get('/', requireAuth, async (req, res) => {
    const { category_id, location_id, status } = req.query;
    let sql = `
        SELECT i.*, p.name as product_name, p.sku, p.unit, p.min_stock_level,
               c.name as category_name, c.color as category_color,
               sl.section, sl.rack, sl.shelf
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        JOIN storage_locations sl ON i.location_id = sl.id
        WHERE 1=1
    `;
    const params = [];
    if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
    if (location_id) { sql += ' AND i.location_id = ?'; params.push(location_id); }
    if (status === 'low') sql += ' AND i.quantity > 0 AND i.quantity <= p.min_stock_level';
    else if (status === 'out') sql += ' AND i.quantity = 0';
    else if (status === 'ok') sql += ' AND i.quantity > p.min_stock_level';
    sql += ' ORDER BY p.name';
    res.json({ inventory: await getAll(sql, params) });
});

// GET /api/inventory/low-stock
router.get('/low-stock', requireAuth, async (req, res) => {
    const items = await getAll(`
        SELECT p.id as product_id, p.name as product_name, p.sku, p.min_stock_level,
               COALESCE(SUM(i.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        GROUP BY p.id
        HAVING COALESCE(SUM(i.quantity), 0) <= p.min_stock_level
        ORDER BY total_stock ASC
    `);
    res.json({ items });
});

// GET /api/inventory/history
router.get('/history', requireAuth, async (req, res) => {
    const { product_id, limit = 50 } = req.query;
    let sql = `
        SELECT ih.*, p.name as product_name, p.sku,
               sl.section, sl.rack, sl.shelf,
               u.username
        FROM inventory_history ih
        JOIN products p ON ih.product_id = p.id
        LEFT JOIN storage_locations sl ON ih.location_id = sl.id
        LEFT JOIN users u ON ih.user_id = u.id
        WHERE 1=1
    `;
    const params = [];
    if (product_id) { sql += ' AND ih.product_id = ?'; params.push(product_id); }
    sql += ' ORDER BY ih.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    res.json({ history: await getAll(sql, params) });
});

// PUT /api/inventory/:id — manual adjustment
router.put('/:id', requireAuth, async (req, res) => {
    const { quantity, notes } = req.body;
    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ error: 'Valid quantity required' });
    }
    const inv = await getOne('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    if (!inv) return res.status(404).json({ error: 'Inventory record not found' });

    const before = inv.quantity;
    await runQuery('UPDATE inventory SET quantity=?, updated_at=datetime(\'now\') WHERE id=?', [quantity, req.params.id]);

    // Log history
    await runInsert(
        'INSERT INTO inventory_history (product_id, location_id, change_type, quantity_before, quantity_after, notes, user_id) VALUES (?,?,?,?,?,?,?)',
        [inv.product_id, inv.location_id, 'adjustment', before, quantity, notes || 'Manual adjustment', req.user.id]
    );

    // Check for low stock and notify admins
    const product = await getOne('SELECT * FROM products WHERE id = ?', [inv.product_id]);
    if (product && quantity <= product.min_stock_level && quantity > 0) {
        const admins = await getAll('SELECT id FROM users WHERE role = \'admin\' AND is_active = 1');
        for (const admin of admins) {
            await runInsert(
                'INSERT INTO notifications (type, title, message, user_id) VALUES (?,?,?,?)',
                ['low_stock', 'Low Stock Alert', `${product.name} is below minimum level (${quantity}/${product.min_stock_level})`, admin.id]
            );
        }
    }

    res.json({ message: 'Stock updated', quantity });
});

// POST /api/inventory — add new inventory record
router.post('/', requireAuth, async (req, res) => {
    const { product_id, location_id, quantity } = req.body;
    if (!product_id || !location_id) return res.status(400).json({ error: 'Product and location required' });
    const existing = await getOne('SELECT id FROM inventory WHERE product_id = ? AND location_id = ?', [product_id, location_id]);
    if (existing) return res.status(409).json({ error: 'Inventory record already exists for this product/location' });
    const id = await runInsert('INSERT INTO inventory (product_id, location_id, quantity) VALUES (?,?,?)', [product_id, location_id, quantity || 0]);
    res.status(201).json({ id });
});

module.exports = router;
