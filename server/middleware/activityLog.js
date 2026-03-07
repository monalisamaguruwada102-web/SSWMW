const { runInsert } = require('../db/database');

function activityLogger(req, res, next) {
    const method = req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return next();
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
        // Only log on success
        if (res.statusCode < 400 && req.user) {
            try {
                const pathParts = req.path.split('/').filter(Boolean);
                const entityType = pathParts[1] || 'unknown'; // e.g., 'products', 'inventory'
                const entityId = pathParts[2] ? parseInt(pathParts[2]) : null;
                const action = method === 'POST' ? 'CREATE'
                    : method === 'PUT' || method === 'PATCH' ? 'UPDATE'
                        : 'DELETE';

                runInsert(
                    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?)',
                    [
                        req.user.id,
                        action,
                        entityType,
                        entityId,
                        JSON.stringify({ body: req.body, params: req.params }),
                        req.ip || req.connection?.remoteAddress
                    ]
                );
            } catch (e) {
                // Don't let logging errors break responses
                console.error('Activity log error:', e.message);
            }
        }
        return originalJson(body);
    };

    next();
}

module.exports = { activityLogger };
