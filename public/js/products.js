window.ProductsPage = {
    products: [], categories: [], search: '', categoryFilter: '',

    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>Products</h2>
                <div class="page-header-actions">
                    <div class="search-wrap"><i data-feather="search" class="input-icon"></i>
                        <input type="text" class="search-input" id="prod-search" placeholder="Search products...">
                    </div>
                    <select class="form-select" id="prod-cat-filter" style="width:150px">
                        <option value="">All Categories</option>
                    </select>
                    ${AppState.user?.role === 'admin' ? '<button class="btn btn-primary" id="add-prod-btn"><i data-feather="plus"></i>Add Product</button>' : ''}
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>Product</th><th>SKU</th><th>Category</th>
                        <th>Unit</th><th>Stock</th><th>Min Level</th><th>Status</th>
                        ${AppState.user?.role === 'admin' ? '<th>Actions</th>' : ''}
                    </tr></thead>
                    <tbody id="prod-tbody"></tbody>
                </table>
            </div>`;
        feather.replace();
        await this.loadCategories();
        await this.loadProducts();
        this.bindEvents();
    },

    async loadCategories() {
        try {
            const { categories } = await API.get('/categories');
            this.categories = categories;
            const sel = document.getElementById('prod-cat-filter');
            if (sel) sel.innerHTML = '<option value="">All Categories</option>' +
                categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        } catch { }
    },

    async loadProducts() {
        try {
            const params = {};
            if (this.search) params.search = this.search;
            if (this.categoryFilter) params.category_id = this.categoryFilter;
            const { products } = await API.get('/products', params);
            this.products = products;
            this.renderTable();
        } catch (e) { Toast.error('Error loading products: ' + e.message); }
    },

    renderTable() {
        const tbody = document.getElementById('prod-tbody');
        if (!tbody) return;
        if (!this.products.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><svg data-feather="package"></svg><div>No products found</div></td></tr>`;
            feather.replace(); return;
        }
        const isAdmin = AppState.user?.role === 'admin';
        tbody.innerHTML = this.products.map(p => {
            const s = fmt.stockStatus(p.total_stock, p.min_stock_level);
            return `<tr>
                <td><div style="font-weight:600">${p.name}</div></td>
                <td><code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-size:12px">${p.sku}</code></td>
                <td>${p.category_name ? fmt.categoryBadge(p.category_name, p.category_color) : '—'}</td>
                <td>${p.unit}</td>
                <td><strong>${fmt.number(p.total_stock)}</strong></td>
                <td>${p.min_stock_level}</td>
                <td><span class="badge badge-${s.badge}">${s.label}</span></td>
                ${isAdmin ? `<td>
                    <div style="display:flex;gap:4px">
                        <button class="btn-icon" onclick="ProductsPage.editProduct(${p.id})" title="Edit"><svg data-feather="edit-2"></svg></button>
                        <button class="btn-icon" onclick="ProductsPage.deleteProduct(${p.id},'${p.name}')" title="Delete" style="color:var(--danger)"><svg data-feather="trash-2"></svg></button>
                    </div>
                </td>` : ''}
            </tr>`;
        }).join('');
        feather.replace();
    },

    bindEvents() {
        const search = document.getElementById('prod-search');
        if (search) search.addEventListener('input', debounce(e => {
            this.search = e.target.value; this.loadProducts();
        }));
        const catFilter = document.getElementById('prod-cat-filter');
        if (catFilter) catFilter.addEventListener('change', e => {
            this.categoryFilter = e.target.value; this.loadProducts();
        });
        const addBtn = document.getElementById('add-prod-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openProductForm());
    },

    openProductForm(product = null) {
        const cats = this.categories.map(c => `<option value="${c.id}" ${product?.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('');
        Modal.show(product ? 'Edit Product' : 'Add Product', `
            <form id="prod-form">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Product Name *</label>
                        <input class="form-input" id="pf-name" value="${product?.name || ''}" placeholder="Enter product name" required></div>
                    <div class="form-group"><label class="form-label">SKU *</label>
                        <input class="form-input" id="pf-sku" value="${product?.sku || ''}" placeholder="e.g. USB001" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Category</label>
                        <select class="form-select" id="pf-cat"><option value="">No Category</option>${cats}</select></div>
                    <div class="form-group"><label class="form-label">Unit</label>
                        <select class="form-select" id="pf-unit">
                            ${['pcs', 'box', 'set', 'roll', 'ream', 'pair', 'kg', 'L', 'm', 'sheet'].map(u => `<option ${product?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                        </select></div>
                </div>
                <div class="form-group"><label class="form-label">Min Stock Level</label>
                    <input class="form-input" id="pf-min" type="number" min="0" value="${product?.min_stock_level ?? 0}"></div>
                <div class="form-group"><label class="form-label">Description</label>
                    <textarea class="form-textarea" id="pf-desc">${product?.description || ''}</textarea></div>
                <div class="modal-footer" style="padding:0;margin-top:16px">
                    <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${product ? 'Save Changes' : 'Add Product'}</button>
                </div>
            </form>
        `);
        document.getElementById('prod-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                name: document.getElementById('pf-name').value,
                sku: document.getElementById('pf-sku').value,
                category_id: document.getElementById('pf-cat').value || null,
                unit: document.getElementById('pf-unit').value,
                min_stock_level: parseInt(document.getElementById('pf-min').value) || 0,
                description: document.getElementById('pf-desc').value,
            };
            try {
                if (product) await API.put(`/products/${product.id}`, body);
                else await API.post('/products', body);
                Modal.close();
                Toast.success(product ? 'Product updated!' : 'Product added!');
                this.loadProducts();
            } catch (err) { Toast.error(err.message); }
        });
    },

    async editProduct(id) {
        try {
            const { product } = await API.get(`/products/${id}`);
            this.openProductForm(product);
        } catch (e) { Toast.error(e.message); }
    },

    deleteProduct(id, name) {
        Modal.confirm(`Delete product "<strong>${name}</strong>"? This cannot be undone.`, async () => {
            try {
                await API.delete(`/products/${id}`);
                Toast.success('Product deleted');
                this.loadProducts();
            } catch (e) { Toast.error(e.message); }
        });
    }
};
window.ProductsPage = window.ProductsPage;
