window.TransfersPage = {
    render: async function () {
        const content = document.getElementById('page-content');
        content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

        try {
            const res = await API.get('/transfers');

            let html = `
                <div class="header-actions">
                    <h2>Stock Transfers</h2>
                    <div class="actions-group">
                        <button class="btn btn-primary" onclick="window.TransfersPage.showNewTransferModal()">
                            <i data-feather="repeat"></i> New Transfer
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Ref Number</th>
                                    <th>Date</th>
                                    <th>From Warehouse</th>
                                    <th>To Warehouse</th>
                                    <th>Items</th>
                                    <th>Status</th>
                                    <th>Created By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (res.transfers.length === 0) {
                html += '<tr><td colspan="8" style="text-align:center;padding:20px;">No transfers found.</td></tr>';
            } else {
                res.transfers.forEach(t => {
                    let badgeClass = 'badge-secondary';
                    if (t.status === 'completed') badgeClass = 'badge-success';
                    if (t.status === 'in_transit') badgeClass = 'badge-info';
                    if (t.status === 'cancelled') badgeClass = 'badge-danger';

                    html += `
                        <tr>
                            <td><strong>${Utils.escapeHtml(t.transfer_number)}</strong></td>
                            <td>${Utils.formatDate(t.created_at)}</td>
                            <td>${Utils.escapeHtml(t.from_warehouse_name)}</td>
                            <td>${Utils.escapeHtml(t.to_warehouse_name)}</td>
                            <td>${t.item_count} items</td>
                            <td><span class="badge ${badgeClass}">${t.status.toUpperCase()}</span></td>
                            <td>${Utils.escapeHtml(t.created_by_name || 'System')}</td>
                            <td>
                                <button class="btn-icon text-primary" onclick="window.TransfersPage.viewTransfer(${t.id})" title="View Details">
                                    <i data-feather="eye"></i>
                                </button>
                                ${t.status === 'pending' || t.status === 'in_transit' ? `
                                <button class="btn-icon text-success" onclick="window.TransfersPage.showStatusModal(${t.id}, '${t.status}')" title="Update Status">
                                    <i data-feather="check-circle"></i>
                                </button>
                                ` : ''}
                            </td>
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
            content.innerHTML = `<div class="alert alert-danger">Error loading transfers: ${e.message}</div>`;
        }
    },

    showNewTransferModal: async function () {
        let warehouseOptions = '';
        let productsOptions = '';

        try {
            const [{ warehouses }, { products }] = await Promise.all([
                API.get('/warehouses'),
                API.get('/products')
            ]);

            warehouses.forEach(w => warehouseOptions += `<option value="${w.id}">${w.name} (${w.code})</option>`);
            products.forEach(p => productsOptions += `<option value="${p.id}">${p.sku} - ${p.name}</option>`);
        } catch (e) {
            Toast.show('Failed to load warehouses/products', 'error');
            return;
        }

        const formHtml = `
            <form id="transfer-form">
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">From Warehouse (Source)*</label>
                        <select id="tf-from" class="form-input" required>
                            <option value="">-- Select Source --</option>
                            ${warehouseOptions}
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">To Warehouse (Destination)*</label>
                        <select id="tf-to" class="form-input" required>
                            <option value="">-- Select Destination --</option>
                            ${warehouseOptions}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Transfer Notes / Reason</label>
                    <textarea id="tf-notes" class="form-input" rows="2" placeholder="e.g. Replenishing site stock"></textarea>
                </div>
                
                <hr style="margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4>Transfer Items</h4>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.TransfersPage.addTransferItemRow()">
                        <i data-feather="plus"></i> Add Item
                    </button>
                </div>
                
                <div id="transfer-items-container">
                    <!-- Item rows here -->
                </div>

                <div class="form-actions" style="margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">Initiate Transfer</button>
                    <button type="button" class="btn btn-secondary" onclick="AppModal.close()">Cancel</button>
                </div>
            </form>
        `;

        // Save products for injection
        window._transferProductsOptions = productsOptions;

        AppModal.show('New Stock Transfer', formHtml, 'large');
        feather.replace();
        this.addTransferItemRow();

        document.getElementById('transfer-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const fromWh = document.getElementById('tf-from').value;
            const toWh = document.getElementById('tf-to').value;

            if (fromWh === toWh) {
                Toast.show('Source and destination warehouses must be different.', 'error');
                return;
            }

            const rows = document.querySelectorAll('.transfer-item-row');
            const items = [];
            let valid = true;

            rows.forEach(row => {
                const pid = parseInt(row.querySelector('.tf-pid').value);
                const qty = parseInt(row.querySelector('.tf-qty').value);

                if (isNaN(pid) || isNaN(qty) || qty <= 0) {
                    valid = false;
                } else {
                    items.push({ product_id: pid, quantity: qty });
                }
            });

            if (!valid || items.length === 0) {
                Toast.show('Please provide valid products and quantities.', 'error');
                return;
            }

            try {
                const payload = {
                    from_warehouse_id: parseInt(fromWh),
                    to_warehouse_id: parseInt(toWh),
                    notes: document.getElementById('tf-notes').value,
                    items: items
                };
                await API.post('/transfers', payload);
                Toast.show('Stock transfer initiated successfully.', 'success');
                AppModal.close();
                this.render();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    },

    addTransferItemRow: function () {
        const container = document.getElementById('transfer-items-container');
        const rowId = 'tf-row-' + Date.now();
        const rowHtml = `
            <div id="${rowId}" class="transfer-item-row" style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-end;">
                <div style="flex: 3;">
                    <label class="form-label" style="font-size:12px;">Product*</label>
                    <select class="form-input tf-pid" required>
                        <option value="">-- Select Product --</option>
                        ${window._transferProductsOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size:12px;">Quantity*</label>
                    <input type="number" class="form-input tf-qty" min="1" required>
                </div>
                <div>
                    <button type="button" class="btn-icon text-danger" onclick="document.getElementById('${rowId}').remove()">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHtml);
        feather.replace();
    },

    viewTransfer: async function (id) {
        try {
            const { transfer, items } = await API.get(`/transfers/${id}`);

            let html = `
                <div class="row" style="display:flex; gap: 20px; margin-bottom:20px;">
                    <div style="flex:1;">
                        <p><strong>Ref Number:</strong> ${transfer.transfer_number}</p>
                        <p><strong>Status:</strong> <span class="badge badge-info">${transfer.status.toUpperCase()}</span></p>
                        <p><strong>From:</strong> ${transfer.from_warehouse_name}</p>
                    </div>
                    <div style="flex:1;">
                        <p><strong>Date:</strong> ${Utils.formatDate(transfer.created_at)}</p>
                        <p><strong>Initiated By:</strong> ${transfer.created_by_name || 'System'}</p>
                        <p><strong>To:</strong> ${transfer.to_warehouse_name}</p>
                    </div>
                </div>
                
                <p><strong>Notes:</strong> ${Utils.escapeHtml(transfer.notes || 'None')}</p>

                <hr style="margin: 20px 0;">
                <h4>Transfer Items</h4>
                <table class="table" style="margin-top: 10px;">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Product</th>
                            <th>Requested Qty</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            items.forEach(item => {
                html += `
                    <tr>
                        <td>${item.sku}</td>
                        <td>${Utils.escapeHtml(item.product_name)}</td>
                        <td><strong>${item.quantity}</strong></td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-secondary" onclick="AppModal.close()">Close</button>
                </div>
            `;

            AppModal.show(`Transfer Details`, html, 'large');
        } catch (e) {
            Toast.show('Failed to fetch transfer details', 'error');
        }
    },

    showStatusModal: function (id, currentStatus) {
        const statuses = ['pending', 'in_transit', 'completed', 'cancelled'];
        const optionsHtml = statuses.map(s =>
            `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s.toUpperCase()}</option>`
        ).join('');

        const formHtml = `
            <form id="tf-status-form">
                <div class="form-group">
                    <label class="form-label">Update Status</label>
                    <select id="tf-new-status" class="form-input">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="modal-footer" style="padding:0; margin-top:20px;">
                    <button type="button" class="btn btn-secondary" onclick="AppModal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Status</button>
                </div>
            </form>
        `;

        AppModal.show('Update Transfer Status', formHtml);

        document.getElementById('tf-status-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newStatus = document.getElementById('tf-new-status').value;

            try {
                await API.put(`/transfers/${id}/status`, { status: newStatus });
                Toast.show('Transfer status updated', 'success');
                AppModal.close();
                this.render();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    }
};
