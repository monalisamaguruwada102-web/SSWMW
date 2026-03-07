window.ProcurementPage = {
    render: async function () {
        const content = document.getElementById('page-content');
        content.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

        try {
            const res = await API.get('/requisitions');

            let html = `
                <div class="header-actions">
                    <h2>Procurement (Requisitions)</h2>
                    <div class="actions-group">
                        <button class="btn btn-primary" onclick="window.ProcurementPage.showNewReqModal()">
                            <i data-feather="plus"></i> Raise Requisition
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Req Number</th>
                                    <th>Date</th>
                                    <th>Raised By</th>
                                    <th>Items</th>
                                    <th>Status</th>
                                    <th>Assigned Buyer</th>
                                    <th>Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (res.requisitions.length === 0) {
                html += '<tr><td colspan="8" style="text-align:center;padding:20px;">No requisitions found.</td></tr>';
            } else {
                res.requisitions.forEach(req => {
                    let badgeClass = 'badge-secondary';
                    if (req.status === 'approved') badgeClass = 'badge-primary';
                    if (req.status === 'po_issued') badgeClass = 'badge-info';
                    if (req.status === 'paid' || req.status === 'closed') badgeClass = 'badge-success';
                    if (req.status === 'cancelled') badgeClass = 'badge-danger';
                    if (req.status === 'rfq') badgeClass = 'badge-warning';

                    html += `
                        <tr>
                            <td><strong>${Utils.escapeHtml(req.req_number)}</strong></td>
                            <td>${Utils.formatDate(req.created_at)}</td>
                            <td>${Utils.escapeHtml(req.raised_by_name || 'Unknown')}</td>
                            <td>${req.item_count} items</td>
                            <td><span class="badge ${badgeClass}">${req.status.toUpperCase()}</span></td>
                            <td>${Utils.escapeHtml(req.buyer_name || 'Unassigned')}</td>
                            <td style="max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${Utils.escapeHtml(req.notes)}">
                                ${Utils.escapeHtml(req.notes)}
                            </td>
                            <td>
                                <button class="btn-icon text-primary" onclick="window.ProcurementPage.viewReq(${req.id})" title="View Details">
                                    <i data-feather="eye"></i>
                                </button>
                                ${AppState.user?.role === 'admin' && req.status !== 'closed' && req.status !== 'cancelled' ? `
                                <button class="btn-icon text-success" onclick="window.ProcurementPage.showStatusModal(${req.id}, '${req.status}')" title="Update Status">
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
            content.innerHTML = `<div class="alert alert-danger">Error loading procurement data: ${e.message}</div>`;
        }
    },

    showNewReqModal: function () {
        const formHtml = `
            <form id="req-form">
                <div class="form-group">
                    <label class="form-label">Justification / Notes</label>
                    <textarea id="req-notes" class="form-input" rows="2" placeholder="Why are these items needed?"></textarea>
                </div>
                
                <hr style="margin: 15px 0;">
                <h4>Requested Items</h4>
                <div id="req-items-container">
                    <!-- Item rows will go here -->
                </div>
                
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.ProcurementPage.addReqItemRow()" style="margin-top: 10px; margin-bottom: 20px;">
                    <i data-feather="plus"></i> Add Item
                </button>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Submit Requisition</button>
                    <button type="button" class="btn btn-secondary" onclick="AppModal.close()">Cancel</button>
                </div>
            </form>
        `;

        AppModal.show('Raise Purchase Requisition', formHtml);
        feather.replace();

        // Add first row
        this.addReqItemRow();

        document.getElementById('req-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const rows = document.querySelectorAll('.req-item-row');
            const items = [];
            let valid = true;

            rows.forEach(row => {
                const desc = row.querySelector('.req-desc').value;
                const qty = parseInt(row.querySelector('.req-qty').value);
                const uom = row.querySelector('.req-uom').value;
                const cost = parseFloat(row.querySelector('.req-cost').value || 0);

                if (!desc || isNaN(qty) || qty <= 0 || !uom) {
                    valid = false;
                } else {
                    items.push({ description: desc, quantity: qty, uom: uom, estimated_cost: cost });
                }
            });

            if (!valid || items.length === 0) {
                Toast.show('Please fill out all item fields correctly with positive quantities.', 'error');
                return;
            }

            try {
                const data = {
                    notes: document.getElementById('req-notes').value,
                    items: items
                };
                await API.post('/requisitions', data);
                Toast.show('Requisition raised successfully', 'success');
                AppModal.close();
                this.render();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    },

    addReqItemRow: function () {
        const container = document.getElementById('req-items-container');
        const rowId = 'req-row-' + Date.now();
        const rowHtml = `
            <div id="${rowId}" class="req-item-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-end;">
                <div style="flex: 2;">
                    <label class="form-label" style="font-size: 12px;">Description*</label>
                    <input type="text" class="form-input req-desc" required>
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size: 12px;">Qty*</label>
                    <input type="number" class="form-input req-qty" min="1" required>
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size: 12px;">UOM*</label>
                    <input type="text" class="form-input req-uom" placeholder="e.g. pcs" required>
                </div>
                <div style="flex: 1;">
                    <label class="form-label" style="font-size: 12px;">Est. Cost ($)</label>
                    <input type="number" class="form-input req-cost" step="0.01" min="0">
                </div>
                <div>
                    <button type="button" class="btn-icon text-danger" onclick="document.getElementById('${rowId}').remove()" title="Remove Item">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHtml);
        feather.replace();
    },

    viewReq: async function (id) {
        try {
            const { requisition, items } = await API.get(`/requisitions/${id}`);

            let html = `
                <div style="margin-bottom: 20px;">
                    <p><strong>Req Number:</strong> ${requisition.req_number}</p>
                    <p><strong>Status:</strong> <span class="badge badge-secondary">${requisition.status.toUpperCase()}</span></p>
                    <p><strong>Raised By:</strong> ${requisition.raised_by_name || 'Unknown'}</p>
                    <p><strong>Date:</strong> ${Utils.formatDate(requisition.created_at)}</p>
                    <p><strong>Notes / Justification:</strong> <br>${Utils.escapeHtml(requisition.notes || 'None')}</p>
                </div>
                <h4>Requested Items</h4>
                <table class="table" style="margin-top: 10px;">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>UOM</th>
                            <th>Est. Unit Cost</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totalEstCost = 0;
            items.forEach(item => {
                const cost = parseFloat(item.estimated_cost || 0);
                totalEstCost += (cost * item.quantity);
                html += `
                    <tr>
                        <td>${Utils.escapeHtml(item.description)}</td>
                        <td>${item.quantity}</td>
                        <td>${Utils.escapeHtml(item.uom)}</td>
                        <td>$${cost.toFixed(2)}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: right;"><strong>Total Est. Cost:</strong></td>
                            <td><strong>$${totalEstCost.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-secondary" onclick="AppModal.close()">Close</button>
                </div>
            `;

            AppModal.show(`Requisition Details`, html);
        } catch (e) {
            Toast.show(e.message, 'error');
        }
    },

    showStatusModal: async function (id, currentStatus) {
        // Fetch users to assign buyers
        let usersHtml = '<option value="">-- No specific buyer --</option>';
        try {
            const { users } = await API.get('/users');
            users.forEach(u => {
                usersHtml += `<option value="${u.id}">${Utils.escapeHtml(u.username)} (${u.role})</option>`;
            });
        } catch (e) {
            console.error("Failed to fetch users for buyer drop-down");
        }

        const statuses = ['pending', 'rfq', 'approved', 'po_issued', 'paid', 'closed', 'cancelled'];
        const optionsHtml = statuses.map(s =>
            `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s.toUpperCase()}</option>`
        ).join('');

        const formHtml = `
            <form id="req-status-form">
                <div class="form-group">
                    <label class="form-label">Update Status</label>
                    <select id="req-new-status" class="form-input">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Assign Buyer (Optional)</label>
                    <select id="req-buyer" class="form-input">
                        ${usersHtml}
                    </select>
                    <small class="form-text">Assign a staff member or admin to handle the RFQ/PO phase.</small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                    <button type="button" class="btn btn-secondary" onclick="AppModal.close()">Cancel</button>
                </div>
            </form>
        `;

        AppModal.show('Update Requisition Status', formHtml);

        document.getElementById('req-status-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newStatus = document.getElementById('req-new-status').value;
            const buyerId = document.getElementById('req-buyer').value;

            try {
                await API.put(`/requisitions/${id}/status`, {
                    status: newStatus,
                    buyer_id: buyerId ? parseInt(buyerId) : null
                });
                Toast.show('Status updated successfully', 'success');
                AppModal.close();
                this.render();
            } catch (err) {
                Toast.show(err.message, 'error');
            }
        });
    }
};
