window.NotificationsModule = {
    async loadBadge() {
        try {
            const { unreadCount } = await API.get('/notifications');
            const badge = document.getElementById('notif-badge');
            if (!badge) return;
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        } catch { }
    },

    async loadDropdown() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        try {
            const { notifications } = await API.get('/notifications');
            if (!notifications.length) {
                list.innerHTML = '<div class="notif-empty">No notifications</div>';
                return;
            }
            list.innerHTML = notifications.map(n => `
                <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="NotificationsModule.markRead(${n.id}, this)">
                    <div class="notif-icon ${n.type === 'low_stock' ? 'low-stock' : 'info'}">
                        <svg data-feather="${n.type === 'low_stock' ? 'alert-triangle' : 'info'}"></svg>
                    </div>
                    <div class="notif-text">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-msg">${n.message}</div>
                        <div class="notif-time">${fmt.datetime(n.created_at)}</div>
                    </div>
                </div>
            `).join('');
            feather.replace();
        } catch (e) { }
    },

    async markRead(id, el) {
        try {
            await API.put(`/notifications/${id}/read`, {});
            el.classList.remove('unread');
            this.loadBadge();
        } catch { }
    },

    async markAllRead() {
        try {
            await API.put('/notifications/read-all', {});
            document.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
            document.getElementById('notif-badge')?.classList.add('hidden');
        } catch { }
    }
};

// Init notification toggle
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('notif-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const markAllBtn = document.getElementById('mark-all-read');

    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            NotificationsModule.loadDropdown();
        }
    });

    markAllBtn?.addEventListener('click', () => NotificationsModule.markAllRead());

    document.addEventListener('click', (e) => {
        if (!dropdown?.contains(e.target) && e.target !== btn) {
            dropdown?.classList.add('hidden');
        }
    });
});
