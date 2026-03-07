window.OrdersPage = {
    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Orders & Requests</h2>
                <div class="page-header-actions">
                    <select class="form-select" id="ord-status" style="width:140px">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <button class="btn btn-primary" id="add-ord-btn"><i data-feather="plus"></i>New Order</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>Order #</th><th>Type</th><th>Status</th><th>Items</th>
                        <th>Created By</th><th>Approved By</th><th>Date</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="ord-tbody"></tbody>
                </table>
            </div>`;
        feather.replace();
        this.loadOrders();
        document.getElementById('ord-status').addEventListener('change', e => this.loadOrders(e.target.value));
        document.getElementById('add-ord-btn').addEventListener('click', () => this.openForm());
    },

    async loadOrders(status = '') {
        try {
            const params = {}; if (status) params.status = status;
            const { orders } = await API.get('/orders', params);
            const tbody = document.getElementById('ord-tbody');
            if (!tbody) return;
            if (!orders.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No orders found</td></tr>'; return; }
            tbody.innerHTML = orders.map(o => `<tr>
                <td><strong>${o.order_number}</strong></td>
                <td><span class="badge badge-${o.type === 'request' ? 'info' : 'warning'}">${o.type}</span></td>
                <td>${fmt.statusBadge(o.status)}</td>
                <td>${o.item_count} item(s)</td>
                <td>${o.created_by_name || '—'}</td>
                <td>${o.approved_by_name || '—'}</td>
                <td style="white-space:nowrap">${fmt.datetime(o.created_at)}</td>
                <td>
                    <div style="display:flex;gap:4px">
                        <button class="btn-icon" onclick="OrdersPage.viewOrder(${o.id})" title="View"><svg data-feather="eye"></svg></button>
                        ${o.status === 'pending' && AppState.user?.role === 'admin' ? `
                            <button class="btn-icon" onclick="OrdersPage.updateStatus(${o.id},'approved')" title="Approve" style="color:#10b981"><svg data-feather="check-circle"></svg></button>
                            <button class="btn-icon" onclick="OrdersPage.updateStatus(${o.id},'cancelled')" title="Cancel" style="color:#ef4444"><svg data-feather="x-circle"></svg></button>
                        ` : ''}
                        ${o.status === 'approved' ? `<button class="btn-icon" onclick="OrdersPage.updateStatus(${o.id},'processing')" title="Mark Processing" style="color:#3b82f6"><svg data-feather="play"></svg></button>` : ''}
                        ${o.status === 'processing' ? `<button class="btn-icon" onclick="OrdersPage.updateStatus(${o.id},'completed')" title="Complete" style="color:#10b981"><svg data-feather="check-square"></svg></button>` : ''}
                    </div>
                </td>
            </tr>`).join('');
            feather.replace();
        } catch (e) { Toast.error(e.message); }
    },

    async viewOrder(id) {
        Modal.open('Order Details', '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>', { wide: true });
        try {
            const { order, items } = await API.get(`/orders/${id}`);
            document.getElementById('modal-body').innerHTML = `
                <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
                    <div><div class="form-label">Order Number</div><strong>${order.order_number}</strong></div>
                    <div><div class="form-label">Type</div>${order.type}</div>
                    <div><div class="form-label">Status</div>${fmt.statusBadge(order.status)}</div>
                    <div><div class="form-label">Created By</div>${order.created_by_name || '—'}</div>
                    <div><div class="form-label">Approved By</div>${order.approved_by_name || '—'}</div>
                    <div><div class="form-label">Date</div>${fmt.datetime(order.created_at)}</div>
                </div>
                ${order.notes ? `<div class="alert alert-warning" style="margin-bottom:12px">${order.notes}</div>` : ''}
                <table style="width:100%"><thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Qty Requested</th></tr></thead>
                <tbody>${items.map(i => `<tr><td>${i.product_name}</td><td>${i.sku}</td><td>${i.unit}</td><td>${i.quantity_requested}</td></tr>`).join('')}</tbody>
                </table>`;
        } catch (e) { Toast.error(e.message); }
    },

    async updateStatus(id, status) {
        const labels = { approved: 'approve', cancelled: 'cancel', processing: 'mark as processing', completed: 'mark as completed' };
        Modal.confirm(`Are you sure you want to ${labels[status] || status} this order?`, async () => {
            try {
                await API.put(`/orders/${id}/status`, { status });
                Toast.success(`Order ${status}`);
                this.loadOrders();
            } catch (e) { Toast.error(e.message); }
        });
    },

    async openForm() {
        let products = [];
        try { const r = await API.get('/products'); products = r.products; } catch { }
        const prodOpts = products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
        let itemCount = 1;

        const renderItem = (i) => `
            <div class="order-item-row" id="ord-item-${i}">
                <select class="form-select" id="oi-prod-${i}" required><option value="">Select product...</option>${prodOpts}</select>
                <input class="form-input" id="oi-qty-${i}" type="number" min="1" placeholder="Qty" required>
                <input class="form-input" id="oi-notes-${i}" placeholder="Notes">
                <button type="button" class="btn-icon" onclick="document.getElementById('ord-item-${i}').remove()" style="color:#ef4444"><svg data-feather="x"></svg></button>
            </div>`;

        Modal.open('New Order / Request', `
            <form id="ord-form">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Order Type *</label>
                        <select class="form-select" id="of-type" required>
                            <option value="">Select type...</option>
                            <option value="request">Stock Request (incoming)</option>
                            <option value="dispatch">Dispatch (outgoing)</option>
                        </select></div>
                </div>
                <div class="form-group"><label class="form-label">Notes</label>
                    <textarea class="form-textarea" id="of-notes" placeholder="Order notes..."></textarea></div>
                <div class="section-label">Order Items</div>
                <div id="ord-items-list">${renderItem(1)}</div>
                <button type="button" class="btn btn-ghost btn-sm" id="add-item-btn" style="margin:8px 0"><i data-feather="plus"></i>Add Item</button>
                <div class="modal-footer" style="padding:0;margin-top:16px">
                    <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Order</button>
                </div>
            </form>
        `, { wide: true });
        feather.replace();

        document.getElementById('add-item-btn').addEventListener('click', () => {
            itemCount++;
            const list = document.getElementById('ord-items-list');
            list.insertAdjacentHTML('beforeend', renderItem(itemCount));
            feather.replace();
        });

        document.getElementById('ord-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const items = [];
            for (let i = 1; i <= itemCount; i++) {
                const el = document.getElementById(`ord-item-${i}`);
                if (!el) continue;
                const prod = document.getElementById(`oi-prod-${i}`)?.value;
                const qty = parseInt(document.getElementById(`oi-qty-${i}`)?.value);
                if (prod && qty > 0) items.push({ product_id: parseInt(prod), quantity: qty, notes: document.getElementById(`oi-notes-${i}`)?.value || '' });
            }
            if (!items.length) { Toast.error('Add at least one item'); return; }
            try {
                await API.post('/orders', { type: document.getElementById('of-type').value, notes: document.getElementById('of-notes').value, items });
                Modal.close(); Toast.success('Order created!');
                this.loadOrders();
            } catch (err) { Toast.error(err.message); }
        });
    }
};
