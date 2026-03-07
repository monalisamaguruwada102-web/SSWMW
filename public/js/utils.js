// ===================== API Client =====================
const API = {
    async request(path, options = {}) {
        const res = await fetch(`/api${path}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    },
    get: (path, params) => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return API.request(path + query);
    },
    post: (path, body) => API.request(path, { method: 'POST', body }),
    put: (path, body) => API.request(path, { method: 'PUT', body }),
    delete: (path) => API.request(path, { method: 'DELETE' }),
};

// ===================== Toast Notifications =====================
const Toast = {
    show(msg, type = 'success') {
        const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <svg class="toast-icon" data-feather="${icons[type] || 'info'}"></svg>
            <span class="toast-msg">${msg}</span>
        `;
        document.getElementById('toast-container').appendChild(el);
        feather.replace();
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            el.style.transition = 'all 0.3s ease';
            setTimeout(() => el.remove(), 300);
        }, 3500);
    },
    success: (msg) => Toast.show(msg, 'success'),
    error: (msg) => Toast.show(msg, 'error'),
    warning: (msg) => Toast.show(msg, 'warning'),
};

// ===================== Format Helpers =====================
const fmt = {
    date(str) {
        if (!str) return '—';
        return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },
    datetime(str) {
        if (!str) return '—';
        return new Date(str).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    date(str) {
        return new Date(str).toLocaleDateString();
    },
    number(n) {
        return Number(n || 0).toLocaleString();
    },
    movementType(type) {
        const map = { incoming: 'Incoming', outgoing: 'Outgoing', transfer: 'Transfer' };
        return map[type] || type;
    },
    changeType(type) {
        const map = {
            adjustment: 'Manual Adj.', incoming: 'Incoming', outgoing: 'Outgoing',
            transfer_in: 'Transfer In', transfer_out: 'Transfer Out'
        };
        return map[type] || type;
    },
    location(row, prefix = '') {
        const s = prefix;
        if (!row) return '—';
        const section = row[`${s}section`] || row.section;
        const rack = row[`${s}rack`] || row.rack;
        const shelf = row[`${s}shelf`] || row.shelf;
        if (!section) return '—';
        return `${section}-${rack}-${shelf}`;
    },
    statusBadge(status) {
        const map = {
            pending: 'warning', approved: 'info', processing: 'primary',
            completed: 'success', cancelled: 'danger',
            ok: 'success', low: 'warning', out: 'danger',
            incoming: 'success', outgoing: 'danger', transfer: 'info',
        };
        return `<span class="badge badge-${map[status] || 'muted'}">${status}</span>`;
    },
    categoryBadge(name, color) {
        return `<span class="badge" style="background:${color}20;color:${color}">
            <span class="cat-dot" style="background:${color}"></span>${name || '—'}
        </span>`;
    },
    stockStatus(qty, min) {
        qty = Number(qty); min = Number(min);
        if (qty === 0) return { label: 'Out', cls: 'stock-out', badge: 'danger' };
        if (qty <= min) return { label: 'Low', cls: 'stock-low', badge: 'warning' };
        return { label: 'OK', cls: 'stock-ok', badge: 'success' };
    },
    stockBar(qty, min) {
        qty = Number(qty); min = Number(min);
        const s = fmt.stockStatus(qty, min);
        const pct = min > 0 ? Math.min(100, Math.round((qty / (min * 2)) * 100)) : 100;
        return `<div class="stock-bar"><div class="stock-bar-fill ${s.cls}" style="width:${pct}%"></div></div>`;
    }
};

// ===================== Modal Helper =====================
const Modal = {
    show(title, bodyHtml, size = 'medium') {
        const isWide = size === 'large' || size === 'wide';
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal').className = 'modal' + (isWide ? ' modal-lg' : '');
        document.getElementById('modal-overlay').classList.remove('hidden');
        feather.replace();
    },
    close() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('modal-body').innerHTML = '';
    },
    confirm(msg, onConfirm) {
        Modal.show('Confirm Action', `
            <p style="color:var(--text-secondary);margin-bottom:20px;">${msg}</p>
            <div class="modal-footer" style="padding:0">
                <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-danger" id="modal-confirm-btn">Confirm</button>
            </div>
        `);
        document.getElementById('modal-confirm-btn').onclick = () => { Modal.close(); onConfirm(); };
    }
};

// ===================== Scanner Utility =====================
const Scanner = {
    _instance: null,

    show(onScan) {
        Modal.show('Scan Barcode / QR Code', `
            <div id="reader" style="width: 100%; min-height: 300px; background: #000; border-radius: 8px; overflow: hidden;"></div>
            <div class="modal-footer" style="padding:0; margin-top:16px;">
                <button class="btn btn-ghost" id="scan-stop">Close</button>
            </div>
        `);

        this._instance = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        this._instance.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                this.stop();
                Modal.close();
                onScan(decodedText);
            },
            (errorMessage) => { /* ignore framing errors */ }
        ).catch(err => {
            console.error('Scanner error:', err);
            Toast.error('Could not start camera. Check permissions.');
            Modal.close();
        });

        document.getElementById('scan-stop').onclick = () => {
            this.stop();
            Modal.close();
        };
    },

    stop() {
        if (this._instance && this._instance.isScanning) {
            this._instance.stop().catch(e => console.error(e));
        }
    }
};

// ===================== Debounce =====================
function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ===================== CSV Export =====================
function exportCSV(data, filename = 'export.csv') {
    if (!data || !data.length) { Toast.warning('No data to export'); return; }
    const headers = Object.keys(data[0]);
    const rows = [headers, ...data.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`))]
        .map(r => r.join(','));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    Toast.success('CSV exported!');
}

// ===================== PDF Export =====================
function exportPDF(data, filename = 'report.pdf', title = 'Report') {
    if (!data || !data.length) { Toast.warning('No data to export'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    const headers = Object.keys(data[0]);
    const rows = data.map(r => headers.map(h => String(r[h] ?? '')));
    let y = 30;
    const colW = Math.min(40, (doc.internal.pageSize.width - 28) / headers.length);
    // Header row
    doc.setFillColor(99, 102, 241);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y, doc.internal.pageSize.width - 28, 8, 'F');
    headers.forEach((h, i) => doc.text(h, 16 + i * colW, y + 5.5));
    y += 10;
    doc.setTextColor(0, 0, 0);
    rows.forEach(row => {
        if (y > 195) { doc.addPage(); y = 14; }
        row.forEach((cell, i) => doc.text(String(cell).slice(0, 18), 16 + i * colW, y + 5));
        y += 8;
    });
    doc.save(filename);
    Toast.success('PDF exported!');
}

// ===================== General Utilities =====================
const Utils = {
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    formatNumber(n) { return fmt.number(n); },
    formatDate(d) { return fmt.date(d); },
    formatDateTime(d) { return fmt.datetime(d); }
};

// Export for use in other modules
window.API = API;
window.Toast = Toast;
window.fmt = fmt;
window.Modal = Modal;
window.Utils = Utils;
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;
window.debounce = debounce;
