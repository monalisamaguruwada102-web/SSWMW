// Auth Module — handles login form
(function () {
    function init() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            const errEl = document.getElementById('login-error');
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            errEl.classList.add('hidden');
            btn.disabled = true;
            btn.innerHTML = '<span>Signing in...</span>';

            try {
                const { user } = await API.post('/auth/login', { username, password });
                window.showApp(user);
            } catch (err) {
                errEl.textContent = err.message || 'Invalid credentials';
                errEl.classList.remove('hidden');
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In</span>';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();
        feather.replace();
    });
})();
