window.MovementsPage = {
    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Stock Movements</h2>
                <div class="page-header-actions">
                    <select class="form-select" id="mov-type-filter" style="width:140px">
                        <option value="">All Types</option>
                        <option value="incoming">Incoming</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="transfer">Transfer</option>
                    </select>
                    <button class="btn btn-primary" id="mov-record-btn"><i data-feather="plus"></i>Record Movement</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>Type</th><th>Product</th><th>Qty</th><th>From</th><th>To</th>
                        <th>Reference</th><th>Partner</th><th>Recorded By</th><th>Date</th>
                    </tr></thead>
                    <tbody id="mov-tbody"></tbody>
                </table>
            </div>`;
        feather.replace();
        this.loadMovements();
        document.getElementById('mov-type-filter').addEventListener('change', e => this.loadMovements(e.target.value));
        document.getElementById('mov-record-btn').addEventListener('click', () => this.openForm());
    },

    async loadMovements(type = '') {
        try {
            const params = { limit: 100 }; if (type) params.type = type;
            const { movements } = await API.get('/movements', params);
            const tbody = document.getElementById('mov-tbody');
            if (!tbody) return;
            if (!movements.length) { tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No movements recorded</td></tr>'; return; }
            const typeColors = { incoming: 'success', outgoing: 'danger', transfer: 'info' };
            tbody.innerHTML = movements.map(m => `<tr>
                <td><span class="badge badge-${typeColors[m.type]}">${fmt.movementType(m.type)}</span></td>
                <td><strong>${m.product_name}</strong><div style="font-size:11px;color:var(--text-muted)">${m.sku}</div></td>
                <td>${fmt.number(m.quantity)} ${m.unit}</td>
                <td>${m.from_section ? `${m.from_section}-${m.from_rack}-${m.from_shelf}` : '—'}</td>
                <td>${m.to_section ? `${m.to_section}-${m.to_rack}-${m.to_shelf}` : '—'}</td>
                <td><code style="font-size:12px">${m.reference_number || '—'}</code></td>
                <td>${m.supplier_or_customer || '—'}</td>
                <td>${m.username || '—'}</td>
                <td style="white-space:nowrap">${fmt.datetime(m.created_at)}</td>
            </tr>`).join('');
        } catch (e) { Toast.error(e.message); }
    },

    async openForm() {
        let products = [], locations = [];
        try {
            [{ products }, { locations }] = await Promise.all([API.get('/products'), API.get('/storage')]);
        } catch { }

        const prodOpts = products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
        const locOpts = '<option value="">Select location...</option>' + locations.map(l => `<option value="${l.id}">${l.section}-${l.rack}-${l.shelf} ${l.description ? '— ' + l.description : ''}</option>`).join('');

        Modal.show('Record Movement', `
            <form id="mov-form">
                <div class="form-group"><label class="form-label">Movement Type *</label>
                    <select class="form-select" id="mf-type" required>
                        <option value="">Select type...</option>
                        <option value="incoming">Incoming (from supplier)</option>
                        <option value="outgoing">Outgoing (to customer)</option>
                        <option value="transfer">Internal Transfer</option>
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Product *</label>
                    <select class="form-select" id="mf-product" required><option value="">Select product...</option>${prodOpts}</select></div>
                <div class="form-group"><label class="form-label">Quantity *</label>
                    <input class="form-input" id="mf-qty" type="number" min="1" placeholder="Enter quantity" required></div>
                <div class="form-row" id="mf-locations">
                    <div class="form-group" id="mf-from-wrap"><label class="form-label">From Location</label>
                        <select class="form-select" id="mf-from">${locOpts}</select></div>
                    <div class="form-group" id="mf-to-wrap"><label class="form-label">To Location</label>
                        <select class="form-select" id="mf-to">${locOpts}</select></div>
                </div>
                <div class="form-group"><label class="form-label">Reference / Order Number</label>
                    <input class="form-input" id="mf-ref" placeholder="e.g. PO-2024-001"></div>
                <div class="form-group"><label class="form-label" id="mf-partner-label">Supplier / Customer</label>
                    <input class="form-input" id="mf-partner" placeholder="Name of supplier or customer"></div>
                <div class="form-group"><label class="form-label">Notes</label>
                    <textarea class="form-textarea" id="mf-notes" placeholder="Optional notes..."></textarea></div>
                <div class="modal-footer" style="padding:0;margin-top:16px">
                    <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Record Movement</button>
                </div>
            </form>
        `);

        // Dynamic show/hide based on type
        const typeEl = document.getElementById('mf-type');
        const fromWrap = document.getElementById('mf-from-wrap');
        const toWrap = document.getElementById('mf-to-wrap');
        typeEl.addEventListener('change', () => {
            const t = typeEl.value;
            fromWrap.style.opacity = (t === 'incoming') ? '0.4' : '1';
            toWrap.style.opacity = (t === 'outgoing') ? '0.4' : '1';
            document.getElementById('mf-partner-label').textContent =
                t === 'incoming' ? 'Supplier' : t === 'outgoing' ? 'Customer' : 'Partner';
        });

        document.getElementById('mov-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                type: document.getElementById('mf-type').value,
                product_id: parseInt(document.getElementById('mf-product').value),
                quantity: parseInt(document.getElementById('mf-qty').value),
                from_location_id: document.getElementById('mf-from').value || null,
                to_location_id: document.getElementById('mf-to').value || null,
                reference_number: document.getElementById('mf-ref').value,
                supplier_or_customer: document.getElementById('mf-partner').value,
                notes: document.getElementById('mf-notes').value,
            };
            try {
                await API.post('/movements', body);
                Modal.close(); Toast.success('Movement recorded!');
                this.loadMovements();
            } catch (err) { Toast.error(err.message); }
        });
    }
};
