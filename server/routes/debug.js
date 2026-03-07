const express = require('express');
const { getAll } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
    try {
        const tables = await getAll(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        const columns = {};
        for (const t of tables) {
            const table_name = t.table_name;
            const cols = await getAll(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1
            `, [table_name]);
            columns[table_name] = cols;
        }

        res.json({ tables, columns });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
