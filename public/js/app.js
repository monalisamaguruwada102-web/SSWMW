// ===================== App State =====================
const AppState = {
    user: null,
    notifPollInterval: null,
};

// ===================== Router =====================
const routes = {
    dashboard: () => window.DashboardPage?.render(),
    stockmaster: () => window.StockMasterPage?.render(),
    procurement: () => window.ProcurementPage?.render(),
    grn: () => window.GrnPage?.render(),
    transfers: () => window.TransfersPage?.render(),
    products: () => window.ProductsPage?.render(),
    inventory: () => window.InventoryPage?.render(),
    movements: () => window.MovementsPage?.render(),
    storage: () => window.StoragePage?.render(),
    orders: () => window.OrdersPage?.render(),
    picking: () => window.PickingPage?.render(),
    analytics: () => window.AnalyticsPage?.render(),
    reports: () => window.ReportsPage?.render(),
    users: () => window.UsersPage?.render(),
    activity: () => window.ActivityPage?.render(),
};

function navigate(page) {
    if (!page || !routes[page]) page = 'dashboard';
    // Role check
    if ((page === 'users' || page === 'activity') && AppState.user?.role !== 'admin') {
        page = 'dashboard';
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add('active');

    // Update breadcrumb
    const labels = {
        dashboard: 'Dashboard', stockmaster: 'Stock Master', procurement: 'Procurement (Requisitions)',
        grn: 'GRN (Receiving)', transfers: 'Stock Transfers',
        products: 'Products', inventory: 'Inventory',
        movements: 'Old Movements', storage: 'Storage Locations', orders: 'Dispatch (Orders)',
        picking: 'Picking & Packing', analytics: 'Advanced Analytics',
        reports: 'Reports', users: 'User Management', activity: 'Activity Log',
    };
    document.getElementById('breadcrumb').textContent = labels[page] || page;

    // Render page
    const content = document.getElementById('page-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner"></div></div>';

    try {
        routes[page]();
    } catch (e) {
        content.innerHTML = `<div class="alert alert-danger">Error loading page: ${e.message}</div>`;
    }
}

// Hash-based routing
window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '') || 'dashboard';
    navigate(page);
});

// ===================== Sidebar =====================
function initSidebar() {
    const sidebar = document.getElementById('sidebar');

    // Desktop collapse
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Mobile open
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
    });

    // Close sidebar on nav click (mobile)
    sidebar.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => {
            if (window.innerWidth < 640) sidebar.classList.remove('mobile-open');
        });
    });
}

// Theme is locked to light

// ===================== Notifications =====================
function startNotifPolling() {
    window.NotificationsModule?.loadBadge();
    AppState.notifPollInterval = setInterval(() => window.NotificationsModule?.loadBadge(), 60000);
}

// ===================== Modal Close =====================
function initModal() {
    document.getElementById('modal-close').addEventListener('click', Modal.close);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) Modal.close();
    });
}

// ===================== Logout =====================
async function logout() {
    try { await API.post('/auth/logout', {}); } catch { }
    AppState.user = null;
    if (AppState.notifPollInterval) clearInterval(AppState.notifPollInterval);
    showLogin();
}

// ===================== Auth Flow =====================
function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    feather.replace();
}

function showApp(user) {
    AppState.user = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Update sidebar user info
    document.getElementById('sidebar-username').textContent = user.username;
    document.getElementById('sidebar-role').textContent = user.role === 'admin' ? 'Administrator' : 'Staff';
    document.getElementById('sidebar-avatar').textContent = user.username[0].toUpperCase();

    // Show/hide admin sections
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = user.role === 'admin' ? '' : 'none';
    });
    const adminSection = document.getElementById('admin-section');
    if (adminSection) adminSection.style.display = user.role === 'admin' ? '' : 'none';

    // Verify Modal is available
    if (typeof Modal === 'undefined' || typeof Modal.show !== 'function') {
        console.error('CRITICAL: Modal system failed to initialize or was overwritten.');
    }

    feather.replace();
    initSidebar();
    initModal();
    startNotifPolling();

    // Route to current hash or dashboard
    const page = window.location.hash.replace('#', '') || 'dashboard';
    navigate(page);
}

// ===================== Init =====================
async function init() {
    // Lock to light theme
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.removeItem('wms-theme');

    document.getElementById('logout-btn').addEventListener('click', logout);

    // Try auto-login from existing cookie
    try {
        const { user } = await API.get('/auth/me');
        showApp(user);
    } catch {
        showLogin();
    }

    // Check if PWA prompt was already captured
    if (window.deferredPrompt) {
        const container = document.getElementById('install-btn-container');
        if (container) container.classList.remove('hidden');
    }
}

// ===================== PWA Installation =====================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    const container = document.getElementById('install-btn-container');
    if (container) container.classList.remove('hidden');
});

const installBtn = document.getElementById('pwa-install-btn');
if (installBtn) {
    installBtn.onclick = async () => {
        if (!window.deferredPrompt) return;
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        console.log(`PWA installation outcome: ${outcome}`);
        window.deferredPrompt = null;
        const container = document.getElementById('install-btn-container');
        if (container) container.classList.add('hidden');
    };
}

document.addEventListener('DOMContentLoaded', init);

// Export for use in other modules
window.AppState = AppState;
window.navigate = navigate;
window.logout = logout;
