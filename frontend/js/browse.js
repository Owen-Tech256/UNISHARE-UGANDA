/* =========================================================
   UniShare Uganda — browse.js
   ========================================================= */

const PAGE_SIZE = 20;

const browseState = {
  all: [],
  filtered: [],
  query: "",
  university: "",
  courseCode: "",
  lecturer: "",
  academicYear: "",
  semester: "",
  types: [],
  sort: "upvoted",
  page: 1
};

function listCardHtml(r) {
  return `
    <article class="list-resource-card">
      <div class="list-resource-main">
        <span class="badge ${typeBadgeClass(r.type)}">${r.type}</span>
        <h3 style="margin-top:8px;">${r.title}</h3>
        <div class="list-resource-meta">
          <span>${r.course_code} &middot; ${r.course_name}</span>
          <span>${r.university}</span>
          <span>${r.lecturer}</span>
          <span>${r.year} &middot; ${r.semester}</span>
          <span>Uploaded by ${r.uploader_name}</span>
        </div>
      </div>
      <div class="list-resource-actions">
        <button class="btn btn-outline btn-sm vote-btn" data-id="${r.id}" aria-label="Upvote this resource">
          ${ICONS.upvote} <span class="vote-num">${r.upvote_count}</span>
        </button>
        <a href="resource_detail.html?id=${r.id}" class="btn btn-primary btn-sm">View Details</a>
      </div>
    </article>
  `;
}

function applyFilters() {
  const s = browseState;
  let list = s.all.filter(r => r.approved !== false);

  if (s.query.trim()) {
    const q = s.query.trim().toLowerCase();
    list = list.filter(r =>
      r.course_code.toLowerCase().includes(q) ||
      r.course_name.toLowerCase().includes(q) ||
      r.lecturer.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q)
    );
  }
  if (s.university) list = list.filter(r => r.university === s.university);
  if (s.courseCode.trim()) list = list.filter(r => r.course_code.toLowerCase().includes(s.courseCode.trim().toLowerCase()));
  if (s.lecturer.trim()) list = list.filter(r => r.lecturer.toLowerCase().includes(s.lecturer.trim().toLowerCase()));
  if (s.academicYear) list = list.filter(r => r.year === s.academicYear);
  if (s.semester) list = list.filter(r => r.semester === s.semester);
  if (s.types.length) list = list.filter(r => s.types.includes(r.type));

  if (s.sort === "upvoted") list = list.slice().sort((a, b) => b.upvote_count - a.upvote_count);
  else if (s.sort === "recent") list = list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  else if (s.sort === "alpha") list = list.slice().sort((a, b) => a.title.localeCompare(b.title));

  s.filtered = list;
  s.page = 1;
  renderResults();
}

function renderResults() {
  const s = browseState;
  const container = document.getElementById("resultsList");
  const emptyState = document.getElementById("browseEmpty");
  const countEl = document.getElementById("resultsCount");
  const totalPages = Math.max(1, Math.ceil(s.filtered.length / PAGE_SIZE));
  s.page = Math.min(s.page, totalPages);

  countEl.textContent = `${s.filtered.length} resource${s.filtered.length === 1 ? "" : "s"} found`;

  if (!s.filtered.length) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    renderPagination(0);
    return;
  }
  emptyState.style.display = "none";

  const start = (s.page - 1) * PAGE_SIZE;
  const pageItems = s.filtered.slice(start, start + PAGE_SIZE);
  container.innerHTML = pageItems.map(listCardHtml).join("");

  container.querySelectorAll(".vote-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      const item = s.all.find(r => r.id === id);
      if (!item) return;
      api.vote(id).then(() => {
        item.upvote_count += 1;
        btn.querySelector(".vote-num").textContent = item.upvote_count;
        showToast("Upvoted — thanks for the feedback.", "success");
      });
    });
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const s = browseState;
  const pag = document.getElementById("pagination");
  if (!totalPages || totalPages <= 1) { pag.innerHTML = ""; return; }

  let html = `<button class="page-btn" id="prevPage" ${s.page === 1 ? "disabled" : ""} aria-label="Previous page">&laquo;</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn" data-page="${i}" ${i === s.page ? 'aria-current="page"' : ""}>${i}</button>`;
  }
  html += `<button class="page-btn" id="nextPage" ${s.page === totalPages ? "disabled" : ""} aria-label="Next page">&raquo;</button>`;
  pag.innerHTML = html;

  document.getElementById("prevPage")?.addEventListener("click", () => { s.page--; renderResults(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  document.getElementById("nextPage")?.addEventListener("click", () => { s.page++; renderResults(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  pag.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => { s.page = Number(btn.getAttribute("data-page")); renderResults(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  });
}

function populateFilterOptions() {
  populateUniversitySelect(document.getElementById("filterUniversity"), true);

  const years = Array.from(new Set(RESOURCES.map(r => r.year))).sort().reverse();
  const yearSelect = document.getElementById("filterYear");
  yearSelect.innerHTML = `<option value="">Any Year</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function initBrowsePage() {
  const container = document.getElementById("resultsList");
  if (!container) return;

  browseState.all = RESOURCES.slice();
  populateFilterOptions();

  const params = new URLSearchParams(window.location.search);
  if (params.get("q")) { browseState.query = params.get("q"); document.getElementById("searchInput").value = browseState.query; }
  if (params.get("university")) { browseState.university = params.get("university"); document.getElementById("filterUniversity").value = browseState.university; }
  if (params.get("type")) {
    browseState.types = [params.get("type")];
    const cb = document.querySelector(`input[name="resourceType"][value="${params.get("type")}"]`);
    if (cb) cb.checked = true;
  }

  document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    browseState.query = document.getElementById("searchInput").value;
    applyFilters();
  });

  document.getElementById("applyFiltersBtn").addEventListener("click", () => {
    browseState.university = document.getElementById("filterUniversity").value;
    browseState.courseCode = document.getElementById("filterCourseCode").value;
    browseState.lecturer = document.getElementById("filterLecturer").value;
    browseState.academicYear = document.getElementById("filterYear").value;
    browseState.semester = document.getElementById("filterSemester").value;
    browseState.types = Array.from(document.querySelectorAll('input[name="resourceType"]:checked')).map(cb => cb.value);
    applyFilters();
    document.getElementById("filtersPanel").classList.remove("drawer-open");
  });

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    document.getElementById("filterUniversity").value = "";
    document.getElementById("filterCourseCode").value = "";
    document.getElementById("filterLecturer").value = "";
    document.getElementById("filterYear").value = "";
    document.getElementById("filterSemester").value = "";
    document.querySelectorAll('input[name="resourceType"]').forEach(cb => cb.checked = false);
    Object.assign(browseState, { university: "", courseCode: "", lecturer: "", academicYear: "", semester: "", types: [] });
    applyFilters();
  });

  document.getElementById("sortSelect").addEventListener("change", (e) => {
    browseState.sort = e.target.value;
    applyFilters();
  });

  const filterTrigger = document.getElementById("mobileFilterTrigger");
  const filtersPanel = document.getElementById("filtersPanel");
  filterTrigger?.addEventListener("click", () => filtersPanel.classList.add("drawer-open"));
  document.getElementById("closeFiltersBtn")?.addEventListener("click", () => filtersPanel.classList.remove("drawer-open"));

  applyFilters();
}

document.addEventListener("DOMContentLoaded", initBrowsePage);
