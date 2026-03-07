window.DashboardPage = {
    charts: [],
    async render() {
        const content = document.getElementById('page-content');
        content.innerHTML = `
            <div class="page-header">
                <h2>Dashboard</h2>
                <span class="badge badge-success" style="font-size:11px">Live</span>
            </div>
            <div class="stat-grid" id="stat-grid">
                <div class="stat-card" style="--stat-color:#6366f1;--stat-bg:rgba(99,102,241,0.1)">
                    <div class="stat-icon"><svg data-feather="package"></svg></div>
                    <div><div class="stat-value" id="stat-products">—</div><div class="stat-label">Total Products</div></div>
                </div>
                <div class="stat-card" style="--stat-color:#10b981;--stat-bg:rgba(16,185,129,0.1)">
                    <div class="stat-icon"><svg data-feather="layers"></svg></div>
                    <div><div class="stat-value" id="stat-stock">—</div><div class="stat-label">Total Stock Units</div></div>
                </div>
                <div class="stat-card" style="--stat-color:#f59e0b;--stat-bg:rgba(245,158,11,0.1)">
                    <div class="stat-icon"><svg data-feather="alert-triangle"></svg></div>
                    <div><div class="stat-value" id="stat-low">—</div><div class="stat-label">Low Stock Items</div></div>
                </div>
                <div class="stat-card" style="--stat-color:#3b82f6;--stat-bg:rgba(59,130,246,0.1)">
                    <div class="stat-icon"><svg data-feather="clipboard"></svg></div>
                    <div><div class="stat-value" id="stat-orders">—</div><div class="stat-label">Pending Orders</div></div>
                </div>
            </div>
            <div id="dashboard-main"></div>`;
        feather.replace();

        try {
            const stats = await API.get('/reports/dashboard-stats');
            document.getElementById('stat-products').textContent = fmt.number(stats.totalProducts);
            document.getElementById('stat-stock').textContent = fmt.number(stats.totalStock);
            document.getElementById('stat-low').textContent = fmt.number(stats.lowStockCount);
            document.getElementById('stat-orders').textContent = fmt.number(stats.pendingOrders);

            this.charts.forEach(c => c.destroy());
            this.charts = [];

            const main = document.getElementById('dashboard-main');

            if (!stats.totalProducts) {
                // Show getting-started guide when no data
                main.innerHTML = `
                    <div class="card" style="max-width:620px;margin:0 auto">
                        <div class="card-header"><span class="card-title">🚀 Getting Started — Setup Checklist</span></div>
                        <div class="card-body">
                            <p style="color:var(--text-secondary);margin-bottom:20px;font-size:13px">
                                Your warehouse is empty. Follow these steps to set up your system:
                            </p>
                            <div style="display:flex;flex-direction:column;gap:14px">
                                <div style="display:flex;gap:12px;align-items:flex-start">
                                    <div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.12);color:#6366f1;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">1</div>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">Add Product Categories</div>
                                        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Group your products (e.g. Electronics, Packaging, Raw Materials)</div>
                                        <a href="#products" class="btn btn-sm btn-ghost" style="margin-top:6px"><i data-feather="arrow-right"></i> Go to Products</a>
                                    </div>
                                </div>
                                <div style="display:flex;gap:12px;align-items:flex-start">
                                    <div style="width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.1);color:#10b981;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">2</div>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">Add Storage Locations</div>
                                        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Define warehouse sections, racks and shelves (e.g. A-01-01)</div>
                                        <a href="#storage" class="btn btn-sm btn-ghost" style="margin-top:6px"><i data-feather="arrow-right"></i> Go to Storage</a>
                                    </div>
                                </div>
                                <div style="display:flex;gap:12px;align-items:flex-start">
                                    <div style="width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.1);color:#3b82f6;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">3</div>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">Add Products</div>
                                        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Register your products with SKU, unit, and minimum stock level</div>
                                        <a href="#products" class="btn btn-sm btn-ghost" style="margin-top:6px"><i data-feather="arrow-right"></i> Go to Products</a>
                                    </div>
                                </div>
                                <div style="display:flex;gap:12px;align-items:flex-start">
                                    <div style="width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,0.1);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">4</div>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">Record Incoming Stock</div>
                                        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Use Movements → Record incoming goods to stock your locations</div>
                                        <a href="#movements" class="btn btn-sm btn-ghost" style="margin-top:6px"><i data-feather="arrow-right"></i> Go to Movements</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                feather.replace();
                return;
            }

            // Normal dashboard with data
            main.innerHTML = `
                <div class="grid-2" style="margin-bottom:20px">
                    <div class="chart-card">
                        <div class="card-header"><span class="card-title">Stock by Category</span></div>
                        <div class="chart-wrapper"><canvas id="chart-category"></canvas></div>
                    </div>
                    <div class="chart-card">
                        <div class="card-header"><span class="card-title">Movement Trend (30 days)</span></div>
                        <div class="chart-wrapper"><canvas id="chart-trend"></canvas></div>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Recent Movements</span>
                            <a href="#movements" class="btn-link">View all</a>
                        </div>
                        <div class="card-body" style="padding:0">
                            <ul class="activity-feed" id="activity-feed" style="padding:0 20px"></ul>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">⚠ Low Stock Alerts</span>
                            <a href="#inventory" class="btn-link">Fix inventory</a>
                        </div>
                        <div class="card-body" style="padding:0">
                            <ul class="low-stock-list" id="low-stock-list" style="padding:0 20px"></ul>
                        </div>
                    </div>
                </div>`;

            this._renderCategoryChart(stats.stockByCategory);
            this._renderTrendChart(stats.movementTrend);
            this._renderActivity(stats.recentMovements);
            await this._renderLowStock();
        } catch (e) {
            Toast.error('Failed to load dashboard: ' + e.message);
        }
    },

    _renderCategoryChart(data) {
        const ctx = document.getElementById('chart-category');
        if (!ctx || !data.length) return;
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.name),
                datasets: [{
                    label: 'Stock Units',
                    data: data.map(d => d.total),
                    backgroundColor: data.map(d => (d.color || '#6366f1') + 'cc'),
                    borderColor: data.map(d => d.color || '#6366f1'),
                    borderWidth: 2,
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9295b8' } },
                    x: { grid: { display: false }, ticks: { color: '#9295b8' } }
                }
            }
        });
        this.charts.push(chart);
    },

    _renderTrendChart(data) {
        const ctx = document.getElementById('chart-trend');
        if (!ctx) return;
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
                datasets: [
                    { label: 'Incoming', data: data.map(d => d.incoming), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 3 },
                    { label: 'Outgoing', data: data.map(d => d.outgoing), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4, pointRadius: 3 },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#9295b8', boxWidth: 12 } } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9295b8' } },
                    x: { grid: { display: false }, ticks: { color: '#9295b8', maxTicksLimit: 7 } }
                }
            }
        });
        this.charts.push(chart);
    },

    _renderActivity(movements) {
        const ul = document.getElementById('activity-feed');
        if (!ul) return;
        if (!movements.length) { ul.innerHTML = '<li class="activity-item"><span class="text-muted">No recent movements</span></li>'; return; }
        ul.innerHTML = movements.map(m => `
            <li class="activity-item">
                <div class="activity-dot" style="background:${m.type === 'incoming' ? '#10b981' : m.type === 'outgoing' ? '#ef4444' : '#3b82f6'}"></div>
                <div>
                    <div>${m.product_name} — ${fmt.movementType(m.type)} ${fmt.number(m.quantity)}</div>
                    <div class="activity-time">${fmt.datetime(m.created_at)}</div>
                </div>
            </li>
        `).join('');
    },

    async _renderLowStock() {
        const ul = document.getElementById('low-stock-list');
        if (!ul) return;
        try {
            const { items } = await API.get('/inventory/low-stock');
            if (!items.length) { ul.innerHTML = '<li class="low-stock-item"><span class="text-muted">All items are well stocked! 🎉</span></li>'; return; }
            ul.innerHTML = items.slice(0, 8).map(i => `
                <li class="low-stock-item">
                    <div style="flex:1">
                        <div style="font-weight:600;font-size:13px">${i.product_name}</div>
                        <div style="font-size:11px;color:var(--text-muted)">${i.sku}</div>
                    </div>
                    <div style="text-align:right">
                        <div>${fmt.stockBar(i.total_stock, i.min_stock_level)}</div>
                        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${i.total_stock}/${i.min_stock_level} min</div>
                    </div>
                </li>
            `).join('');
        } catch { }
    }
};
