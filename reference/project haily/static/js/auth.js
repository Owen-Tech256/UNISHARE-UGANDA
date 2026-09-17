// ============ AUTHENTICATION & LOGIN LOGIC ============

document.addEventListener('DOMContentLoaded', () => {
    initLoginToggle();
    initLoginForm();
    initForceChangeModal();
});

let currentRole = 'student';

function initLoginToggle() {
    const toggleStudent = document.getElementById('toggleStudent');
    const toggleStaff = document.getElementById('toggleStaff');
    const identifierInput = document.getElementById('identifier');
    const identifierLabel = document.getElementById('identifierLabel');
    const identifierHint = document.getElementById('identifierHint');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const forgotLink = document.getElementById('forgotLink');
    const registerPrompt = document.getElementById('registerPrompt');

    function setRole(role) {
        currentRole = role;
        if (role === 'student') {
            toggleStudent.classList.add('active');
            toggleStaff.classList.remove('active');
            identifierLabel.textContent = 'Student Number';
            identifierInput.placeholder = 'e.g. 2400104444';
            identifierInput.pattern = '\\d{10}';
            identifierInput.maxLength = 10;
            identifierInput.inputMode = 'numeric';
            identifierHint.textContent = 'Must contain exactly 10 digits.';
            identifierHint.style.display = 'block';
            btnText.textContent = 'LOGIN';
            forgotLink.style.display = 'block';
            registerPrompt.style.display = 'block';
        } else {
            toggleStaff.classList.add('active');
            toggleStudent.classList.remove('active');
            identifierLabel.textContent = 'Staff ID';
            identifierInput.placeholder = 'Your Staff ID';
            identifierInput.pattern = '.+';
            identifierInput.maxLength = 20;
            identifierInput.inputMode = 'text';
            identifierHint.textContent = 'Enter your official Nkumba University Staff ID.';
            identifierHint.style.display = 'block';
            btnText.textContent = 'STAFF LOGIN';
            forgotLink.style.display = 'none';
            registerPrompt.style.display = 'none';
        }
        identifierInput.value = ''; // Clear input on toggle
    }

    if (toggleStudent) toggleStudent.addEventListener('click', () => setRole('student'));
    if (toggleStaff) toggleStaff.addEventListener('click', () => setRole('staff'));
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const btnText = document.getElementById('btnText');
        const btnSpinner = document.getElementById('btnSpinner');

        // Frontend validation
        if (currentRole === 'student' && !/^\d{10}$/.test(identifier)) {
            showToast('Student Number must contain exactly 10 digits.', 'error');
            return;
        }
        if (currentRole === 'staff' && identifier.length < 3) {
            showToast('Please enter a valid Staff ID.', 'error');
            return;
        }

        // UI Loading state
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'inline-block';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Authentication failed');
            }

            showToast('Login successful. Redirecting...', 'success');

            // Handle temporary password force-change
            if (data.must_change_password) {
                setTimeout(() => {
                    openModal('forceChangeModal');
                }, 500);
            } else {
                setTimeout(() => {
                    window.location.href = data.redirect_url;
                }, 500);
            }

        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            loginBtn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    });
}

function initForceChangeModal() {
    const form = document.getElementById('forceChangeForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('fcNewPassword').value;
        const confirmPassword = document.getElementById('fcConfirmPassword').value;

        if (newPassword.length < 8) {
            showToast('New password must be at least 8 characters.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        try {
            const response = await fetch('/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: '', // Bypassed on backend for temp passwords
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();
            if (data.success) {
                showToast('Password changed successfully!', 'success');
                closeModal('forceChangeModal');
                window.location.href = '/'; // Redirect to dashboard
            } else {
                showToast(data.message, 'error');
            }
        } catch (error) {
            showToast('Failed to update password. Please try again.', 'error');
        }
    });
}

// ============ GLOBAL UTILITIES ============

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    // Prevent closing the force change modal
    if (id === 'forceChangeModal') return;
    document.getElementById(id).classList.remove('active');
}

// Close modal on backdrop click (except force change)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.id !== 'forceChangeModal') {
        e.target.classList.remove('active');
    }
});

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}