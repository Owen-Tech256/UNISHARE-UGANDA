// ============ ADMIN PAGES ============

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('moderationList')) initModerationQueue();
    if (document.getElementById('reportsList')) initReports();
    if (document.getElementById('usersList')) initUsers();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ MODERATION QUEUE ============

let modState = { page: 1, status: 'pending' };
let currentRejectId = null;

function initModerationQueue() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            modState.status = btn.dataset.status;
            modState.page = 1;
            loadModerationQueue();
        });
    });

    document.getElementById('confirmReject').addEventListener('click', confirmReject);
    document.getElementById('modEditForm').addEventListener('submit', handleModEdit);
    document.getElementById('generateTempPassword').addEventListener('click', generateTempPassword);

    loadModerationQueue();
    loadModStats();
}

async function loadModerationQueue() {
    const list = document.getElementById('moderationList');
    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';

    const params = new URLSearchParams({ page: modState.page, per_page: 10, status: modState.status });

    try {
        const response = await api(`/api/admin/moderation-queue?${params}`);
        const { resources, total, pages, current_page } = response.data;

        if (resources.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i><h3>Queue is clear</h3><p>No ${modState.status} resources require attention.</p></div>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        list.innerHTML = `<table class="data-table">
            <thead><tr>
                <th>Title</th><th>Course</th><th>Type</th><th>Uploader</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${resources.map(r => `
                    <tr>
                        <td><strong>${escapeHtml(r.title)}</strong><br><small style="color:var(--gray-500);">${escapeHtml(r.lecturer_name)}</small></td>
                        <td>${escapeHtml(r.course_code)}<br><small>${escapeHtml(r.course_name)}</small></td>
                        <td><span class="resource-type-badge">${r.resource_type}</span><br><small>${r.semester} ${r.academic_year}</small></td>
                        <td>${escapeHtml(r.uploader_name || 'Unknown')}</td>
                        <td>${formatDate(r.created_at)}</td>
                        <td>
                            <div class="table-actions">
                                <a href="/download/${r.resource_id}" class="btn btn-sm btn-outline" title="Preview"><i class="fas fa-eye"></i></a>
                                ${r.status === 'pending' ? `
                                    <button class="btn btn-sm btn-primary" onclick="approveResource(${r.resource_id})" title="Approve"><i class="fas fa-check"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="openRejectModal(${r.resource_id})" title="Reject"><i class="fas fa-times"></i></button>
                                ` : ''}
                                <button class="btn btn-sm btn-outline" onclick="openModEditModal(${r.resource_id})" title="Edit"><i class="fas fa-edit"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

        renderPagination(document.getElementById('pagination'), current_page, pages, (p) => {
            modState.page = p;
            loadModerationQueue();
        });
    } catch (error) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${error.message}</p></div>`;
    }
}

async function loadModStats() {
    try {
        const response = await api('/api/admin/stats');
        const stats = response.data;
        document.getElementById('statPending').textContent = stats.pending || 0;
        document.getElementById('statApproved').textContent = stats.approved || 0;
        document.getElementById('statRejected').textContent = stats.rejected || 0;
    } catch (e) { /* ignore */ }
}

async function approveResource(id) {
    if (!confirm('Approve this resource?')) return;
    try {
        const response = await api(`/api/admin/resources/${id}/approve`, { method: 'POST' });
        showToast(response.message, 'success');
        loadModerationQueue();
        loadModStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function openRejectModal(id) {
    currentRejectId = id;
    document.getElementById('rejectReason').value = '';
    openModal('rejectModal');
}

async function confirmReject() {
    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) {
        showToast('Please provide a rejection reason', 'error');
        return;
    }
    try {
        const response = await api(`/api/admin/resources/${currentRejectId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        showToast(response.message, 'success');
        closeModal('rejectModal');
        loadModerationQueue();
        loadModStats();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function openModEditModal(id) {
    try {
        const response = await api(`/api/admin/moderation-queue?per_page=100&status=`);
        const resource = response.data.resources.find(r => r.resource_id === id);
        if (!resource) return;

        document.getElementById('modEditResourceId').value = resource.resource_id;
        document.getElementById('modEditTitle').value = resource.title;
        document.getElementById('modEditCourseCode').value = resource.course_code;
        document.getElementById('modEditCourseName').value = resource.course_name;
        document.getElementById('modEditLecturer').value = resource.lecturer_name;
        document.getElementById('modEditYear').value = resource.academic_year;
        document.getElementById('modEditSemester').value = resource.semester;
        document.getElementById('modEditType').value = resource.resource_type;

        openModal('modEditModal');
    } catch (error) {
        showToast('Failed to load resource', 'error');
    }
}

async function handleModEdit(e) {
    e.preventDefault();
    const id = document.getElementById('modEditResourceId').value;
    try {
        const response = await api(`/api/admin/resources/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: document.getElementById('modEditTitle').value,
                course_code: document.getElementById('modEditCourseCode').value,
                course_name: document.getElementById('modEditCourseName').value,
                lecturer_name: document.getElementById('modEditLecturer').value,
                academic_year: document.getElementById('modEditYear').value,
                semester: document.getElementById('modEditSemester').value,
                resource_type: document.getElementById('modEditType').value
            })
        });
        showToast(response.message, 'success');
        closeModal('modEditModal');
        loadModerationQueue();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function generateTempPassword() {
    const studentNumber = document.getElementById('resetStudentNumber').value.trim();
    const resultDiv = document.getElementById('resetResult');

    if (!/^\d{10}$/.test(studentNumber)) {
        showToast('Please enter a valid 10-digit student number', 'error');
        return;
    }

    try {
        // Find user by student number
        const usersResp = await api(`/api/admin/users?search=${studentNumber}&per_page=5`);
        const user = usersResp.data.users.find(u => u.display_id === studentNumber);
        if (!user) {
            showToast('Student not found in your school', 'error');
            return;
        }

        const response = await api(`/api/admin/users/${user.user_id}/reset-password`, { method: 'POST' });
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="alert alert-success">
                <div>
                    <strong>Password reset for ${escapeHtml(response.data.user_name)}</strong>
                    <p>Temporary password: <code style="background:#fff;padding:0.25rem 0.5rem;border-radius:4px;font-size:1rem;">${response.data.temp_password}</code></p>
                    <p><small>Expires: ${formatDate(response.data.expires_at)}</small></p>
                    <p><small>Share this with the student. They must change it on next login.</small></p>
                </div>
            </div>
        `;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============ REPORTS ============

let reportsState = { page: 1, status: 'open' };

function initReports() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reportsState.status = btn.dataset.status;
            reportsState.page = 1;
            loadReports();
        });
    });
    loadReports();
}

async function loadReports() {
    const list = document.getElementById('reportsList');
    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';

    const params = new URLSearchParams({ page: reportsState.page, per_page: 10, status: reportsState.status });

    try {
        const response = await api(`/api/admin/reports?${params}`);
        const { reports, total, pages, current_page } = response.data;

        if (reports.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No ${reportsState.status} reports</h3><p>All clear!</p></div>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        list.innerHTML = `<table class="data-table">
            <thead><tr>
                <th>Resource</th><th>Reason</th><th>Comment</th><th>Reporter</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${reports.map(r => `
                    <tr>
                        <td><strong>${escapeHtml(r.resource_title)}</strong></td>
                        <td>${escapeHtml(r.reason)}</td>
                        <td>${escapeHtml(r.comment) || '<em style="color:var(--gray-500);">No comment</em>'}</td>
                        <td>${escapeHtml(r.reporter_name)}</td>
                        <td>${formatDate(r.created_at)}</td>
                        <td>
                            <div class="table-actions">
                                ${r.status === 'open' ? `
                                    <button class="btn btn-sm btn-primary" onclick="resolveReport(${r.report_id})"><i class="fas fa-check"></i> Resolve</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteResource(${r.resource_id})"><i class="fas fa-trash"></i> Remove</button>
                                ` : '<span class="status-pill status-approved">Resolved</span>'}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

        renderPagination(document.getElementById('pagination'), current_page, pages, (p) => {
            reportsState.page = p;
            loadReports();
        });
    } catch (error) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${error.message}</p></div>`;
    }
}

async function resolveReport(id) {
    try {
        const response = await api(`/api/admin/reports/${id}/resolve`, { method: 'POST' });
        showToast(response.message, 'success');
        loadReports();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteResource(id) {
    if (!confirm('Remove this resource from public view? This action is reversible by admins.')) return;
    try {
        const response = await api(`/api/admin/resources/${id}/soft-delete`, { method: 'POST' });
        showToast(response.message, 'success');
        loadReports();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============ USERS ============

let usersState = { page: 1, search: '', role: '' };

function initUsers() {
    const searchInput = document.getElementById('userSearch');
    const roleFilter = document.getElementById('roleFilter');

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            usersState.search = searchInput.value;
            usersState.page = 1;
            loadUsers();
        }, 400);
    });

    roleFilter.addEventListener('change', () => {
        usersState.role = roleFilter.value;
        usersState.page = 1;
        loadUsers();
    });

    loadUsers();
}

async function loadUsers() {
    const list = document.getElementById('usersList');
    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading users...</p></div>';

    const params = new URLSearchParams({ page: usersState.page, per_page: 20 });
    if (usersState.search) params.append('search', usersState.search);
    if (usersState.role) params.append('role', usersState.role);

    try {
        // 1. Fetch the users
        const response = await api(`/api/admin/users?${params}`);
        const { users, total, pages, current_page } = response.data;

        // 2. Fetch and update the stats (with better error handling)
        try {
            const statsResponse = await api('/api/admin/stats');
            if (statsResponse && statsResponse.data) {
                document.getElementById('statStudents').textContent = statsResponse.data.total_students || 0;
                document.getElementById('statReps').textContent = statsResponse.data.total_class_reps || 0;
            }
        } catch (statsError) { 
            console.error('⚠️ Failed to load stats:', statsError);
        }

        // 3. Render the table
        if (users.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><h3>No users found</h3><p>Try adjusting your search or filters.</p></div>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        list.innerHTML = `<table class="data-table">
            <thead><tr>
                <th>Name</th><th>ID</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td><strong>${escapeHtml(u.full_name)}</strong></td>
                        <td><code>${escapeHtml(u.display_id)}</code></td>
                        <td>${escapeHtml(u.email)}</td>
                        <td><span class="role-badge role-${u.role}">${u.role.replace('_', ' ')}</span></td>
                        <td>${formatDate(u.created_at)}</td>
                        <td>
                            <div class="table-actions">
                                ${u.role === 'student' ? `<button class="btn btn-sm btn-primary" onclick="promoteUser(${u.user_id}, '${escapeHtml(u.full_name)}')"><i class="fas fa-arrow-up"></i> Promote</button>` : ''}
                                ${u.role === 'class_rep' ? `<button class="btn btn-sm btn-outline" onclick="demoteUser(${u.user_id}, '${escapeHtml(u.full_name)}')"><i class="fas fa-arrow-down"></i> Demote</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

        // 4. Render pagination
        renderPagination(document.getElementById('pagination'), current_page, pages, (p) => {
            usersState.page = p;
            loadUsers();
        });

    } catch (error) {
        console.error('❌ Main loadUsers error:', error);
        list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${error.message}</p></div>`;
    }
}

async function promoteUser(id, name) {
    if (!confirm(`Promote ${name} to Class Representative?`)) return;
    try {
        const response = await api(`/api/admin/users/${id}/promote`, { method: 'POST' });
        showToast(response.message, 'success');
        loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function demoteUser(id, name) {
    if (!confirm(`Demote ${name} back to Student? Their approved uploads will remain visible.`)) return;
    try {
        const response = await api(`/api/admin/users/${id}/demote`, { method: 'POST' });
        showToast(response.message, 'success');
        loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}