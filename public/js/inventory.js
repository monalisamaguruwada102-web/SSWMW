window.InventoryPage = {
    async render() {
        const initialStatus = this.initialFilter || '';
        this.initialFilter = null; // Reset for next time

        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Inventory</h2>
                <div class="page-header-actions">
                    <select class="form-select" id="inv-status" style="width:140px">
                        <option value="" ${initialStatus === '' ? 'selected' : ''}>All Status</option>
                        <option value="ok" ${initialStatus === 'ok' ? 'selected' : ''}>OK</option>
                        <option value="low" ${initialStatus === 'low' ? 'selected' : ''}>Low Stock</option>
                        <option value="out" ${initialStatus === 'out' ? 'selected' : ''}>Out of Stock</option>
                    </select>
                    <div class="search-wrap" style="height: 38px;"><i data-feather="search" class="input-icon"></i>
                        <input type="text" class="search-input" id="inv-sku-search" placeholder="SKU Search...">
                        <button class="btn-icon" id="inv-scan-btn" title="Scan Barcode" style="margin-left: 8px;"><i data-feather="maximize"></i></button>
                    </div>
                    <button class="btn btn-warning" id="inv-out-toggle"><i data-feather="slash"></i>Out of Stock</button>
                    <button class="btn btn-ghost" id="inv-history-btn"><i data-feather="clock"></i>History</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>Product</th><th>Warehouse</th><th>Location</th><th>Batch #</th><th>Expiry</th><th>Qty</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="inv-tbody"></tbody>
                </table>
            </div>
            <div id="inv-pagination" class="pagination"></div>`;
        feather.replace();
        this.loadInventory(initialStatus);
        document.getElementById('inv-status').addEventListener('change', e => this.loadInventory(e.target.value));
        document.getElementById('inv-out-toggle').addEventListener('click', () => {
            const select = document.getElementById('inv-status');
            select.value = 'out';
            this.loadInventory('out');
        });
        document.getElementById('inv-history-btn').addEventListener('click', () => this.showHistory());

        const skuSearch = document.getElementById('inv-sku-search');
        if (skuSearch) skuSearch.addEventListener('input', debounce(e => this.loadInventory(document.getElementById('inv-status').value, e.target.value)));

        const scanBtn = document.getElementById('inv-scan-btn');
        if (scanBtn) scanBtn.addEventListener('click', () => {
            Scanner.show((sku) => {
                if (skuSearch) {
                    skuSearch.value = sku;
                    this.loadInventory(document.getElementById('inv-status').value, sku);
                }
            });
        });
    },

    async loadInventory(status = '', sku = '') {
        try {
            const params = {};
            if (status) params.status = status;
            if (sku) params.sku = sku;
            const { inventory } = await API.get('/inventory', params);
            const tbody = document.getElementById('inv-tbody');
            if (!tbody) return;
            if (!inventory.length) {
                tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No inventory records found</td></tr>'; return;
            }
            tbody.innerHTML = inventory.map(i => {
                const s = fmt.stockStatus(i.quantity, i.min_stock_level);
                return `<tr>
                    <td><strong>${i.product_name}</strong></td>
                    <td><code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-size:12px">${i.sku}</code></td>
                    <td><span class="badge badge-muted">${i.section}-${i.rack}-${i.shelf}</span></td>
                    <td>${i.category_name ? fmt.categoryBadge(i.category_name, i.category_color) : '—'}</td>
                    <td><strong>${fmt.number(i.quantity)}</strong> ${i.unit}</td>
                    <td>${i.min_stock_level}</td>
                    <td><span class="badge badge-${s.badge}">${s.label}</span></td>
                    <td>${fmt.stockBar(i.quantity, i.min_stock_level)}</td>
                    <td><button class="btn btn-sm btn-ghost" onclick="InventoryPage.adjust(${i.id},'${i.product_name}',${i.quantity})">Adjust</button></td>
                </tr>`;
            }).join('');
        } catch (e) { Toast.error(e.message); }
    },

    adjust(id, name, currentQty) {
        Modal.show(`Adjust Stock — ${name}`, `
            <div class="form-group">
                <label class="form-label">Current Quantity: <strong>${currentQty}</strong></label>
                <label class="form-label" style="margin-top:12px">New Quantity *</label>
                <input class="form-input" id="adj-qty" type="number" min="0" value="${currentQty}" required>
            </div>
            <div class="form-group"><label class="form-label">Notes</label>
                <textarea class="form-textarea" id="adj-notes" placeholder="Reason for adjustment..."></textarea></div>
            <div class="modal-footer" style="padding:0;margin-top:16px">
                <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-primary" id="adj-save">Update Stock</button>
            </div>
        `);
        document.getElementById('adj-save').addEventListener('click', async () => {
            const qty = parseInt(document.getElementById('adj-qty').value);
            const notes = document.getElementById('adj-notes').value;
            if (isNaN(qty) || qty < 0) { Toast.error('Enter valid quantity'); return; }
            try {
                await API.put(`/inventory/${id}`, { quantity: qty, notes });
                Modal.close(); Toast.success('Stock updated!');
                this.loadInventory();
            } catch (e) { Toast.error(e.message); }
        });
    },

    async showHistory() {
        Modal.show('Inventory History', '<div id="hist-loading" style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>', 'large');
        try {
            const { history } = await API.get('/inventory/history', { limit: 50 });
            document.getElementById('hist-loading').outerHTML = `
                <table style="width:100%"><thead><tr>
                    <th>Product</th><th>Location</th><th>Type</th><th>Before</th><th>After</th><th>Change</th><th>Notes</th><th>By</th><th>Date</th>
                </tr></thead><tbody>${history.map(h => `<tr>
                    <td>${h.product_name}</td>
                    <td>${h.section ? `${h.section}-${h.rack}-${h.shelf}` : '—'}</td>
                    <td><span class="badge badge-muted">${fmt.changeType(h.change_type)}</span></td>
                    <td>${h.quantity_before}</td><td>${h.quantity_after}</td>
                    <td style="color:${h.quantity_after > h.quantity_before ? '#10b981' : '#ef4444'}">
                        ${h.quantity_after > h.quantity_before ? '+' : ''}${h.quantity_after - h.quantity_before}
                    </td>
                    <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.notes || '—'}</td>
                    <td>${h.username || '—'}</td>
                    <td style="white-space:nowrap">${fmt.datetime(h.created_at)}</td>
                </tr>`).join('')}</tbody></table>
            `;
        } catch (e) { Toast.error(e.message); }
    }
};
