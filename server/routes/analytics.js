const express = require('express');
const { getAll } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/trends
router.get('/trends', requireAuth, async (req, res) => {
    // Stock levels over the last 30 days
    const stockHistory = await getAll(`
        SELECT DATE(created_at) as date, SUM(quantity_after) as total_stock
        FROM inventory_history
        WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `);

    // Movement volume by category
    const categoryHits = await getAll(`
        SELECT c.name, COUNT(*) as hits
        FROM inventory_history ih
        JOIN products p ON ih.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE ih.created_at > CURRENT_DATE - INTERVAL '90 days'
        GROUP BY c.name
    `);

    res.json({ stockHistory, categoryHits });
});

// GET /api/analytics/forecast
router.get('/forecast', requireAuth, async (req, res) => {
    // Simple 30-day moving average forecasting
    const historicalDemand = await getAll(`
        SELECT product_id, p.name, p.sku,
               SUM(CASE WHEN change_type = 'outgoing' THEN (quantity_before - quantity_after) ELSE 0 END) as monthly_demand
        FROM inventory_history ih
        JOIN products p ON ih.product_id = p.id
        WHERE ih.created_at > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY product_id, p.name, p.sku
        HAVING SUM(CASE WHEN change_type = 'outgoing' THEN (quantity_before - quantity_after) ELSE 0 END) > 0
    `);

    const forecast = historicalDemand.map(d => ({
        ...d,
        predicted_demand_next_30_days: Math.round(d.monthly_demand * 1.1) // Basic 10% projection
    }));

    res.json({ forecast });
});

module.exports = router;
