window.UsersPage = {
    async render() {
        if (AppState.user?.role !== 'admin') {
            document.getElementById('page-content').innerHTML = '<div class="alert alert-danger">Access denied</div>';
            return;
        }
        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <h2>User Management</h2>
                <button class="btn btn-primary" id="add-user-btn"><i data-feather="user-plus"></i>Add User</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>
                    <tbody id="users-tbody"></tbody>
                </table>
            </div>`;
        feather.replace();
        this.loadUsers();
        document.getElementById('add-user-btn').addEventListener('click', () => this.openForm());
    },

    async loadUsers() {
        try {
            const { users } = await API.get('/users');
            const tbody = document.getElementById('users-tbody');
            if (!tbody) return;
            tbody.innerHTML = users.map(u => `<tr>
                <td><div style="display:flex;align-items:center;gap:8px">
                    <div class="user-avatar" style="width:28px;height:28px;font-size:12px">${u.username[0].toUpperCase()}</div>
                    <strong>${u.username}</strong>
                </div></td>
                <td>${u.email}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-muted'}">${u.role}</span></td>
                <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${fmt.datetime(u.last_login)}</td>
                <td>${fmt.date(u.created_at)}</td>
                <td>
                    <div style="display:flex;gap:4px">
                        <button class="btn-icon" onclick="UsersPage.editUser(${u.id})" title="Edit"><svg data-feather="edit-2"></svg></button>
                        ${u.id !== AppState.user?.id ? `<button class="btn-icon" onclick="UsersPage.deactivateUser(${u.id},'${u.username}')" title="Deactivate" style="color:var(--danger)"><svg data-feather="user-x"></svg></button>` : ''}
                    </div>
                </td>
            </tr>`).join('');
            feather.replace();
        } catch (e) { Toast.error(e.message); }
    },

    openForm(user = null) {
        Modal.show(user ? 'Edit User' : 'Add User', `
            <form id="user-form">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Username *</label>
                        <input class="form-input" id="uf-username" value="${user?.username || ''}" required ${user ? 'readonly' : ''}></div>
                    <div class="form-group"><label class="form-label">Email *</label>
                        <input class="form-input" id="uf-email" type="email" value="${user?.email || ''}" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Role *</label>
                        <select class="form-select" id="uf-role">
                            <option value="staff" ${user?.role === 'staff' ? 'selected' : ''}>Staff</option>
                            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrator</option>
                        </select></div>
                    <div class="form-group"><label class="form-label">${user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                        <input class="form-input" id="uf-password" type="password" ${user ? '' : 'required'} placeholder="${user ? 'Enter new password to change' : 'Min 6 characters'}"></div>
                </div>
                <div class="modal-footer" style="padding:0;margin-top:16px">
                    <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${user ? 'Save Changes' : 'Add User'}</button>
                </div>
            </form>
        `);
        document.getElementById('user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                username: document.getElementById('uf-username').value,
                email: document.getElementById('uf-email').value,
                role: document.getElementById('uf-role').value,
            };
            const pwd = document.getElementById('uf-password').value;
            if (pwd) body.password = pwd;
            else if (!user) { Toast.error('Password required'); return; }
            try {
                if (user) await API.put(`/users/${user.id}`, body);
                else await API.post('/users', body);
                Modal.close(); Toast.success(user ? 'User updated!' : 'User added!');
                this.loadUsers();
            } catch (err) { Toast.error(err.message); }
        });
    },

    async editUser(id) {
        try {
            const { users } = await API.get('/users');
            const user = users.find(u => u.id === id);
            if (user) this.openForm(user);
        } catch (e) { Toast.error(e.message); }
    },

    deactivateUser(id, name) {
        Modal.confirm(`Deactivate user "<strong>${name}</strong>"? They will not be able to login.`, async () => {
            try {
                await API.delete(`/users/${id}`);
                Toast.success('User deactivated');
                this.loadUsers();
            } catch (e) { Toast.error(e.message); }
        });
    }
};

// Activity Log
window.ActivityPage = {
    async render() {
        if (AppState.user?.role !== 'admin') {
            document.getElementById('page-content').innerHTML = '<div class="alert alert-danger">Access denied</div>';
            return;
        }
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><h2>Activity Log</h2></div>
            <div class="table-container">
                <table>
                    <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>IP Address</th><th>Date</th></tr></thead>
                    <tbody id="act-tbody"></tbody>
                </table>
            </div>`;
        try {
            const { data } = await API.get('/reports/activity', { limit: 100 });
            const tbody = document.getElementById('act-tbody');
            if (!tbody) return;
            if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No activity recorded</td></tr>'; return; }
            tbody.innerHTML = data.map(a => `<tr>
                <td>${a.username || '—'}</td>
                <td><span class="badge ${a.action === 'CREATE' ? 'badge-success' : a.action === 'DELETE' ? 'badge-danger' : 'badge-warning'}">${a.action}</span></td>
                <td>${a.entity_type || '—'}</td>
                <td>${a.entity_id || '—'}</td>
                <td>${a.ip_address || '—'}</td>
                <td style="white-space:nowrap">${fmt.datetime(a.created_at)}</td>
            </tr>`).join('');
        } catch (e) { Toast.error(e.message); }
    }
};
