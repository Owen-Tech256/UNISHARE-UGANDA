// ============ BROWSE PAGE ============

let browseState = { page: 1, search: '', school: '', type: '', semester: '', course: '', year: '', sort: 'newest' };

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on browse page
    if (document.getElementById('searchInput')) {
        initBrowse();
    }
    // Check if we're on resource detail page
    if (typeof resourceId !== 'undefined') {
        initResourceDetail();
    }
});

function initBrowse() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const filterSchool = document.getElementById('filterSchool');
    const filterType = document.getElementById('filterType');
    const filterSemester = document.getElementById('filterSemester');
    const filterCourse = document.getElementById('filterCourse');
    const filterYear = document.getElementById('filterYear');
    const sortBy = document.getElementById('sortBy');

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            browseState.search = searchInput.value;
            browseState.page = 1;
            loadResources();
        }, 300);
    });

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        browseState.search = '';
        browseState.page = 1;
        loadResources();
    });

    [filterSchool, filterType, filterSemester, sortBy].forEach(el => {
        el.addEventListener('change', () => {
            browseState.school = filterSchool.value;
            browseState.type = filterType.value;
            browseState.semester = filterSemester.value;
            browseState.sort = sortBy.value;
            browseState.page = 1;
            loadResources();
        });
    });

    let courseTimeout, yearTimeout;
    filterCourse.addEventListener('input', () => {
        clearTimeout(courseTimeout);
        courseTimeout = setTimeout(() => {
            browseState.course = filterCourse.value;
            browseState.page = 1;
            loadResources();
        }, 400);
    });
    filterYear.addEventListener('input', () => {
        clearTimeout(yearTimeout);
        yearTimeout = setTimeout(() => {
            browseState.year = filterYear.value;
            browseState.page = 1;
            loadResources();
        }, 400);
    });

    loadResources();
}

async function loadResources() {
    const grid = document.getElementById('resourcesGrid');
    const info = document.getElementById('resultsInfo');
    grid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading resources...</p></div>';

    const params = new URLSearchParams({
        page: browseState.page,
        per_page: 12,
        search: browseState.search,
        school_id: browseState.school,
        resource_type: browseState.type,
        semester: browseState.semester,
        course_code: browseState.course,
        academic_year: browseState.year,
        sort: browseState.sort
    });

    try {
        const response = await api(`/api/resources?${params}`);
        const { resources, total, pages, current_page } = response.data;

        info.textContent = total > 0 ? `Showing ${resources.length} of ${total} resources` : '';

        if (resources.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-search"></i>
                    <h3>No resources found</h3>
                    <p>Try changing your search or filters.</p>
                </div>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

                grid.innerHTML = resources.map(r => {
            // Generate a clean CSS class name for the resource type (e.g., "Past Paper" -> "past-paper")
            const typeClass = r.resource_type.toLowerCase().replace(/\s+/g, '-');
            
            return `
            <div class="resource-card" onclick="window.location.href='/resource/${r.resource_id}'">
                <div class="card-top-accent type-${typeClass}"></div>
                <div class="card-body">
                    <div class="card-header-row">
                        <span class="type-badge type-${typeClass}">${r.resource_type}</span>
                        <span class="card-school"><i class="fas fa-university"></i> ${escapeHtml(r.school_name)}</span>
                    </div>
                    
                    <h3 class="card-title">${escapeHtml(r.title)}</h3>
                    
                    <div class="card-course">
                        <span class="course-code">${escapeHtml(r.course_code)}</span>
                        <span class="course-name">${escapeHtml(r.course_name)}</span>
                    </div>
                    
                    <div class="card-meta">
                        <div class="meta-row"><i class="fas fa-chalkboard-teacher"></i> <span>${escapeHtml(r.lecturer_name)}</span></div>
                        <div class="meta-row"><i class="fas fa-calendar-alt"></i> <span>${escapeHtml(r.academic_year)} • ${escapeHtml(r.semester)}</span></div>
                    </div>
                </div>
                
                <div class="card-footer">
                    <div class="card-stats">
                        <span class="stat-item"><i class="fas fa-thumbs-up"></i> ${r.upvotes} upvotes</span>
                    </div>
                    <span class="card-date">${formatDate(r.created_at)}</span>
                </div>
            </div>
            `;
        }).join('');

        renderPagination(document.getElementById('pagination'), current_page, pages, (p) => {
            browseState.page = p;
            loadResources();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    } catch (error) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-exclamation-triangle"></i><h3>Error loading resources</h3><p>${error.message}</p></div>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ RESOURCE DETAIL ============

function initResourceDetail() {
    loadUpvoteStatus();

    document.getElementById('downloadBtn').addEventListener('click', () => {
        window.location.href = `/download/${resourceId}`;
    });

    document.getElementById('upvoteBtn').addEventListener('click', handleUpvote);
    document.getElementById('reportBtn').addEventListener('click', () => openModal('reportModal'));
    document.getElementById('submitReport').addEventListener('click', submitReport);
}

async function loadUpvoteStatus() {
    try {
        const response = await api(`/api/resources/${resourceId}/upvote-status`);
        const btn = document.getElementById('upvoteBtn');
        const label = document.getElementById('upvoteLabel');
        if (response.data.upvoted) {
            btn.classList.add('upvoted');
            label.textContent = 'Upvoted';
        }
    } catch (e) { /* ignore */ }
}

async function handleUpvote() {
    const btn = document.getElementById('upvoteBtn');
    const countEl = document.getElementById('upvoteCount');
    const label = document.getElementById('upvoteLabel');
    try {
        const response = await api(`/api/resources/${resourceId}/upvote`, { method: 'POST' });
        countEl.textContent = response.data.upvotes;
        if (response.data.upvoted) {
            btn.classList.add('upvoted');
            label.textContent = 'Upvoted';
            showToast('Upvoted!', 'success');
        } else {
            btn.classList.remove('upvoted');
            label.textContent = 'Upvote';
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function submitReport() {
    const reason = document.getElementById('reportReason').value;
    const comment = document.getElementById('reportComment').value;

    if (!reason) {
        showToast('Please select a reason', 'error');
        return;
    }

    try {
        await api(`/api/resources/${resourceId}/report`, {
            method: 'POST',
            body: JSON.stringify({ reason, comment })
        });
        showToast('Report submitted. Thank you!', 'success');
        closeModal('reportModal');
        document.getElementById('reportReason').value = '';
        document.getElementById('reportComment').value = '';
    } catch (error) {
        showToast(error.message, 'error');
    }
}