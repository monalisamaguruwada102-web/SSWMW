const bcrypt = require('bcryptjs');
const { getAll, runInsert } = require('./database');

async function seedDatabase() {
    // Only seed if no users exist yet
    const existingUsers = getAll('SELECT id FROM users LIMIT 1');
    if (existingUsers.length > 0) {
        console.log('Database already initialized, skipping seed...');
        return;
    }

    console.log('Initializing database with default accounts...');

    const adminHash = bcrypt.hashSync('admin123', 10);
    const staffHash = bcrypt.hashSync('staff123', 10);

    runInsert(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)',
        ['admin', 'admin@smartstore.com', adminHash, 'admin']
    );
    runInsert(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)',
        ['staff', 'staff@smartstore.com', staffHash, 'staff']
    );

    console.log('✅ Default accounts created.');
    console.log('   Admin: admin / admin123');
    console.log('   Staff: staff / staff123');
    console.log('\n   Start by adding Categories, then Products, then Storage Locations.\n');
}

module.exports = { seedDatabase };
