require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/database');
const { seedDatabase } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const { activityLogger } = require('./middleware/activityLog');
app.use('/api', activityLogger);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/movements', require('./routes/movements'));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/grn', require('./routes/grn'));
app.use('/api/requisitions', require('./routes/requisitions'));
app.use('/api/stock-master', require('./routes/stockMaster'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/debug-db', require('./routes/debug'));

app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        version: '2.2',
        dbConnected: !!pool,
        timestamp: new Date().toISOString()
    });
});

// SPA catch-all — serve index.html for all non-API routes
app.get('*', async (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found' });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Initialize database on startup
async function start() {
    try {
        await getDb();
        await seedDatabase();
        app.listen(PORT, () => {
            console.log(`\n🚀 SmartStore WMS running at http://localhost:${PORT}`);
            console.log(`   Login: admin@sswms.com / admin123  (Administrator)`);
            console.log(`   Login: staff@sswms.com / staff123  (Staff)\n`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
