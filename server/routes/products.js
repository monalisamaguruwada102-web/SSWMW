const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products
router.get('/', requireAuth, async (req, res) => {
    const { search, category_id } = req.query;
    let sql = `
        SELECT p.*, c.name as category_name, c.color as category_color,
               COALESCE(SUM(i.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE 1=1
    `;
    const params = [];
    if (search) {
        sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category_id) {
        sql += ' AND p.category_id = $1';
        params.push(category_id);
    }
    sql += ' GROUP BY p.id, c.name, c.color ORDER BY p.name';
    const products = await getAll(sql, params);
    res.json({ products });
});

// GET /api/products/:id
router.get('/:id', requireAuth, async (req, res) => {
    const product = await getOne(`
        SELECT p.*, c.name as category_name, c.color as category_color,
               COALESCE(SUM(i.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.id = ?
        GROUP BY p.id, c.name, c.color
    `, [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const stockByLocation = await getAll(`
        SELECT i.*, sl.section, sl.rack, sl.shelf
        FROM inventory i
        JOIN storage_locations sl ON i.location_id = sl.id
        WHERE i.product_id = ?
    `, [req.params.id]);

    res.json({ product, stockByLocation });
});

// POST /api/products
router.post('/', requireAdmin, async (req, res) => {
    const { name, sku, category_id, description, unit, min_stock_level, max_stock_level, reorder_level, danger_level } = req.body;
    if (!name || !sku) return res.status(400).json({ error: 'Name and SKU required' });
    const existing = await getOne('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existing) return res.status(409).json({ error: 'SKU already exists' });
    const id = await runInsert(
        'INSERT INTO products (name, sku, category_id, description, unit, min_stock_level, max_stock_level, reorder_level, danger_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [name, sku, category_id || null, description || '', unit || 'pcs', min_stock_level || 0, max_stock_level || null, reorder_level || null, danger_level || null]
    );
    res.status(201).json({ product: { id, name, sku, category_id, unit, min_stock_level, max_stock_level, reorder_level, danger_level } });
});

// PUT /api/products/:id
router.put('/:id', requireAdmin, async (req, res) => {
    const { name, sku, category_id, description, unit, min_stock_level, max_stock_level, reorder_level, danger_level } = req.body;
    const product = await getOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await runQuery(
        'UPDATE products SET name=$1, sku=$2, category_id=$3, description=$4, unit=$5, min_stock_level=$6, max_stock_level=$7, reorder_level=$8, danger_level=$9, updated_at=CURRENT_TIMESTAMP WHERE id=$10',
        [name || product.name, sku || product.sku, category_id ?? product.category_id,
        description ?? product.description, unit || product.unit,
        min_stock_level ?? product.min_stock_level, max_stock_level ?? product.max_stock_level,
        reorder_level ?? product.reorder_level, danger_level ?? product.danger_level, req.params.id]
    );
    res.json({ message: 'Product updated' });
});

// DELETE /api/products/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    const inInventory = await getOne('SELECT id FROM inventory WHERE product_id = ? AND quantity > 0', [req.params.id]);
    if (inInventory) return res.status(400).json({ error: 'Cannot delete product with existing stock' });
    await runQuery('DELETE FROM inventory WHERE product_id = ?', [req.params.id]);
    await runQuery('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
});

module.exports = router;
