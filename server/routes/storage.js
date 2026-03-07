const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/storage
router.get('/', requireAuth, async (req, res) => {
    const locations = await getAll(`
        SELECT sl.*,
               COUNT(i.product_id) as product_count,
               COALESCE(SUM(i.quantity), 0) as total_items
        FROM storage_locations sl
        LEFT JOIN inventory i ON sl.id = i.location_id AND i.quantity > 0
        GROUP BY sl.id
        ORDER BY sl.section, sl.rack, sl.shelf
    `);
    res.json({ locations });
});

// GET /api/storage/:id
router.get('/:id', requireAuth, async (req, res) => {
    const location = await getOne('SELECT * FROM storage_locations WHERE id = ?', [req.params.id]);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    const items = await getAll(`
        SELECT i.*, p.name as product_name, p.sku, p.unit
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        WHERE i.location_id = ? AND i.quantity > 0
    `, [req.params.id]);
    res.json({ location, items });
});

// POST /api/storage
router.post('/', requireAdmin, async (req, res) => {
    const { section, rack, shelf, description, capacity } = req.body;
    if (!section || !rack || !shelf) return res.status(400).json({ error: 'Section, rack, and shelf required' });
    const existing = await getOne('SELECT id FROM storage_locations WHERE section=? AND rack=? AND shelf=?', [section, rack, shelf]);
    if (existing) return res.status(409).json({ error: 'Location already exists' });
    const id = await runInsert('INSERT INTO storage_locations (section, rack, shelf, description, capacity) VALUES (?,?,?,?,?)',
        [section, rack, shelf, description || '', capacity || 100]);
    res.status(201).json({ id, section, rack, shelf });
});

// PUT /api/storage/:id
router.put('/:id', requireAdmin, async (req, res) => {
    const { description, capacity } = req.body;
    const loc = await getOne('SELECT * FROM storage_locations WHERE id = ?', [req.params.id]);
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    await runQuery('UPDATE storage_locations SET description=?, capacity=? WHERE id=?',
        [description ?? loc.description, capacity ?? loc.capacity, req.params.id]);
    res.json({ message: 'Location updated' });
});

// DELETE /api/storage/:id
router.delete('/:id', requireAdmin, async (req, res) => {
    const hasStock = await getOne('SELECT id FROM inventory WHERE location_id = ? AND quantity > 0', [req.params.id]);
    if (hasStock) return res.status(400).json({ error: 'Cannot delete location with existing stock' });
    await runQuery('DELETE FROM storage_locations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Location deleted' });
});

module.exports = router;
