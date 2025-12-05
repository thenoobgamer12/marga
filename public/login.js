document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        errorMessage.textContent = '';
        loginButton.disabled = true;

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await res.json();

            if (result.success) {
                // Save user info and redirect to the console
                localStorage.setItem('marga-user', JSON.stringify(result.user));
                window.location.href = '/gui.html'; // The GUI page
            } else {
                errorMessage.textContent = result.message || 'Login failed.';
            }

        } catch (error) {
            errorMessage.textContent = 'An error occurred. Please try again.';
        } finally {
            loginButton.disabled = false;
        }
    });
});
