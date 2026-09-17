/* =========================================================
   UniShare Uganda - browse.js (live app)
   Search + filter + sort + paginate the resource catalog.
   Design from frontend/js/browse.js; data now server-backed.
   ========================================================= */

const RESOURCE_TYPES = ["Notes", "Past Paper", "Slides", "Summary"];

const browseState = {
  query: "",
  schoolId: "",
  courseCode: "",
  lecturer: "",
  academicYear: "",
  semester: "",
  types: [],
  sort: "newest",
  page: 1,
  totalPages: 0,
  total: 0,
  votedIds: null // fetched lazily when logged in
};

/* ---------- Rendering ---------- */

function listCardHtml(r) {
  const voted = browseState.votedIds && browseState.votedIds.has(r.resource_id);
  return `
    <article class="list-resource-card">
      <div class="list-resource-main">
        <span class="badge ${typeBadgeClass(r.resource_type)}">${escapeHtml(r.resource_type)}</span>
        <h3 style="margin-top:8px;"><a href="/resource_detail.html?id=${r.resource_id}" style="color:inherit; text-decoration:none;">${escapeHtml(r.title)}</a></h3>
        <div class="list-resource-meta">
          <span>${escapeHtml(r.course_code)} &middot; ${escapeHtml(r.course_name)}</span>
          <span>${escapeHtml(r.school_name || "")}</span>
          <span>${escapeHtml(r.lecturer_name)}</span>
          <span>${escapeHtml(r.academic_year)} &middot; ${escapeHtml(r.semester)}</span>
          <span>Uploaded by ${escapeHtml(r.uploader_name || "Unknown")}</span>
        </div>
      </div>
      <div class="list-resource-actions">
        <button class="btn btn-outline btn-sm vote-btn ${voted ? "voted" : ""}" data-id="${r.resource_id}" aria-pressed="${voted}" aria-label="Upvote this resource">
          ${ICONS.upvote} <span class="vote-num">${r.upvotes}</span>
        </button>
        <a href="/resource_detail.html?id=${r.resource_id}" class="btn btn-primary btn-sm">View Details</a>
      </div>
    </article>
  `;
}

function renderResults(data) {
  const container = document.getElementById("resultsList");
  const emptyState = document.getElementById("browseEmpty");
  const countEl = document.getElementById("resultsCount");

  browseState.total = data.total;
  browseState.totalPages = data.pages;
  countEl.textContent = `${data.total} resource${data.total === 1 ? "" : "s"} found`;

  if (!data.resources.length) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    renderPagination(0);
    return;
  }
  emptyState.style.display = "none";
  container.innerHTML = data.resources.map(listCardHtml).join("");
  renderPagination(data.pages);
}

function renderPagination(totalPages) {
  const pag = document.getElementById("pagination");
  if (!totalPages || totalPages <= 1) { pag.innerHTML = ""; return; }

  let html = `<button class="page-btn" id="prevPage" ${browseState.page === 1 ? "disabled" : ""} aria-label="Previous page">&laquo;</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn" data-page="${i}" ${i === browseState.page ? 'aria-current="page"' : ""}>${i}</button>`;
  }
  html += `<button class="page-btn" id="nextPage" ${browseState.page === totalPages ? "disabled" : ""} aria-label="Next page">&raquo;</button>`;
  pag.innerHTML = html;

  document.getElementById("prevPage")?.addEventListener("click", () => { browseState.page--; loadResources(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  document.getElementById("nextPage")?.addEventListener("click", () => { browseState.page++; loadResources(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  pag.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => { browseState.page = Number(btn.getAttribute("data-page")); loadResources(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  });
}

/* ---------- Data loading ---------- */

async function loadVotedIds() {
  // Load the user's upvote state per page after rendering (server session)
  if (!getAuthState()) { browseState.votedIds = null; return; }
  const ids = Array.from(document.querySelectorAll(".vote-btn[data-id]")).map(b => b.getAttribute("data-id"));
  if (!ids.length) return;
  // upvote-status is per-resource; batch via sequential calls (small pages)
  const results = await Promise.all(ids.map(id =>
    apiFetch(`/api/resources/${id}/upvote-status`).then(r => ({ id, upvoted: r.data.upvoted })).catch(() => null)
  ));
  browseState.votedIds = new Set(results.filter(Boolean).filter(r => r.upvoted).map(r => r.id));
  // Re-render vote buttons without refetching resources
  document.querySelectorAll(".vote-btn[data-id]").forEach(btn => {
    const voted = browseState.votedIds.has(btn.getAttribute("data-id"));
    btn.classList.toggle("voted", voted);
    btn.setAttribute("aria-pressed", String(voted));
  });
}

async function loadResources() {
  const container = document.getElementById("resultsList");
  container.innerHTML = `<div class="empty-state"><p>Loading resources…</p></div>`;

  const params = {};
  if (browseState.query.trim()) params.search = browseState.query.trim();
  if (browseState.schoolId) params.school_id = browseState.schoolId;
  if (browseState.courseCode.trim()) params.course_code = browseState.courseCode.trim();
  if (browseState.semester) params.semester = browseState.semester;
  if (browseState.academicYear) params.academic_year = browseState.academicYear;
  if (browseState.types.length === 1) params.resource_type = browseState.types[0];
  if (browseState.sort) params.sort = browseState.sort === "recent" ? "newest" : browseState.sort === "upvoted" ? "popular" : "title";
  params.page = browseState.page;
  params.per_page = 20;

  try {
    const data = await api.getResources(params);
    renderResults(data);
    await loadVotedIds();
    wireVoteButtons();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading resources</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function wireVoteButtons() {
  document.querySelectorAll(".vote-btn[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      try {
        const res = await api.vote(id);
        const countEl = btn.querySelector(".vote-num");
        countEl.textContent = res.data.upvotes;
        btn.classList.toggle("voted", res.data.upvoted);
        btn.setAttribute("aria-pressed", String(res.data.upvoted));
        showToast(res.data.upvoted ? "Upvoted - thanks for the feedback." : "Upvote removed.", "success");
      } catch (err) {
        if (!handleAuthError(err)) showToast(err.message, "error");
      }
    });
  });
}

/* ---------- Filter controls ---------- */

function populateFilterOptions() {
  populateSchoolSelect(document.getElementById("filterSchool"), true);

  const yearSelect = document.getElementById("filterYear");
  const years = ["2025/2026", "2024/2025", "2023/2024", "2022/2023", "2021/2022"];
  yearSelect.innerHTML = `<option value="">Any Year</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function applyStateToControls() {
  document.getElementById("searchInput").value = browseState.query;
  document.getElementById("filterSchool").value = browseState.schoolId;
  document.getElementById("filterCourseCode").value = browseState.courseCode;
  document.getElementById("filterSemester").value = browseState.semester;
  document.getElementById("filterYear").value = browseState.academicYear;
  document.querySelectorAll('input[name="resourceType"]').forEach(cb => {
    cb.checked = browseState.types.includes(cb.value);
  });
  document.getElementById("sortSelect").value = browseState.sort;
}

function readStateFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("search") || params.get("q")) browseState.query = params.get("search") || params.get("q");
  if (params.get("school_id") || params.get("school")) browseState.schoolId = params.get("school_id") || params.get("school");
  if (params.get("resource_type") || params.get("type")) browseState.types = [params.get("resource_type") || params.get("type")];
}

/* ---------- Init ---------- */

async function initBrowsePage() {
  await authReady(); /* first-paint vote highlights need the session user */
  const container = document.getElementById("resultsList");
  if (!container) return;

  populateFilterOptions();
  readStateFromQueryParams();
  applyStateToControls();

  const searchInput = document.getElementById("searchInput");
  let searchTimeout;
  searchInput.addEventListener("input", debounceAction(() => {
    browseState.query = searchInput.value;
    browseState.page = 1;
    loadResources();
  }, 300));

  document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    browseState.query = searchInput.value;
    browseState.page = 1;
    loadResources();
  });

  document.getElementById("filterSchool").addEventListener("change", (e) => { browseState.schoolId = e.target.value; browseState.page = 1; loadResources(); });
  document.getElementById("filterCourseCode").addEventListener("input", debounceAction((e) => { browseState.courseCode = e.target.value; browseState.page = 1; loadResources(); }, 300));
  document.getElementById("filterYear").addEventListener("change", (e) => { browseState.academicYear = e.target.value; browseState.page = 1; loadResources(); });
  document.getElementById("filterSemester").addEventListener("change", (e) => { browseState.semester = e.target.value; browseState.page = 1; loadResources(); });

  document.querySelectorAll('input[name="resourceType"]').forEach(cb => {
    cb.addEventListener("change", () => {
      browseState.types = Array.from(document.querySelectorAll('input[name="resourceType"]:checked')).map(c => c.value);
      browseState.page = 1;
      loadResources();
    });
  });

  document.getElementById("sortSelect").addEventListener("change", (e) => { browseState.sort = e.target.value; browseState.page = 1; loadResources(); });

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    Object.assign(browseState, { query: "", schoolId: "", courseCode: "", academicYear: "", semester: "", types: [], page: 1 });
    applyStateToControls();
    loadResources();
    showToast("Filters cleared.");
  });

  // Mobile filter drawer
  const trigger = document.getElementById("mobileFilterTrigger");
  const panel = document.getElementById("filtersPanel");
  trigger?.addEventListener("click", () => panel.classList.add("drawer-open"));
  document.getElementById("closeFiltersBtn")?.addEventListener("click", () => panel.classList.remove("drawer-open"));

  loadResources();
}

function debounceAction(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay || 250);
  };
}

document.addEventListener("DOMContentLoaded", initBrowsePage);
