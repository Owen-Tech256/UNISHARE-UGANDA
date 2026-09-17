// Profile Page Functionality

document.addEventListener('DOMContentLoaded', () => {
    initProfileForm();
    initPasswordForm();
    
    // Load stats for moderators/admins
    if (typeof forceChange !== 'undefined' && !forceChange) {
        loadActivityStats();
    }
});

function initProfileForm() {
    const form = document.getElementById('profileForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            full_name: document.getElementById('fullName').value,
            email: document.getElementById('email').value
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Profile updated successfully!', 'success');
                // Update the header name if it exists
                const headerName = document.querySelector('.profile-header-info h1');
                if (headerName) {
                    headerName.textContent = formData.full_name;
                }
            } else {
                showToast(data.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            showToast('An error occurred. Please try again.', 'error');
            console.error('Profile update error:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

function initPasswordForm() {
    const form = document.getElementById('passwordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword')?.value || '';
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (newPassword.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        try {
            const response = await fetch('/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Password updated successfully!', 'success');
                form.reset();
                
                // If this was a forced password change, redirect
                if (typeof forceChange !== 'undefined' && forceChange) {
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                }
            } else {
                showToast(data.message || 'Failed to update password', 'error');
            }
        } catch (error) {
            showToast('An error occurred. Please try again.', 'error');
            console.error('Password update error:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

async function loadActivityStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.data;
            
            // Update moderator stats
            const pendingEl = document.getElementById('pendingCount');
            const approvedEl = document.getElementById('approvedCount');
            if (pendingEl) pendingEl.textContent = stats.pending || 0;
            if (approvedEl) approvedEl.textContent = stats.approved || 0;
            
            // Update admin stats
            const userEl = document.getElementById('userCount');
            const repEl = document.getElementById('repCount');
            if (userEl) userEl.textContent = stats.total_students || 0;
            if (repEl) repEl.textContent = stats.total_class_reps || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function resetForm() {
    if (confirm('Are you sure you want to reset the form? All changes will be lost.')) {
        document.getElementById('profileForm').reset();
        // Reload original values
        location.reload();
    }
}

function togglePasswordVisibility(inputId, btn) {
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

function showToast(message, type = 'info') {
    // Use the global toast function from main.js if available
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // Fallback to alert
        alert(message);
    }
}