/* ==========================================================================
   UniShare Uganda — browse.js
   Search + filter + sort + paginate the resource catalog on browse.html
   ========================================================================== */

const PAGE_SIZE = 20;

const browseState = {
  query: "",
  university: "",
  courseCode: "",
  lecturer: "",
  academicYear: "",
  semester: "",
  types: [],
  sort: "recent",
  page: 1
};

function populateBrowseFilterOptions() {
  const uniSelect = document.getElementById("filter-university");
  uniSelect.innerHTML = `<option value="">All universities</option>` +
    UNIVERSITIES.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");

  const yearSelect = document.getElementById("filter-year");
  yearSelect.innerHTML = `<option value="">Any year</option>` +
    ACADEMIC_YEARS.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join("");

  const semSelect = document.getElementById("filter-semester");
  semSelect.innerHTML = `<option value="">Any semester</option>` +
    SEMESTERS.map((s) => `<option value="${s}">${s}</option>`).join("");
}

function readStateFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("q")) browseState.query = params.get("q");
  if (params.get("university")) browseState.university = params.get("university");
  if (params.get("type")) browseState.types = [params.get("type")];
}

function applyStateToControls() {
  document.getElementById("search-input").value = browseState.query;
  document.getElementById("filter-university").value = browseState.university;
  document.getElementById("filter-year").value = browseState.academicYear;
  document.getElementById("filter-semester").value = browseState.semester;
  document.querySelectorAll("[data-type-checkbox]").forEach((cb) => {
    cb.checked = browseState.types.includes(cb.value);
  });
  document.getElementById("sort-select").value = browseState.sort;
}

function matchesFilters(resource) {
  const q = browseState.query.trim().toLowerCase();
  if (q) {
    const haystack = `${resource.title} ${resource.courseCode} ${resource.courseName} ${resource.lecturer}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (browseState.university && resource.university !== browseState.university) return false;
  if (browseState.courseCode && !resource.courseCode.toLowerCase().includes(browseState.courseCode.toLowerCase())) return false;
  if (browseState.lecturer && !resource.lecturer.toLowerCase().includes(browseState.lecturer.toLowerCase())) return false;
  if (browseState.academicYear && resource.academicYear !== browseState.academicYear) return false;
  if (browseState.semester && resource.semester !== browseState.semester) return false;
  if (browseState.types.length && !browseState.types.includes(resource.type)) return false;
  return true;
}

function sortResources(list) {
  const sorted = [...list];
  if (browseState.sort === "upvoted") {
    sorted.sort((a, b) => b.upvotes - a.upvotes);
  } else if (browseState.sort === "alphabetical") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    sorted.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  }
  return sorted;
}

function renderBrowseResults() {
  const all = getAllResources().filter((r) => r.status === "approved" || r.status === undefined);
  const filtered = sortResources(all.filter(matchesFilters));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (browseState.page > totalPages) browseState.page = totalPages;
  const start = (browseState.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const grid = document.getElementById("browse-results-grid");
  const emptyState = document.getElementById("browse-empty-state");
  const resultsCount = document.getElementById("results-count");

  resultsCount.textContent = `${filtered.length} resource${filtered.length === 1 ? "" : "s"} found`;

  if (pageItems.length === 0) {
    grid.innerHTML = "";
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    grid.innerHTML = pageItems.map(renderResourceCard).join("");
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const mount = document.getElementById("pagination");
  if (totalPages <= 1) { mount.innerHTML = ""; return; }

  let html = `<button type="button" data-page="${browseState.page - 1}" ${browseState.page === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>`;

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - browseState.page) <= 1) {
      html += `<button type="button" data-page="${p}" class="${p === browseState.page ? "active" : ""}" aria-current="${p === browseState.page ? "page" : "false"}">${p}</button>`;
    } else if (Math.abs(p - browseState.page) === 2) {
      html += `<span class="text-soft" style="align-self:center;">…</span>`;
    }
  }

  html += `<button type="button" data-page="${browseState.page + 1}" ${browseState.page === totalPages ? "disabled" : ""} aria-label="Next page">›</button>`;
  mount.innerHTML = html;

  mount.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      browseState.page = Number(btn.dataset.page);
      renderBrowseResults();
      document.getElementById("browse-results-top").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function wireBrowseControls() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", debounce(() => {
    browseState.query = searchInput.value;
    browseState.page = 1;
    renderBrowseResults();
  }, 250));

  document.getElementById("filter-university").addEventListener("change", (e) => {
    browseState.university = e.target.value; browseState.page = 1; renderBrowseResults();
  });
  document.getElementById("filter-course").addEventListener("input", debounce((e) => {
    browseState.courseCode = e.target.value; browseState.page = 1; renderBrowseResults();
  }, 250));
  document.getElementById("filter-lecturer").addEventListener("input", debounce((e) => {
    browseState.lecturer = e.target.value; browseState.page = 1; renderBrowseResults();
  }, 250));
  document.getElementById("filter-year").addEventListener("change", (e) => {
    browseState.academicYear = e.target.value; browseState.page = 1; renderBrowseResults();
  });
  document.getElementById("filter-semester").addEventListener("change", (e) => {
    browseState.semester = e.target.value; browseState.page = 1; renderBrowseResults();
  });
  document.querySelectorAll("[data-type-checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      browseState.types = Array.from(document.querySelectorAll("[data-type-checkbox]:checked")).map((c) => c.value);
      browseState.page = 1;
      renderBrowseResults();
    });
  });
  document.getElementById("sort-select").addEventListener("change", (e) => {
    browseState.sort = e.target.value; renderBrowseResults();
  });

  document.getElementById("clear-filters-btn").addEventListener("click", () => {
    browseState.query = ""; browseState.university = ""; browseState.courseCode = "";
    browseState.lecturer = ""; browseState.academicYear = ""; browseState.semester = "";
    browseState.types = []; browseState.page = 1;
    document.getElementById("filter-course").value = "";
    document.getElementById("filter-lecturer").value = "";
    applyStateToControls();
    renderBrowseResults();
    showToast("Filters cleared.");
  });

  const drawerToggle = document.getElementById("filter-drawer-toggle");
  const filterPanel = document.getElementById("filter-panel");
  if (drawerToggle) {
    drawerToggle.addEventListener("click", () => {
      const isOpen = filterPanel.classList.toggle("open");
      drawerToggle.setAttribute("aria-expanded", String(isOpen));
      drawerToggle.textContent = isOpen ? "Hide Filters ▲" : "Filters ▾";
    });
  }

  wireUpvoteDelegation("#browse-results-grid");
}

function initBrowsePage() {
  const grid = document.getElementById("browse-results-grid");
  if (!grid) return;

  populateBrowseFilterOptions();
  populateSearchSuggestions("browse-search-suggestions");
  readStateFromQueryParams();
  applyStateToControls();
  wireBrowseControls();
  renderBrowseResults();
}

document.addEventListener("DOMContentLoaded", initBrowsePage);
