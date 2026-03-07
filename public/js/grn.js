window.GrnPage = {
    render: async function () {
        const content = document.getElementById('page-content');
        content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

        try {
            const res = await API.get('/grn');

            let html = `
                <div class="header-actions">
                    <h2>GRN (Goods Received Notes)</h2>
                    <div class="actions-group">
                        <button class="btn btn-primary" onclick="window.GrnPage.showReceiveModal()">
                            <i data-feather="download"></i> Receive Goods
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>GRN Number</th>
                                    <th>Date</th>
                                    <th>Supplier</th>
                                    <th>Ref / Invoice #</th>
                                    <th>PO Linked</th>
                                    <th>Received By</th>
                                    <th>Items Count</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (res.grns.length === 0) {
                html += '<tr><td colspan="8" style="text-align:center;padding:20px;">No GRNs logged yet.</td></tr>';
            } else {
                res.grns.forEach(g => {
                    html += `
                        <tr>
                            <td><strong>${Utils.escapeHtml(g.grn_number)}</strong></td>
                            <td>${Utils.formatDate(g.created_at)}</td>
                            <td>${Utils.escapeHtml(g.supplier_name || 'N/A')}</td>
                            <td>${Utils.escapeHtml(g.reference_number || 'N/A')}</td>
                            <td>${g.order_number ? `<span class="badge badge-info">${g.order_number}</span>` : '-'}</td>
                            <td>${Utils.escapeHtml(g.received_by_name || 'Unknown')}</td>
                            <td>${g.item_count} received</td>
                            <td>
                                <button class="btn-icon text-primary" onclick="window.GrnPage.viewGrn(${g.id})" title="View Details">
                                    <i data-feather="eye"></i>
                                </button>
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
            content.innerHTML = `<div class="alert alert-danger">Error loading GRNs: ${e.message}</div>`;
        }
    },

    showReceiveModal: async function () {
        let productsOptions = '';
        let storageOptions = '';
        let ordersOptions = '<option value="">-- No PO linked (Direct Receipt) --</option>';

        try {
            const [{ products }, { locations }, { orders }] = await Promise.all([
                API.get('/products'),
                API.get('/storage'),
                API.get('/orders?type=inbound&status=pending')
            ]);

            products.forEach(p => productsOptions += `<option value="${p.id}">${p.sku} - ${p.name}</option>`);
            locations.forEach(l => storageOptions += `<option value="${l.id}">${l.warehouse_name} > ${l.section}-${l.rack}-${l.shelf}</option>`);
            orders.forEach(o => ordersOptions += `<option value="${o.id}">${o.order_number} (${o.party_name})</option>`);
        } catch (e) {
            Toast.show('Failed to load necessary dropdown data', 'error');
            return;
        }

        const formHtml = `
            <form id="grn-form">
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Link to PO (Optional)</label>
                        <select id="grn-order-id" class="form-input" onchange="window.GrnPage.handleAutoFillPO(this.value)">
                            ${ordersOptions}
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Supplier Name*</label>
                        <input type="text" id="grn-supplier" class="form-input" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Reference / Invoice #</label>
                        <input type="text" id="grn-ref" class="form-input">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Receive INTO Storage Location*</label>
                        <select id="grn-location" class="form-input" required>
                            ${storageOptions}
                        </select>
                        <small class="form-text">All items in this GRN will be ingested into this bin location globally.</small>
                    </div>
                </div>
                
                <hr style="margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4>Receipt Items</h4>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.GrnPage.addGrnItemRow()">
                        <i data-feather="plus"></i> Add Item
                    </button>
                </div>
                
                <div id="grn-items-container">
                    <!-- Item rows injected here -->
                </div>
                
                <div class="form-group" style="margin-top:20px;">
                    <label class="form-label">Internal Notes / Delivery Remarks</label>
                    <textarea id="grn-notes" class="form-input" rows="2"></textarea>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save & Confirm Receipt</button>
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                </div>
            </form>
        `;

        // Store options globally for row injection
        window._grnProductsOptions = productsOptions;

        Modal.show('Receive Goods (GRN)', formHtml, 'large');
        feather.replace();
        this.addGrnItemRow();

        document.getElementById('grn-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const rows = document.querySelectorAll('.grn-item-row');
            const items = [];
            let valid = true;

            rows.forEach(row => {
                const pid = parseInt(row.querySelector('.grn-pid').value);
                const qOrd = parseInt(row.querySelector('.grn-qord').value || 0);
                const qRec = parseInt(row.querySelector('.grn-qrec').value);
                const cond = row.querySelector('.grn-cond').value;

                if (isNaN(pid) || isNaN(qRec) || qRec < 0) {
                    valid = false;
                } else {
                    items.push({ product_id: pid, quantity_ordered: qOrd, quantity_received: qRec, condition: cond });
                }
            });

            if (!valid || items.length === 0) {
                Toast.show('Please provide valid items and received quantities.', 'error');
                return;
            }

            const payload = {
                order_id: document.getElementById('grn-order-id').value || null,
                supplier_name: document.getElementById('grn-supplier').value,
                reference_number: document.getElementById('grn-ref').value,
                notes: document.getElementById('grn-notes').value,
                receive_to_location_id: document.getElementById('grn-location').value,
                items: items
            };

            try {
                await API.post('/grn', payload);
                Toast.show('Goods received successfully. Inventory dynamically updated.', 'success');
                Modal.close();
                this.render();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    },

    addGrnItemRow: function () {
        const container = document.getElementById('grn-items-container');
        const rowId = 'grn-row-' + Date.now();
        const rowHtml = `
            <div id="${rowId}" class="grn-item-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-end; background: var(--bg-color); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="flex: 2;">
                    <label class="form-label" style="font-size: 12px;">Product*</label>
                    <select class="form-input grn-pid" required>
                        <option value="">-- Select --</option>
                        ${window._grnProductsOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size: 12px;">Qty Ordered</label>
                    <input type="number" class="form-input grn-qord" min="0" placeholder="0">
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size: 12px;">Qty Received*</label>
                    <input type="number" class="form-input grn-qrec" min="0" required>
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size: 12px;">Condition</label>
                    <select class="form-input grn-cond">
                        <option value="Good">Good (Intact)</option>
                        <option value="Damaged">Damaged / Rejected</option>
                        <option value="Shortage">Shortage</option>
                    </select>
                </div>
                <div>
                    <button type="button" class="btn-icon text-danger" onclick="document.getElementById('${rowId}').remove()" title="Remove row">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHtml);
        feather.replace();
    },

    handleAutoFillPO: async function (orderId) {
        if (!orderId) return;
        try {
            const { order, items } = await API.get(`/orders/${orderId}`);
            document.getElementById('grn-supplier').value = order.party_name || '';

            // Wipe existing rows and auto-fill
            const container = document.getElementById('grn-items-container');
            container.innerHTML = '';

            items.forEach((item, idx) => {
                const rowId = 'grn-row-auto-' + idx;
                const rowHtml = `
                    <div id="${rowId}" class="grn-item-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-end; background: var(--bg-color); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <div style="flex: 2;">
                            <label class="form-label" style="font-size: 12px;">Product*</label>
                            <select class="form-input grn-pid" required>
                                <option value="${item.product_id}" selected>${item.sku} - ${item.product_name}</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label" style="font-size: 12px;">Qty Ordered</label>
                            <input type="number" class="form-input grn-qord" value="${item.quantity}" readonly>
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label" style="font-size: 12px;">Qty Received*</label>
                            <input type="number" class="form-input grn-qrec" min="0" value="${item.quantity}" required>
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label" style="font-size: 12px;">Condition</label>
                            <select class="form-input grn-cond">
                                <option value="Good">Good (Intact)</option>
                                <option value="Damaged">Damaged / Rejected</option>
                                <option value="Shortage">Shortage</option>
                            </select>
                        </div>
                        <div>
                            <button type="button" class="btn-icon text-danger" onclick="document.getElementById('${rowId}').remove()">
                                <i data-feather="trash-2"></i>
                            </button>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', rowHtml);
            });
            feather.replace();
            Toast.show('Auto-filled remaining PO items', 'success');
        } catch (e) {
            Toast.show('Failed to auto-fill PO items: ' + e.message, 'error');
        }
    },

    viewGrn: async function (id) {
        try {
            const { grn, items } = await API.get(`/grn/${id}`);

            let html = `
                <div class="row" style="display:flex; gap: 20px; margin-bottom:20px;">
                    <div style="flex:1;">
                        <p><strong>GRN Number:</strong> ${grn.grn_number}</p>
                        <p><strong>Supplier:</strong> ${grn.supplier_name || 'N/A'}</p>
                        <p><strong>Ref/Invoice #:</strong> ${grn.reference_number || 'None'}</p>
                    </div>
                    <div style="flex:1;">
                        <p><strong>Date:</strong> ${Utils.formatDate(grn.created_at)}</p>
                        <p><strong>Received By:</strong> ${grn.received_by_name || 'System'}</p>
                        <p><strong>Linked PO:</strong> ${grn.order_number || 'None'}</p>
                    </div>
                </div>
                
                <p><strong>Notes:</strong> ${Utils.escapeHtml(grn.notes || 'No remarks provided.')}</p>

                <hr style="margin: 20px 0;">
                <h4>Received Items</h4>
                <table class="table" style="margin-top: 10px;">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Product</th>
                            <th>Ordered</th>
                            <th>Received</th>
                            <th>Condition</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            items.forEach(item => {
                let condBadge = 'badge-success';
                if (item.condition === 'Damaged') condBadge = 'badge-danger';
                if (item.condition === 'Shortage') condBadge = 'badge-warning';

                const variance = item.quantity_received - (item.quantity_ordered || item.quantity_received);
                let varianceText = variance < 0 ? ` (${variance})` : '';
                let varStyle = variance < 0 ? 'color: red; font-weight: bold;' : '';

                html += `
                    <tr>
                        <td>${item.sku}</td>
                        <td>${Utils.escapeHtml(item.product_name)}</td>
                        <td>${item.quantity_ordered || '-'}</td>
                        <td><strong>${item.quantity_received}</strong> <span style="${varStyle}">${varianceText}</span></td>
                        <td><span class="badge ${condBadge}">${item.condition}</span></td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
                </div>
            `;

            Modal.show(`GRN Details`, html, 'large');
        } catch (e) {
            Toast.show('Failed to fetch GRN details', 'error');
        }
    }
};
