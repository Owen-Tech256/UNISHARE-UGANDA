let currentFilter = 'all';
let currentPage = 1;

document.addEventListener('DOMContentLoaded', function() {
    loadUploads();
    setupFilters();
    setupSearch();
});

function setupFilters() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            currentPage = 1;
            loadUploads();
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchUploads');
    searchInput.addEventListener('input', function() {
        currentPage = 1;
        loadUploads();
    });
}

async function loadUploads() {
    const list = document.getElementById('uploadsList');
    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading your uploads...</p></div>';

    try {
        const params = new URLSearchParams({
            page: currentPage,
            per_page: 10,
            status: currentFilter === 'all' ? '' : currentFilter,
            search: document.getElementById('searchUploads').value
        });

        const response = await fetch(`/api/uploads?${params}`, {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (data.success) {
            updateStats(data.data);
            renderUploads(data.data.resources);
            renderPagination(data.data);
        }
    } catch (error) {
        console.error('Error loading uploads:', error);
        list.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>Failed to load uploads. Please refresh the page.</p></div>';
    }
}

function updateStats(data) {
    // Update stat numbers based on the resources returned
    const resources = data.resources || [];
    const pending = resources.filter(r => r.status === 'pending').length;
    const approved = resources.filter(r => r.status === 'approved').length;
    const rejected = resources.filter(r => r.status === 'rejected').length;

    // For accurate stats, we'd need a separate stats endpoint
    // For now, we'll just show what we have
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statApproved').textContent = approved;
    document.getElementById('statRejected').textContent = rejected;
}

function renderUploads(resources) {
    const list = document.getElementById('uploadsList');

    if (resources.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No uploads found</h3>
                <p>You haven't uploaded any resources yet. Click "New Upload" to get started!</p>
            </div>
        `;
        return;
    }

    list.innerHTML = resources.map(resource => `
        <div class="upload-item" onclick="viewResourceDetails(${resource.resource_id})">
            <div class="upload-item-header">
                <div class="upload-item-info">
                    <h3 class="upload-title">${escapeHtml(resource.title)}</h3>
                    <div class="upload-meta">
                        <div class="upload-meta-item">
                            <i class="fas fa-hashtag"></i>
                            <span>${escapeHtml(resource.course_code)}</span>
                        </div>
                        <div class="upload-meta-item">
                            <i class="fas fa-book"></i>
                            <span>${escapeHtml(resource.course_name)}</span>
                        </div>
                        <div class="upload-meta-item">
                            <i class="fas fa-tag"></i>
                            <span>${escapeHtml(resource.resource_type)}</span>
                        </div>
                        <div class="upload-meta-item">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${escapeHtml(resource.academic_year)} • ${escapeHtml(resource.semester)}</span>
                        </div>
                    </div>
                </div>
                <div class="upload-actions">
                    <span class="status-badge ${resource.status}">
                        <i class="fas fa-${getStatusIcon(resource.status)}"></i>
                        ${resource.status}
                    </span>
                    ${resource.status === 'rejected' ? `
                        <button class="action-btn" onclick="event.stopPropagation(); resubmitResource(${resource.resource_id})" title="Resubmit">
                            <i class="fas fa-redo"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" onclick="event.stopPropagation(); deleteResource(${resource.resource_id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="upload-item-footer">
                <div class="upload-stats">
                    <div class="upload-stat">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${resource.upvotes || 0} upvotes</span>
                    </div>
                    <div class="upload-stat">
                        <i class="fas fa-download"></i>
                        <span>${resource.downloads || 0} downloads</span>
                    </div>
                </div>
                <div class="upload-date">
                    <i class="fas fa-clock"></i>
                    ${formatDate(resource.created_at)}
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusIcon(status) {
    const icons = {
        'pending': 'clock',
        'approved': 'check',
        'rejected': 'times'
    };
    return icons[status] || 'circle';
}

function renderPagination(data) {
    const pagination = document.getElementById('pagination');
    
    if (data.pages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '<div class="pagination-controls">';
    
    // Previous button
    html += `
        <button class="pagination-btn" ${data.current_page === 1 ? 'disabled' : ''} 
                onclick="changePage(${data.current_page - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // Page numbers
    for (let i = 1; i <= data.pages; i++) {
        if (i === 1 || i === data.pages || (i >= data.current_page - 2 && i <= data.current_page + 2)) {
            html += `
                <button class="pagination-btn ${i === data.current_page ? 'active' : ''}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === data.current_page - 3 || i === data.current_page + 3) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }

    // Next button
    html += `
        <button class="pagination-btn" ${data.current_page === data.pages ? 'disabled' : ''} 
                onclick="changePage(${data.current_page + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    html += '</div>';
    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadUploads();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function viewResourceDetails(resourceId) {
    // Show modal with resource details
    const modal = document.getElementById('resourceModal');
    const content = document.getElementById('modalContent');
    
    try {
        const response = await fetch(`/api/resources/${resourceId}`);
        const data = await response.json();
        
        if (data.success) {
            const resource = data.data;
            content.innerHTML = `
                <div class="resource-detail-view">
                    <h3>${escapeHtml(resource.title)}</h3>
                    <div class="detail-grid">
                        <div><strong>Course:</strong> ${escapeHtml(resource.course_code)} - ${escapeHtml(resource.course_name)}</div>
                        <div><strong>Lecturer:</strong> ${escapeHtml(resource.lecturer_name)}</div>
                        <div><strong>Type:</strong> ${escapeHtml(resource.resource_type)}</div>
                        <div><strong>Semester:</strong> ${escapeHtml(resource.semester)} ${escapeHtml(resource.academic_year)}</div>
                        <div><strong>Status:</strong> <span class="status-badge ${resource.status}">${resource.status}</span></div>
                        ${resource.rejection_reason ? `<div><strong>Rejection Reason:</strong> ${escapeHtml(resource.rejection_reason)}</div>` : ''}
                    </div>
                </div>
            `;
            
            const resubmitBtn = document.getElementById('resubmitBtn');
            resubmitBtn.style.display = resource.status === 'rejected' ? 'inline-flex' : 'none';
            resubmitBtn.onclick = () => resubmitResource(resourceId);
            
            modal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load resource details', 'error');
    }
}

async function resubmitResource(resourceId) {
    if (!confirm('Are you sure you want to resubmit this resource?')) return;

    try {
        const response = await fetch(`/api/uploads/${resourceId}/resubmit`, {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (data.success) {
            showToast('Resource resubmitted successfully!', 'success');
            closeModal('resourceModal');
            loadUploads();
        } else {
            showToast(data.message || 'Failed to resubmit', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred', 'error');
    }
}

async function deleteResource(resourceId) {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/resources/${resourceId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (data.success) {
            showToast('Resource deleted successfully', 'success');
            loadUploads();
        } else {
            showToast(data.message || 'Failed to delete', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred', 'error');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-UG', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
}

function showToast(message, type = 'info') {
    // You can implement a toast notification system here
    alert(`${type.toUpperCase()}: ${message}`);
}