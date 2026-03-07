const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'server', 'routes');
const files = fs.readdirSync(routesDir).map(f => path.join(routesDir, f));
files.push(path.join(__dirname, 'server', 'server.js'));
files.push(path.join(__dirname, 'server', 'middleware', 'auth.js'));
files.push(path.join(__dirname, 'server', 'middleware', 'activityLog.js'));

for (const file of files) {
    if (!file.endsWith('.js')) continue;

    let content = fs.readFileSync(file, 'utf8');

    // Convert route handlers to async
    content = content.replace(/router\.(get|post|put|delete)\('([^']+)',\s*(requireAuth|requireAdmin)?(,\s*)?\(req,\s*res\)\s*=>\s*\{/g,
        (match, method, path, mw, comma) => {
            return `router.${method}('${path}', ${mw ? mw + ', ' : ''}async (req, res) => {`;
        }
    );

    // Convert app.post etc in server.js
    content = content.replace(/app\.(get|post|put|delete)\('([^']+)',\s*(requireAuth|requireAdmin)?(,\s*)?\(req,\s*res\)\s*=>\s*\{/g,
        (match, method, path, mw, comma) => {
            return `app.${method}('${path}', ${mw ? mw + ', ' : ''}async (req, res) => {`;
        }
    );

    // Convert middleware to async
    content = content.replace(/const requireAuth = \(req, res, next\) => \{/g, 'const requireAuth = async (req, res, next) => {');
    content = content.replace(/const requireAdmin = \(req, res, next\) => \{/g, 'const requireAdmin = async (req, res, next) => {');
    content = content.replace(/function activityLog\(req, res, next\) \{/g, 'async function activityLog(req, res, next) {');

    // Add await to DB calls
    content = content.replace(/(?<!await\s)(getAll\(|getOne\(|runQuery\(|runInsert\()/g, 'await $1');

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${path.basename(file)}`);
}
