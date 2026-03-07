const { runInsert } = require('../db/database');

function activityLogger(req, res, next) {
    const method = req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return next();
    }

    const originalJson = res.json;
    res.json = async function (body) {
        // Only log on success
        if (res.statusCode < 400 && req.user) {
            try {
                const pathParts = req.path.split('/').filter(Boolean);
                const entityType = pathParts[1] || 'unknown';
                const entityId = pathParts[2] && !isNaN(pathParts[2]) ? parseInt(pathParts[2]) : null;
                const action = method === 'POST' ? 'CREATE'
                    : (method === 'PUT' || method === 'PATCH') ? 'UPDATE'
                        : 'DELETE';

                await runInsert(
                    'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
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
                console.error('Activity log error:', e.message);
            }
        }
        return originalJson.apply(res, arguments);
    };

    next();
}

module.exports = { activityLogger };
