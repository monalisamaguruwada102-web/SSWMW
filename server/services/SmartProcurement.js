const { getAll, runInsert, getOne } = require('../db/database');

/**
 * SmartProcurement Service
 * Handles automated alerts and draft requisition generation
 */
const SmartProcurement = {
    async checkAll() {
        console.log('🤖 [SmartProcurement] Starting automated check...');
        try {
            await this.checkExpiry();
            await this.checkLowStock();
        } catch (e) {
            console.error('❌ [SmartProcurement] Service error:', e);
        }
    },

    /**
     * Notify about stock expiring in the next 30 days
     */
    async checkExpiry() {
        const expiringItems = await getAll(`
            SELECT i.*, p.name as product_name, p.sku, 
                   sl.section, sl.rack, sl.shelf
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            JOIN storage_locations sl ON i.location_id = sl.id
            WHERE i.expiry_date IS NOT NULL 
              AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
              AND i.quantity > 0
        `);

        if (expiringItems.length > 0) {
            console.log(`⚠️ [SmartProcurement] Found ${expiringItems.length} expiring items.`);
            const admins = await getAll('SELECT id FROM users WHERE role = \'admin\'');

            for (const item of expiringItems) {
                const daysLeft = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                const title = daysLeft < 0 ? 'Stock Expired!' : 'Stock Expiring Soon';
                const message = `${item.product_name} (Batch: ${item.batch_number || 'N/A'}) in ${item.section}-${item.rack}-${item.shelf} ${daysLeft < 0 ? 'expired on' : 'expires on'} ${new Date(item.expiry_date).toLocaleDateString()}. Qty: ${item.quantity}.`;

                for (const admin of admins) {
                    // Avoid duplicate notifications (simple check)
                    const existing = await getOne('SELECT id FROM notifications WHERE user_id = $1 AND title = $2 AND created_at > CURRENT_DATE', [admin.id, title]);
                    if (!existing) {
                        await runInsert('INSERT INTO notifications (type, title, message, user_id) VALUES ($1,$2,$3,$4)',
                            ['expiry', title, message, admin.id]);
                    }
                }
            }
        }
    },

    /**
     * Automatically create draft requisitions for items below danger level
     */
    async checkLowStock() {
        const lowStockProducts = await getAll(`
            SELECT p.id, p.name, p.sku, p.danger_level, p.reorder_level, p.default_supplier_id,
                   COALESCE(SUM(i.quantity), 0) as current_stock
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.danger_level > 0
            GROUP BY p.id
            HAVING COALESCE(SUM(i.quantity), 0) <= p.danger_level
        `);

        if (lowStockProducts.length > 0) {
            console.log(`🚨 [SmartProcurement] Found ${lowStockProducts.length} products at danger level.`);
            const admins = await getAll('SELECT id FROM users WHERE role = \'admin\'');

            for (const p of lowStockProducts) {
                // Check if a pending requisition already exists for this product
                const existingReq = await getOne(`
                    SELECT r.id FROM requisitions r
                    JOIN requisition_items ri ON r.id = ri.requisition_id
                    WHERE ri.product_id = $1 AND r.status = 'pending'
                    LIMIT 1
                `, [p.id]);

                if (!existingReq) {
                    const qtyToOrder = (p.reorder_level || p.danger_level * 2) - p.current_stock;
                    if (qtyToOrder <= 0) continue;

                    const reqId = await runInsert(
                        "INSERT INTO requisitions (req_number, status, notes, raised_by) VALUES ($1, $2, $3, $4)",
                        [`AUTO-${Date.now().toString().slice(-6)}`, 'pending', `Automated reorder: Stock at danger level (${p.current_stock}/${p.danger_level})`, admins[0]?.id || 1]
                    );

                    await runInsert(
                        "INSERT INTO requisition_items (req_id, product_id, description, quantity, uom, estimated_cost) VALUES ($1, $2, $3, $4, $5, $6)",
                        [reqId, p.id, `Reorder for ${p.name}`, qtyToOrder, 'pcs', 0]
                    );

                    console.log(`✅ [SmartProcurement] Created auto-requisition for ${p.name}`);
                }
            }
        }
    }
};

module.exports = SmartProcurement;
