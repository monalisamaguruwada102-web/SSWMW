window.PickingPage = {
    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Picking & Packing</h2>
                <div class="page-header-actions">
                    <button class="btn btn-ghost" id="pick-refresh"><i data-feather="refresh-cw"></i>Refresh</button>
                </div>
            </div>
            <div id="picking-orders" class="p-4" style="max-width: 600px; margin: 0 auto;">
                <p class="text-muted text-center" style="padding:40px">Loading pending orders...</p>
            </div>`;
        feather.replace();
        this.loadOrders();
        document.getElementById('pick-refresh').addEventListener('click', () => this.loadOrders());
    },

    async loadOrders() {
        try {
            const { orders } = await API.get('/orders', { status: 'approved', type: 'dispatch' });
            const container = document.getElementById('picking-orders');
            if (!container) return;

            if (!orders.length) {
                container.innerHTML = '<div class="alert alert-info">No pending dispatch orders found.</div>';
                return;
            }

            container.innerHTML = orders.map(o => `
                <div class="card mb-4" style="cursor:pointer" onclick="PickingPage.startPicking(${o.id})">
                    <div class="card-header d-flex justify-content-between">
                        <strong>${o.order_number}</strong>
                        <span class="badge badge-info">${o.item_count} items</span>
                    </div>
                    <div class="card-body">
                        <div class="text-muted small">Created: ${fmt.datetime(o.created_at)}</div>
                        <div class="text-muted small">Notes: ${o.notes || 'No notes'}</div>
                    </div>
                    <div class="card-footer text-center" style="background:#f8fafc">
                        <button class="btn btn-primary btn-sm">Start Picking</button>
                    </div>
                </div>
            `).join('');
        } catch (e) { Toast.error(e.message); }
    },

    async startPicking(orderId) {
        Modal.show('Picking List', '<div class="text-center p-4">Loading items...</div>', 'large');
        try {
            const { order, items } = await API.get(`/orders/${orderId}`);
            const { inventory } = await API.get('/inventory');

            const itemLocations = items.map(item => {
                const inv = inventory.find(i => i.product_id === item.product_id && i.quantity > 0) || {};
                return { ...item, ...inv };
            }).sort((a, b) => {
                if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
                if (a.rack !== b.rack) return (a.rack || '').localeCompare(b.rack || '');
                return (a.shelf || '').localeCompare(b.shelf || '');
            });

            document.getElementById('modal-body').innerHTML = `
                <div class="picking-workflow">
                    <div class="picking-header mb-4">
                        <h4>Order: ${order.order_number}</h4>
                        <div class="text-muted small">Follow the optimized path below.</div>
                    </div>
                    <div id="picking-list">
                        ${itemLocations.map((item, idx) => `
                            <div class="picking-item card mb-2 ${idx === 0 ? 'active-pick' : ''}" id="pick-item-${item.id}" data-sku="${item.sku}">
                                <div class="card-body d-flex align-items-center">
                                    <div class="pick-location mr-3" style="background:var(--primary-color); color:#fff; padding:10px; border-radius:8px; font-weight:bold; min-width:80px; text-align:center">
                                        ${item.section || '?'}-${item.rack || '?'}-${item.shelf || '?'}
                                    </div>
                                    <div class="flex-grow-1">
                                        <div style="font-weight:600">${item.product_name}</div>
                                        <div class="text-muted small">SKU: ${item.sku} | Qty: <strong>${item.quantity_requested}</strong></div>
                                    </div>
                                    <div class="pick-action">
                                        <button class="btn btn-icon btn-outline" onclick="PickingPage.scanVerify(${item.id}, '${item.sku}')">
                                            <i data-feather="maximize"></i>
                                        </button>
                                        <input type="checkbox" class="pick-check ml-2" id="check-${item.id}" onchange="PickingPage.togglePick(${item.id})">
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-footer mt-4">
                        <button class="btn btn-ghost" onclick="Modal.close()">Pause</button>
                        <button class="btn btn-success" id="finish-picking" disabled onclick="PickingPage.completePicking(${orderId})">Complete Packing</button>
                    </div>
                </div>
            `;
            feather.replace();
        } catch (e) { Toast.error(e.message); }
    },

    togglePick(itemId) {
        const itemEl = document.getElementById(`pick-item-${itemId}`);
        const checked = document.getElementById(`check-${itemId}`).checked;
        if (itemEl) itemEl.classList.toggle('picked', checked);

        const allChecked = Array.from(document.querySelectorAll('.pick-check')).every(c => c.checked);
        const finishBtn = document.getElementById('finish-picking');
        if (finishBtn) finishBtn.disabled = !allChecked;
    },

    scanVerify(itemId, sku) {
        Scanner.show((scannedSku) => {
            if (scannedSku === sku) {
                const check = document.getElementById(`check-${itemId}`);
                if (check) {
                    check.checked = true;
                    this.togglePick(itemId);
                    Toast.success('Item verified!');
                }
            } else {
                Toast.error(`Wrong Item! Expected: ${sku}, Scanned: ${scannedSku}`);
            }
        });
    },

    async completePicking(orderId) {
        try {
            await API.put(`/orders/${orderId}/status`, { status: 'completed' });
            Modal.close();
            Toast.success('Order Packed & Dispatched!');
            this.loadOrders();
        } catch (e) { Toast.error(e.message); }
    }
};
