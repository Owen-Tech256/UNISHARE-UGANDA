// ============ UPLOAD PAGE ============

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('uploadForm')) {
        initUploadForm();
    }
    if (document.getElementById('uploadsList')) {
        initMyUploads();
    }
});

function initUploadForm() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file');
    const uploadArea = document.getElementById('fileUploadArea');
    const filePreview = document.getElementById('filePreview');

    // Drag and drop
    ['dragenter', 'dragover'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
    });
    uploadArea.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            showFilePreview(e.dataTransfer.files[0]);
        }
    });
    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) showFilePreview(fileInput.files[0]);
    });

    // Duplicate check
    const checkFields = ['title', 'course_code', 'academic_year', 'semester', 'resource_type'];
    let dupTimeout;
    checkFields.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            clearTimeout(dupTimeout);
            dupTimeout = setTimeout(checkDuplicates, 500);
        });
    });

    form.addEventListener('submit', handleUpload);
}

function showFilePreview(file) {
    const preview = document.getElementById('filePreview');
    const name = document.getElementById('fileName');
    const size = document.getElementById('fileSize');
    name.textContent = file.name;
    size.textContent = formatFileSize(file.size);
    preview.style.display = 'flex';
    document.getElementById('fileUploadArea').style.display = 'none';
}

function clearFile() {
    document.getElementById('file').value = '';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('fileUploadArea').style.display = 'block';
}

async function checkDuplicates() {
    const data = {
        title: document.getElementById('title').value,
        course_code: document.getElementById('course_code').value,
        academic_year: document.getElementById('academic_year').value,
        semester: document.getElementById('semester').value,
        resource_type: document.getElementById('resource_type').value
    };

    if (!data.title || !data.course_code) return;

    try {
        const response = await api('/api/uploads/check-duplicate', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const warning = document.getElementById('duplicateWarning');
        const details = document.getElementById('duplicateDetails');
        if (response.data.count > 0) {
            details.innerHTML = `Found ${response.data.count} similar upload(s):<br>` +
                response.data.duplicates.slice(0, 3).map(d => `• ${escapeHtml(d.title)} (${d.status})`).join('<br>');
            warning.style.display = 'flex';
        } else {
            warning.style.display = 'none';
        }
    } catch (e) { /* ignore */ }
}

async function handleUpload(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    const formData = new FormData(e.target);
    try {
        const response = await fetch('/api/uploads', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            showToast(data.message, 'success');
            setTimeout(() => window.location.href = '/my-uploads', 1000);
        } else {
            showToast(data.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
        }
    } catch (error) {
        showToast('Upload failed: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ MY UPLOADS ============

let uploadsState = { page: 1, status: '' };

function initMyUploads() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            uploadsState.status = btn.dataset.status;
            uploadsState.page = 1;
            loadMyUploads();
        });
    });

    document.getElementById('editForm').addEventListener('submit', handleEditSubmit);
    loadMyUploads();
}

async function loadMyUploads() {
    const list = document.getElementById('uploadsList');
    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';

    const params = new URLSearchParams({ page: uploadsState.page, per_page: 10 });
    if (uploadsState.status) params.append('status', uploadsState.status);

    try {
        const response = await api(`/api/uploads?${params}`);
        const { resources, total, pages, current_page } = response.data;

        // Update stats
        updateUploadStats();

        if (resources.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No uploads yet</h3><p>Start by uploading your first resource!</p></div>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        list.innerHTML = resources.map(r => `
            <div class="upload-item">
                <div class="upload-item-info">
                    <h4>${escapeHtml(r.title)}</h4>
                    <div class="upload-item-meta">
                        <span><i class="fas fa-hashtag"></i> ${escapeHtml(r.course_code)}</span>
                        <span><i class="fas fa-file"></i> ${escapeHtml(r.resource_type)}</span>
                        <span><i class="fas fa-calendar"></i> ${formatDate(r.created_at)}</span>
                    </div>
                    ${r.status === 'rejected' && r.rejection_reason ? `<div class="rejection-reason"><strong>Reason:</strong> ${escapeHtml(r.rejection_reason)}</div>` : ''}
                </div>
                <div class="table-actions">
                    <span class="status-pill status-${r.status}">${r.status}</span>
                    ${r.status === 'rejected' ? `<button class="btn btn-sm btn-primary" onclick="openEditModal(${r.resource_id})"><i class="fas fa-edit"></i> Edit & Resubmit</button>` : ''}
                </div>
            </div>
        `).join('');

        renderPagination(document.getElementById('pagination'), current_page, pages, (p) => {
            uploadsState.page = p;
            loadMyUploads();
        });
    } catch (error) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${error.message}</p></div>`;
    }
}

async function updateUploadStats() {
    try {
        const [pending, approved, rejected] = await Promise.all([
            api('/api/uploads?status=pending&per_page=1'),
            api('/api/uploads?status=approved&per_page=1'),
            api('/api/uploads?status=rejected&per_page=1')
        ]);
        document.getElementById('statPending').textContent = pending.data.total;
        document.getElementById('statApproved').textContent = approved.data.total;
        document.getElementById('statRejected').textContent = rejected.data.total;
    } catch (e) { /* ignore */ }
}

async function openEditModal(resourceId) {
    try {
        const response = await api(`/api/uploads?per_page=100`);
        const resource = response.data.resources.find(r => r.resource_id === resourceId);
        if (!resource) return;

        document.getElementById('editResourceId').value = resource.resource_id;
        document.getElementById('editTitle').value = resource.title;
        document.getElementById('editCourseCode').value = resource.course_code;
        document.getElementById('editCourseName').value = resource.course_name;
        document.getElementById('editLecturer').value = resource.lecturer_name;
        document.getElementById('editYear').value = resource.academic_year;
        document.getElementById('editSemester').value = resource.semester;
        document.getElementById('editType').value = resource.resource_type;
        document.getElementById('editFile').value = '';

        openModal('editModal');
    } catch (error) {
        showToast('Failed to load resource', 'error');
    }
}

async function handleEditSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editResourceId').value;
    const formData = new FormData();
    formData.append('title', document.getElementById('editTitle').value);
    formData.append('course_code', document.getElementById('editCourseCode').value);
    formData.append('course_name', document.getElementById('editCourseName').value);
    formData.append('lecturer_name', document.getElementById('editLecturer').value);
    formData.append('academic_year', document.getElementById('editYear').value);
    formData.append('semester', document.getElementById('editSemester').value);
    formData.append('resource_type', document.getElementById('editType').value);

    const file = document.getElementById('editFile').files[0];
    if (file) formData.append('file', file);

    try {
        const response = await fetch(`/api/uploads/${id}`, { method: 'PUT', body: formData });
        const data = await response.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('editModal');
            loadMyUploads();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Update failed: ' + error.message, 'error');
    }
}