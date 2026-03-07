const { Pool } = require('pg');

let pool = null;

// Regex helpers to translate SQLite to Postgres syntax
function pgSql(sql) {
    let result = sql;
    // Replace SQLite variables ? with Postgres variables $1, $2...
    let i = 0;
    result = result.replace(/\?/g, () => '$' + (++i));

    // Replace datetime functions
    result = result.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
    result = result.replace(/date\('now',\s*'-30 days'\)/g, "CURRENT_DATE - INTERVAL '30 days'");

    return result;
}

async function getDb() {
    if (pool) return pool;

    if (!process.env.DATABASE_URL) {
        // Fallback for local testing if not on Render
        pool = new Pool({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'password', // Assumes a local dev DB if no URL
            database: 'smartstore'
        });
        console.warn('⚠️ No DATABASE_URL found. Using local Postgres fallback.');
    } else {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    }

    try {
        await createSchema();
        console.log('✅ Connected to PostgreSQL Database');
    } catch (e) {
        console.error('Database connection failed:', e);
    }
    return pool;
}

async function runQuery(sql, params = []) {
    if (!pool) throw new Error('Database not initialized');
    await pool.query(pgSql(sql), params);
}

async function getAll(sql, params = []) {
    if (!pool) throw new Error('Database not initialized');
    const res = await pool.query(pgSql(sql), params);
    return res.rows;
}

async function getOne(sql, params = []) {
    const rows = await getAll(sql, params);
    return rows.length ? rows[0] : null;
}

async function runInsert(sql, params = []) {
    if (!pool) throw new Error('Database not initialized');
    let pgQuery = pgSql(sql);
    if (!pgQuery.toUpperCase().includes('RETURNING')) {
        pgQuery += ' RETURNING id';
    }
    const res = await pool.query(pgQuery, params);
    return res.rows.length ? res.rows[0].id : null;
}

async function createSchema() {
    const schema = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff')),
        is_active SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#6366f1',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
        min_stock_level INTEGER NOT NULL DEFAULT 0,
        image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS storage_locations (
        id SERIAL PRIMARY KEY,
        section VARCHAR(50) NOT NULL,
        rack VARCHAR(50) NOT NULL,
        shelf VARCHAR(50) NOT NULL,
        description TEXT,
        capacity INTEGER DEFAULT 100,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(section, rack, shelf)
    );

    CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        location_id INTEGER NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS inventory_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES storage_locations(id) ON DELETE SET NULL,
        change_type VARCHAR(50) NOT NULL CHECK(change_type IN ('adjustment','incoming','outgoing','transfer_in','transfer_out')),
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movements (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL CHECK(type IN ('incoming','outgoing','transfer')),
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        from_location_id INTEGER REFERENCES storage_locations(id) ON DELETE SET NULL,
        to_location_id INTEGER REFERENCES storage_locations(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL,
        reference_number VARCHAR(255),
        supplier_or_customer VARCHAR(255),
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','completed','cancelled')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL CHECK(type IN ('request','dispatch')),
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','processing','completed','cancelled')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity_requested INTEGER NOT NULL,
        quantity_fulfilled INTEGER DEFAULT 0,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read SMALLINT NOT NULL DEFAULT 0,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INTEGER,
        details TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    `;

    await pool.query(schema);
}

module.exports = { getDb, runQuery, getAll, getOne, runInsert };
