window.ReportsPage = {
    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Reports</h2>
            </div>
            <div class="card" style="margin-bottom:20px">
                <div class="card-body">
                    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Report Type</label>
                            <select class="form-select" id="rep-type" style="min-width:200px">
                                <option value="inventory">Inventory Snapshot</option>
                                <option value="movements">Stock Movements</option>
                                <option value="low-stock">Low Stock Items</option>
                                <option value="activity">Activity Log</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin:0" id="date-range-wrap">
                            <label class="form-label">From</label>
                            <input type="date" class="form-input" id="rep-from" style="width:150px">
                        </div>
                        <div class="form-group" style="margin:0" id="date-to-wrap">
                            <label class="form-label">To</label>
                            <input type="date" class="form-input" id="rep-to" style="width:150px">
                        </div>
                        <button class="btn btn-primary" id="gen-report-btn"><i data-feather="bar-chart-2"></i>Generate</button>
                        <div class="report-actions" id="report-actions" style="display:none">
                            <button class="btn btn-ghost" id="export-csv-btn"><i data-feather="download"></i>CSV</button>
                            <button class="btn btn-ghost" id="export-pdf-btn"><i data-feather="file-text"></i>PDF</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-container">
                <div id="report-result" style="padding:40px;text-align:center;color:var(--text-muted)">
                    <svg data-feather="bar-chart-2" style="width:40px;height:40px;opacity:0.2;margin-bottom:8px"></svg>
                    <div>Select a report type and click Generate</div>
                </div>
            </div>`;
        feather.replace();

        let reportData = [];
        document.getElementById('gen-report-btn').addEventListener('click', async () => {
            const type = document.getElementById('rep-type').value;
            const from = document.getElementById('rep-from').value;
            const to = document.getElementById('rep-to').value;
            const result = document.getElementById('report-result');
            result.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Generating report...</div>';
            try {
                const params = {};
                if (from) params.from = from;
                if (to) params.to = to;
                const { data } = await API.get(`/reports/${type}`, params);
                reportData = data;
                document.getElementById('report-actions').style.display = 'flex';
                result.innerHTML = this._renderTable(type, data);
                feather.replace();
            } catch (e) { Toast.error(e.message); }
        });

        document.getElementById('export-csv-btn').addEventListener('click', () => {
            exportCSV(reportData, `report-${document.getElementById('rep-type').value}-${Date.now()}.csv`);
        });
        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            const titles = { inventory: 'Inventory Report', movements: 'Movements Report', 'low-stock': 'Low Stock Report', activity: 'Activity Log' };
            exportPDF(reportData, `report-${Date.now()}.pdf`, titles[document.getElementById('rep-type').value]);
        });
    },

    _renderTable(type, data) {
        if (!data.length) return '<div style="padding:40px;text-align:center;color:var(--text-muted)">No data for this report</div>';

        const colConfigs = {
            inventory: [
                { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
                { key: 'section', label: 'Section' }, { key: 'rack', label: 'Rack' }, { key: 'shelf', label: 'Shelf' },
                { key: 'quantity', label: 'Qty' }, { key: 'min_stock_level', label: 'Min' }, { key: 'status', label: 'Status' }
            ],
            movements: [
                { key: 'type', label: 'Type' }, { key: 'product', label: 'Product' }, { key: 'sku', label: 'SKU' },
                { key: 'quantity', label: 'Qty' }, { key: 'supplier_or_customer', label: 'Partner' },
                { key: 'reference_number', label: 'Ref#' }, { key: 'username', label: 'By' }, { key: 'created_at', label: 'Date' }
            ],
            'low-stock': [
                { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
                { key: 'unit', label: 'Unit' }, { key: 'total_stock', label: 'Current Stock' },
                { key: 'min_stock_level', label: 'Min Required' }, { key: 'deficit', label: 'Deficit' }
            ],
            activity: [
                { key: 'username', label: 'User' }, { key: 'action', label: 'Action' },
                { key: 'entity_type', label: 'Entity' }, { key: 'entity_id', label: 'ID' },
                { key: 'ip_address', label: 'IP' }, { key: 'created_at', label: 'Date' }
            ]
        };

        const cols = colConfigs[type] || Object.keys(data[0]).map(k => ({ key: k, label: k }));
        return `<div class="report-table-wrap"><table style="width:100%">
            <thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
            <tbody>${data.map(row => `<tr>${cols.map(c => {
            let val = row[c.key];
            if (c.key === 'created_at') val = fmt.datetime(val);
            if (c.key === 'status') return `<td>${fmt.statusBadge(val)}</td>`;
            if (c.key === 'type' && type === 'movements') {
                const colors = { incoming: 'success', outgoing: 'danger', transfer: 'info' };
                return `<td><span class="badge badge-${colors[val] || 'muted'}">${val}</span></td>`;
            }
            if (c.key === 'deficit') return `<td style="color:var(--danger);font-weight:600">${val}</td>`;
            return `<td>${val ?? '—'}</td>`;
        }).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
    }
};
