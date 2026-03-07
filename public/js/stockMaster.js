window.StockMasterPage = {
    render: async function () {
        const content = document.getElementById('page-content');
        content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

        try {
            const res = await API.get('/stock-master');

            let html = `
                <div class="header-actions">
                    <h2>Stock Master (Global View)</h2>
                    <div class="actions-group">
                        <button class="btn btn-secondary" onclick="window.StockMasterPage.render()">
                            <i data-feather="refresh-cw"></i> Refresh
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Stock Code</th>
                                    <th>Description</th>
                                    <th>UOM</th>
                                    <th>Global Stock</th>
                                    <th>Max</th>
                                    <th>Reorder</th>
                                    <th>Danger</th>
                                    <th>Bin Locations</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (res.stock.length === 0) {
                html += '<tr><td colspan="9" style="text-align:center;padding:20px;">No stock items found.</td></tr>';
            } else {
                res.stock.forEach(item => {
                    const qty = parseInt(item.current_global_stock);
                    const danger = parseInt(item.danger_level) || 0;
                    const reorder = parseInt(item.reorder_level) || 0;
                    const max = parseInt(item.max_stock_level) || 999999;

                    let statusHtml = '<span class="badge badge-success">Healthy</span>';
                    let rowClass = '';

                    if (qty <= danger) {
                        statusHtml = '<span class="badge badge-danger">Danger</span>';
                        rowClass = 'style="background-color: #fee2e2;"';
                    } else if (qty <= reorder) {
                        statusHtml = '<span class="badge badge-warning">Reorder</span>';
                    } else if (qty >= max) {
                        statusHtml = '<span class="badge badge-info">Overstocked</span>';
                    }

                    html += `
                        <tr ${rowClass}>
                            <td><strong>${Utils.escapeHtml(item.stock_code)}</strong></td>
                            <td>${Utils.escapeHtml(item.description)}</td>
                            <td>${Utils.escapeHtml(item.uom)}</td>
                            <td><strong>${qty}</strong></td>
                            <td>${item.max_stock_level || '-'}</td>
                            <td>${item.reorder_level || '-'}</td>
                            <td>${item.danger_level || '-'}</td>
                            <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${Utils.escapeHtml(item.bin_locations || 'None')}">
                                ${Utils.escapeHtml(item.bin_locations || 'None')}
                            </td>
                            <td>${statusHtml}</td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            content.innerHTML = html;
            feather.replace();

        } catch (e) {
            content.innerHTML = `<div class="alert alert-danger">Error loading stock master: ${e.message}</div>`;
        }
    }
};
