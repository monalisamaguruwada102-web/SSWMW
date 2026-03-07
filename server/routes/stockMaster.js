const express = require('express');
const { getAll } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stock-master
router.get('/', requireAuth, async (req, res) => {
    // A single robust view of all stock vs defined limits across the entire global organization.
    const sql = `
        SELECT p.id as product_id, p.sku as stock_code, p.name as description, p.unit as uom,
               p.max_stock_level, p.min_stock_level, p.reorder_level, p.danger_level,
               COALESCE(SUM(i.quantity), 0) as current_global_stock,
               string_agg(DISTINCT w.name || ' (' || sl.section || '-' || sl.rack || '-' || sl.shelf || ')', ', ') as bin_locations
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id AND i.quantity > 0
        LEFT JOIN storage_locations sl ON i.location_id = sl.id
        LEFT JOIN warehouses w ON sl.warehouse_id = w.id
        GROUP BY p.id
        ORDER BY p.name ASC
    `;

    const stockMaster = await getAll(sql);
    res.json({ stock: stockMaster });
});

module.exports = router;
