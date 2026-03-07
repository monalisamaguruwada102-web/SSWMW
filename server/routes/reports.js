const express = require('express');
const { getAll, getOne } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/inventory
router.get('/inventory', requireAuth, async (req, res) => {
    const data = await getAll(`
        SELECT p.name, p.sku, p.unit, p.min_stock_level,
               c.name as category,
               sl.section, sl.rack, sl.shelf,
               i.quantity,
               CASE WHEN i.quantity = 0 THEN 'Out of Stock'
                    WHEN i.quantity <= p.min_stock_level THEN 'Low Stock'
                    ELSE 'OK' END as status,
               i.updated_at
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        JOIN storage_locations sl ON i.location_id = sl.id
        ORDER BY p.name
    `);
    res.json({ data });
});

// GET /api/reports/movements
router.get('/movements', requireAuth, async (req, res) => {
    const { from, to } = req.query;
    let sql = `
        SELECT m.type, m.quantity, m.reference_number, m.supplier_or_customer, m.notes, m.created_at,
               p.name as product, p.sku,
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
    if (from) {
        sql += ` AND m.created_at >= $${params.length + 1}`;
        params.push(from);
    }
    if (to) {
        sql += ` AND m.created_at <= $${params.length + 1}`;
        params.push(to + ' 23:59:59');
    }
    sql += ' ORDER BY m.created_at DESC';
    res.json({ data: await getAll(sql, params) });
});

// GET /api/reports/low-stock
router.get('/low-stock', requireAuth, async (req, res) => {
    const data = await getAll(`
        SELECT p.name, p.sku, p.unit, p.min_stock_level,
               c.name as category,
               COALESCE(SUM(i.quantity), 0) as total_stock,
               COALESCE(SUM(i.quantity), 0) - p.min_stock_level as deficit
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        GROUP BY p.id, c.name
        HAVING COALESCE(SUM(i.quantity), 0) <= p.min_stock_level
        ORDER BY deficit ASC
    `);
    res.json({ data });
});

// GET /api/reports/activity
router.get('/activity', requireAuth, async (req, res) => {
    const { from, to, limit = 100 } = req.query;
    let sql = `
        SELECT al.*, u.username
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
    `;
    const params = [];
    if (from) {
        sql += ` AND al.created_at >= $${params.length + 1}`;
        params.push(from);
    }
    if (to) {
        sql += ` AND al.created_at <= $${params.length + 1}`;
        params.push(to + ' 23:59:59');
    }
    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    res.json({ data: await getAll(sql, params) });
});

// GET /api/reports/dashboard-stats
router.get('/dashboard-stats', requireAuth, async (req, res) => {
    const totalProducts = await getOne('SELECT COUNT(*) as count FROM products');
    const totalStock = await getOne('SELECT COALESCE(SUM(quantity), 0) as sum FROM inventory');
    const lowStockCount = await getOne(`
        SELECT COUNT(*) as count FROM (
            SELECT p.id FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            GROUP BY p.id HAVING COALESCE(SUM(i.quantity), 0) <= p.min_stock_level
        ) AS subq
    `);
    const outOfStockCount = await getOne(`
        SELECT COUNT(*) as count FROM (
            SELECT p.id FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            GROUP BY p.id HAVING COALESCE(SUM(i.quantity), 0) = 0
        ) AS subq
    `);
    const pendingOrders = await getOne('SELECT COUNT(*) as count FROM orders WHERE status = \'pending\'');
    const recentMovements = await getAll(`
        SELECT m.type, m.quantity, m.created_at, p.name as product_name
        FROM movements m JOIN products p ON m.product_id = p.id
        ORDER BY m.created_at DESC LIMIT 10
    `);
    const stockByCategory = await getAll(`
        SELECT c.name, c.color, COALESCE(SUM(i.quantity), 0) as total
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        LEFT JOIN inventory i ON p.id = i.product_id
        GROUP BY c.id, c.name, c.color ORDER BY total DESC
    `);
    const movementTrend = await getAll(`
        SELECT DATE(created_at) as date,
               SUM(CASE WHEN type='incoming' THEN quantity ELSE 0 END) as incoming,
               SUM(CASE WHEN type='outgoing' THEN quantity ELSE 0 END) as outgoing
        FROM movements
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
    `);
    res.json({
        totalProducts: totalProducts?.count || 0,
        totalStock: totalStock?.sum || 0,
        lowStockCount: lowStockCount?.count || 0,
        outOfStockCount: outOfStockCount?.count || 0,
        pendingOrders: pendingOrders?.count || 0,
        recentMovements,
        stockByCategory,
        movementTrend
    });
});

module.exports = router;
