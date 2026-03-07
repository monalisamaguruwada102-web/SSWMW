const express = require('express');
const { getAll, getOne, runInsert, runQuery } = require('../db/database');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/warehouses
router.get('/', requireAuth, async (req, res) => {
    const warehouses = await getAll(`
        SELECT w.*, u.username as manager_name
        FROM warehouses w
        LEFT JOIN users u ON w.manager_id = u.id
        ORDER BY w.name
    `);
    res.json({ warehouses });
});

// GET /api/warehouses/:id
router.get('/:id', requireAuth, async (req, res) => {
    const warehouse = await getOne(`
        SELECT w.*, u.username as manager_name
        FROM warehouses w
        LEFT JOIN users u ON w.manager_id = u.id
        WHERE w.id = $1
    `, [req.params.id]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
    res.json({ warehouse });
});

// POST /api/warehouses
router.post('/', requireAdmin, async (req, res) => {
    const { name, type, location, manager_id } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });

    const existing = await getOne('SELECT id FROM warehouses WHERE name = $1', [name]);
    if (existing) return res.status(409).json({ error: 'Warehouse name already exists' });

    const id = await runInsert(
        'INSERT INTO warehouses (name, type, location, manager_id) VALUES ($1,$2,$3,$4)',
        [name, type, location || '', manager_id || null]
    );
    res.status(201).json({ warehouse: { id, name, type, location, manager_id } });
});

// PUT /api/warehouses/:id
router.put('/:id', requireAdmin, async (req, res) => {
    const { name, type, location, manager_id } = req.body;
    const warehouse = await getOne('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

    await runQuery(
        'UPDATE warehouses SET name=$1, type=$2, location=$3, manager_id=$4 WHERE id=$5',
        [name || warehouse.name, type || warehouse.type, location ?? warehouse.location, manager_id ?? warehouse.manager_id, req.params.id]
    );
    res.json({ message: 'Warehouse updated' });
});

module.exports = router;
