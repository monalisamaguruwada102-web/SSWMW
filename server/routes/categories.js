const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories
router.get('/', requireAuth, (req, res) => {
    const categories = getAll('SELECT * FROM categories ORDER BY name');
    res.json({ categories });
});

// POST /api/categories
router.post('/', requireAdmin, (req, res) => {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const existing = getOne('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing) return res.status(409).json({ error: 'Category already exists' });
    const id = runInsert('INSERT INTO categories (name, description, color) VALUES (?,?,?)',
        [name, description || '', color || '#6366f1']);
    res.status(201).json({ category: { id, name, description, color } });
});

// PUT /api/categories/:id
router.put('/:id', requireAdmin, (req, res) => {
    const { name, description, color } = req.body;
    const cat = getOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    runQuery('UPDATE categories SET name=?, description=?, color=? WHERE id=?',
        [name || cat.name, description ?? cat.description, color || cat.color, req.params.id]);
    res.json({ message: 'Category updated' });
});

// DELETE /api/categories/:id
router.delete('/:id', requireAdmin, (req, res) => {
    const inUse = getOne('SELECT id FROM products WHERE category_id = ?', [req.params.id]);
    if (inUse) return res.status(400).json({ error: 'Category in use by products' });
    runQuery('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted' });
});

module.exports = router;
