window.StoragePage = {
    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Storage Locations</h2>
                <div class="page-header-actions">
                    <button class="btn btn-ghost" id="heatmap-toggle"><i data-feather="thermometer"></i>Heatmap View</button>
                    ${AppState.user?.role === 'admin' ? '<button class="btn btn-primary" id="add-loc-btn"><i data-feather="plus"></i>Add Location</button>' : ''}
                </div>
            </div>
            <div id="warehouse-map" class="warehouse-grid"></div>`;
        feather.replace();
        this.loadLocations();

        let heatmapActive = false;
        document.getElementById('heatmap-toggle').addEventListener('click', async (e) => {
            heatmapActive = !heatmapActive;
            e.currentTarget.classList.toggle('btn-primary', heatmapActive);
            e.currentTarget.classList.toggle('btn-ghost', !heatmapActive);
            this.loadLocations(heatmapActive);
        });

        const addBtn = document.getElementById('add-loc-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openForm());
    },

    async loadLocations(heatmap = false) {
        try {
            const { locations } = await API.get('/storage');
            let hits = {};
            if (heatmap) {
                const data = await API.get('/storage/heatmap');
                data.hits.forEach(h => hits[h.location_id] = parseInt(h.hit_count));
            }

            const map = document.getElementById('warehouse-map');
            if (!map) return;

            const sectionColors = { A: '#6366f1', B: '#10b981', C: '#f59e0b', D: '#3b82f6', E: '#8b5cf6' };
            const maxHits = Math.max(...Object.values(hits), 1);

            if (!locations.length) { map.innerHTML = '<p class="text-muted">No storage locations defined</p>'; return; }
            map.innerHTML = locations.map(l => {
                let color = sectionColors[l.section] || '#6366f1';
                let heatmapOverlay = '';

                if (heatmap) {
                    const hitCount = hits[l.id] || 0;
                    const intensity = hitCount / maxHits;
                    // Red-to-yellow scale for heatmap
                    color = `rgba(239, 68, 68, ${0.1 + intensity * 0.9})`;
                    heatmapOverlay = `<div style="position:absolute;top:5px;right:10px;font-size:10px;font-weight:bold;color:#fff">${hitCount} hits</div>`;
                }

                const pct = l.capacity > 0 ? Math.round((l.total_items / l.capacity) * 100) : 0;
                return `<div class="location-tile" style="--loc-color:${color}; position:relative; ${heatmap ? 'background:var(--loc-color);color:#fff' : ''}" onclick="StoragePage.viewLocation(${l.id})">
                    ${heatmapOverlay}
                    <div class="location-id" style="${heatmap ? 'color:#fff' : ''}">${l.section}-${l.rack}-${l.shelf}</div>
                    <div class="location-desc" style="${heatmap ? 'color:rgba(255,255,255,0.8)' : ''}">${l.description || 'Storage area'}</div>
                    <div style="font-size:12px; font-weight:bold; color:${heatmap ? '#fff' : 'var(--primary-color)'}; margin-bottom: 8px;">
                        <i data-feather="map-pin" style="width:12px; height:12px;"></i> ${l.warehouse_name || 'Main Warehouse'}
                    </div>
                    <div style="margin-bottom:6px">
                        <div class="stock-bar" style="width:100%;margin-bottom:3px; background:${heatmap ? 'rgba(255,255,255,0.2)' : ''}">
                            <div class="stock-bar-fill stock-ok" style="width:${pct}%; ${heatmap ? 'background:#fff' : ''}"></div>
                        </div>
                        <div class="location-stat" style="${heatmap ? 'color:#fff' : ''}"><span>${l.product_count} products</span><span>${pct}%</span></div>
                    </div>
                </div>`;
            }).join('');
            feather.replace();
        } catch (e) { Toast.error(e.message); }
    },

    async viewLocation(id) {
        Modal.show('Location Details', '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>');
        try {
            const { location, items } = await API.get(`/storage/${id}`);
            document.getElementById('modal-body').innerHTML = `
                <div style="margin-bottom:16px">
                    <div style="font-size:22px;font-weight:800">${location.section}-${location.rack}-${location.shelf}</div>
                    <div class="text-muted">${location.description || ''}</div>
                    <div style="margin-top:5px; font-weight:600; color:var(--primary-color);">
                        Warehouse: ${location.warehouse_name || 'Main Warehouse'}
                    </div>
                </div>
                ${items.length ? `<table style="width:100%"><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit</th></tr></thead>
                <tbody>${items.map(i => `<tr><td>${i.product_name}</td><td>${i.sku}</td><td><strong>${fmt.number(i.quantity)}</strong></td><td>${i.unit}</td></tr>`).join('')}
                </tbody></table>` : '<p class="text-muted text-center" style="padding:20px">No stock in this location</p>'}
            `;
        } catch (e) { Toast.error(e.message); }
    },

    async openForm(location = null) {
        let warehouseOptions = '';
        try {
            const { warehouses } = await API.get('/warehouses');
            warehouseOptions = warehouses.map(w => `<option value="${w.id}" ${location?.warehouse_id === w.id ? 'selected' : ''}>${w.name} (${w.code})</option>`).join('');
        } catch (e) {
            warehouseOptions = '<option value="">Default Warehouse</option>';
        }

        Modal.show(location ? 'Edit Location' : 'Add Storage Location', `
            <form id="loc-form">
                <div class="form-group">
                    <label class="form-label">Warehouse *</label>
                    <select class="form-input" id="lf-warehouse" required>
                        ${warehouseOptions}
                    </select>
                </div>
                <div class="form-row-3">
                    <div class="form-group"><label class="form-label">Section *</label>
                        <input class="form-input" id="lf-section" value="${location?.section || ''}" placeholder="A" maxlength="2" required></div>
                    <div class="form-group"><label class="form-label">Rack *</label>
                        <input class="form-input" id="lf-rack" value="${location?.rack || ''}" placeholder="01" required></div>
                    <div class="form-group"><label class="form-label">Shelf *</label>
                        <input class="form-input" id="lf-shelf" value="${location?.shelf || ''}" placeholder="01" required></div>
                </div>
                <div class="form-group"><label class="form-label">Description</label>
                    <input class="form-input" id="lf-desc" value="${location?.description || ''}" placeholder="e.g. Electronics main storage"></div>
                <div class="form-group"><label class="form-label">Capacity</label>
                    <input class="form-input" id="lf-cap" type="number" min="1" value="${location?.capacity || 100}"></div>
                <div class="modal-footer" style="padding:0;margin-top:16px">
                    <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${location ? 'Save' : 'Add Location'}</button>
                </div>
            </form>
        `);
        document.getElementById('loc-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                warehouse_id: parseInt(document.getElementById('lf-warehouse').value),
                section: document.getElementById('lf-section').value.toUpperCase(),
                rack: document.getElementById('lf-rack').value,
                shelf: document.getElementById('lf-shelf').value,
                description: document.getElementById('lf-desc').value,
                capacity: parseInt(document.getElementById('lf-cap').value) || 100,
            };
            try {
                if (location) await API.put(`/storage/${location.id}`, body);
                else await API.post('/storage', body);
                Modal.close(); Toast.success(location ? 'Location updated!' : 'Location added!');
                this.loadLocations();
            } catch (err) { Toast.error(err.message); }
        });
    },

    async editLocation(id) {
        try {
            const { location } = await API.get(`/storage/${id}`);
            this.openForm(location);
        } catch (e) { Toast.error(e.message); }
    }
};
