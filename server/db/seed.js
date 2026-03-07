const bcrypt = require('bcryptjs');
const { getAll, runInsert, getOne } = require('./database');

async function seedDatabase() {
    try {
        console.log('🔄 Checking for legacy default accounts...');
        // Force delete old style usernames to restrict them as requested
        const { runQuery } = require('./database');
        await runQuery("DELETE FROM users WHERE username IN ('admin', 'staff') AND email NOT LIKE '%@sswms.com'");

        const adminEmail = 'admin@sswms.com';
        const staffEmail = 'staff@sswms.com';

        const hasAdmin = await getOne('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (!hasAdmin) {
            console.log('Creating new admin credentials...');
            const adminHash = bcrypt.hashSync('admin123', 10);
            await runInsert(
                'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4)',
                [adminEmail, adminEmail, adminHash, 'admin']
            );
        }

        const hasStaff = await getOne('SELECT id FROM users WHERE email = $1', [staffEmail]);
        if (!hasStaff) {
            console.log('Creating new staff credentials...');
            const staffHash = bcrypt.hashSync('staff123', 10);
            await runInsert(
                'INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4)',
                [staffEmail, staffEmail, staffHash, 'staff']
            );
        }
        console.log('✅ Default accounts verified.');

        // Auto-add default Categories
        const catCount = await getOne('SELECT COUNT(*) as count FROM categories');
        if (parseInt(catCount.count) === 0) {
            console.log('Adding default categories...');
            const categories = [
                ['Electronics', 'Electronic devices and components', '#3b82f6'],
                ['Raw Materials', 'Base materials for manufacturing', '#10b981'],
                ['Packaging', 'Boxes, tape, and shipping materials', '#f59e0b'],
                ['Safety Gear', 'PPE and safety equipment', '#ef4444'],
                ['Office Supplies', 'General office consumables', '#8b5cf6']
            ];
            for (const c of categories) {
                await runInsert('INSERT INTO categories (name, description, color) VALUES ($1,$2,$3)', c);
            }
            console.log('✅ Default categories added.');
        }

        // Auto-add default Warehouses
        const whCount = await getOne('SELECT COUNT(*) as count FROM warehouses');
        if (parseInt(whCount.count) === 0) {
            console.log('Adding default warehouses...');
            await runInsert("INSERT INTO warehouses (name, type, location) VALUES ('Main HQ', 'hq', 'Central City')");
            await runInsert("INSERT INTO warehouses (name, type, location) VALUES ('Site Alpha', 'site', 'North District')");
            await runInsert("INSERT INTO warehouses (name, type, location) VALUES ('Site Beta', 'site', 'South District')");
            await runInsert("INSERT INTO warehouses (name, type, location) VALUES ('Transit Hub', 'transit', 'Highway 1')");
            console.log('✅ Default warehouses added.');
        }

        // Auto-add default Storage Locations
        const locCount = await getOne('SELECT COUNT(*) as count FROM storage_locations');
        if (parseInt(locCount.count) === 0) {
            console.log('Adding default storage locations...');
            // Link to the first warehouse (Main HQ)
            const hq = await getOne("SELECT id FROM warehouses WHERE type = 'hq' LIMIT 1");
            if (hq) {
                const locations = [
                    [hq.id, 'A', '01', '01', 'Receiving Bay', 500],
                    [hq.id, 'B', '01', '01', 'General Storage', 200],
                    [hq.id, 'C', '01', '01', 'Dispatch Bay', 500]
                ];
                for (const l of locations) {
                    await runInsert('INSERT INTO storage_locations (warehouse_id, section, rack, shelf, description, capacity) VALUES ($1,$2,$3,$4,$5,$6)', l);
                }
                console.log('✅ Default storage locations added.');
            }
        }

    } catch (err) {
        console.error('Seed error:', err);
    }
}

module.exports = { seedDatabase };
