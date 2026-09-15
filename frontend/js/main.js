/* =========================================================
   UniShare Uganda — main.js
   Shared demo data + shared UI wiring (header, footer, nav,
   notifications, toasts, auth state).

   NOTE FOR BACKEND INTEGRATION:
   Every data access in this project goes through the `api`
   object below. Right now each method resolves with local
   in-memory arrays. When the Flask backend exists, replace
   the body of each method with a fetch() call to the matching
   endpoint (already noted in comments) — nothing that calls
   `api.*` needs to change.
   ========================================================= */

/* ---------- Demo data ---------- */

const UNIVERSITIES = [
  "Makerere University",
  "Kyambogo University",
  "Mbarara University of Science and Technology",
  "Uganda Christian University",
  "MUBS",
  "Nkumba University",
  "Busitema University",
  "Muni University",
  "Kabale University",
  "Gulu University"
];

const RESOURCE_TYPES = ["Notes", "Past Paper", "Slides", "Summary"];

const RESOURCES = [
  { id: 1, title: "Database Management Systems Past Paper", course_code: "BIT210", course_name: "Database Management Systems", university: "Nkumba University", lecturer: "Dr. Sarah Namukasa", year: "2024/2025", semester: "Semester 1", type: "Past Paper", uploader_name: "John Student", upvote_count: 42, file_type: "PDF", file_size: "1.8 MB", date: "2026-08-14", approved: true, reports: 0 },
  { id: 2, title: "Introduction to Microeconomics Notes", course_code: "ECO101", course_name: "Microeconomics", university: "Makerere University", lecturer: "Dr. Peter Okello", year: "2025/2026", semester: "Semester 1", type: "Notes", uploader_name: "Grace N.", upvote_count: 87, file_type: "DOCX", file_size: "620 KB", date: "2026-09-02", approved: true, reports: 0 },
  { id: 3, title: "Data Structures & Algorithms Slides — Trees", course_code: "CIT301", course_name: "Data Structures and Algorithms", university: "Makerere University", lecturer: "Dr. Ivan Mugisha", year: "2025/2026", semester: "Semester 1", type: "Slides", uploader_name: "Brian K.", upvote_count: 65, file_type: "PPTX", file_size: "3.2 MB", date: "2026-09-05", approved: true, reports: 0 },
  { id: 4, title: "Financial Accounting Summary Notes", course_code: "ACC110", course_name: "Financial Accounting I", university: "MUBS", lecturer: "Ms. Ritah Nabirye", year: "2024/2025", semester: "Semester 2", type: "Summary", uploader_name: "Patience A.", upvote_count: 120, file_type: "PDF", file_size: "980 KB", date: "2026-07-29", approved: true, reports: 1 },
  { id: 5, title: "Organic Chemistry Past Paper 2024", course_code: "CHE202", course_name: "Organic Chemistry", university: "Mbarara University of Science and Technology", lecturer: "Dr. Allan Tumwesigye", year: "2023/2024", semester: "Semester 2", type: "Past Paper", uploader_name: "Diana M.", upvote_count: 54, file_type: "PDF", file_size: "2.1 MB", date: "2026-06-18", approved: true, reports: 0 },
  { id: 6, title: "Principles of Marketing Slides", course_code: "MKT201", course_name: "Principles of Marketing", university: "Uganda Christian University", lecturer: "Mr. Joseph Ssebunya", year: "2025/2026", semester: "Semester 1", type: "Slides", uploader_name: "Esther K.", upvote_count: 33, file_type: "PPTX", file_size: "4.0 MB", date: "2026-09-10", approved: true, reports: 0 },
  { id: 7, title: "Human Anatomy Notes — Musculoskeletal System", course_code: "MED150", course_name: "Human Anatomy", university: "Gulu University", lecturer: "Dr. Christine Aciro", year: "2024/2025", semester: "Semester 1", type: "Notes", uploader_name: "Moses O.", upvote_count: 98, file_type: "PDF", file_size: "1.4 MB", date: "2026-05-21", approved: true, reports: 0 },
  { id: 8, title: "Business Statistics Past Paper", course_code: "STA150", course_name: "Business Statistics", university: "Kyambogo University", lecturer: "Dr. Fred Ochieng", year: "2024/2025", semester: "Semester 2", type: "Past Paper", uploader_name: "Angela T.", upvote_count: 71, file_type: "PDF", file_size: "1.1 MB", date: "2026-04-30", approved: true, reports: 0 },
  { id: 9, title: "Software Engineering Summary — SDLC Models", course_code: "CIT350", course_name: "Software Engineering", university: "Busitema University", lecturer: "Dr. Ivan Mugisha", year: "2025/2026", semester: "Semester 1", type: "Summary", uploader_name: "Kevin W.", upvote_count: 45, file_type: "PDF", file_size: "700 KB", date: "2026-09-01", approved: false, reports: 0 },
  { id: 10, title: "Constitutional Law Notes", course_code: "LAW220", course_name: "Constitutional Law", university: "Nkumba University", lecturer: "Ms. Harriet Nansubuga", year: "2024/2025", semester: "Semester 2", type: "Notes", uploader_name: "John Student", upvote_count: 29, file_type: "DOCX", file_size: "540 KB", date: "2026-03-11", approved: true, reports: 0 },
  { id: 11, title: "Public Health Slides — Epidemiology Basics", course_code: "PHE210", course_name: "Epidemiology", university: "Muni University", lecturer: "Dr. Sarah Namukasa", year: "2025/2026", semester: "Semester 1", type: "Slides", uploader_name: "Ruth A.", upvote_count: 22, file_type: "PPTX", file_size: "2.6 MB", date: "2026-08-27", approved: true, reports: 0 },
  { id: 12, title: "Linear Algebra Past Paper 2023", course_code: "MTH120", course_name: "Linear Algebra", university: "Kabale University", lecturer: "Dr. Peter Okello", year: "2023/2024", semester: "Semester 1", type: "Past Paper", uploader_name: "Brian K.", upvote_count: 40, file_type: "PDF", file_size: "1.6 MB", date: "2026-02-14", approved: true, reports: 0 }
];

const NOTIFICATIONS = [
  { id: 1, text: "Your upload \u201cDatabase Management Systems Past Paper\u201d was approved.", time: "2 hours ago", unread: true },
  { id: 2, text: "Your upload \u201cSoftware Engineering Summary\u201d needs revision.", time: "1 day ago", unread: true },
  { id: 3, text: "A resource you reported has been reviewed by a moderator.", time: "3 days ago", unread: false },
  { id: 4, text: "Your upload \u201cConstitutional Law Notes\u201d received 10 new upvotes.", time: "5 days ago", unread: false }
];

const MY_UPLOADS = [
  { id: 1, title: "Database Management Systems Past Paper", course_code: "BIT210", type: "Past Paper", date: "2026-08-14", status: "Approved", upvotes: 42, reports: 0 },
  { id: 10, title: "Constitutional Law Notes", course_code: "LAW220", type: "Notes", date: "2026-03-11", status: "Approved", upvotes: 29, reports: 0 },
  { id: 13, title: "Operating Systems Summary", course_code: "CIT220", type: "Summary", date: "2026-09-08", status: "Pending", upvotes: 0, reports: 0 },
  { id: 14, title: "Calculus II Notes", course_code: "MTH210", type: "Notes", date: "2026-01-20", status: "Rejected", upvotes: 3, reports: 0, rejection_reason: "The uploaded file did not match the course code listed." }
];

/* Fake auth state, persisted only for this tab session */
const AUTH_KEY = "unishare_demo_auth";
function getAuthState() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function setAuthState(user) {
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch (e) {}
}
function clearAuthState() {
  try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
}

/* ---------- API shim (swap bodies for fetch() later) ---------- */

const api = {
  // GET /api/universities
  getUniversities: () => Promise.resolve(UNIVERSITIES),
  // GET /api/resources
  getResources: () => Promise.resolve(RESOURCES),
  // GET /api/resources/{id}
  getResource: (id) => Promise.resolve(RESOURCES.find(r => r.id === Number(id)) || null),
  // GET /api/my-uploads
  getMyUploads: () => Promise.resolve(MY_UPLOADS),
  // GET /api/notifications
  getNotifications: () => Promise.resolve(NOTIFICATIONS),
  // POST /api/login
  login: (email, password) => Promise.resolve({ ok: true, user: { name: email.split("@")[0] || "Student", email } }),
  // POST /api/register
  register: (payload) => Promise.resolve({ ok: true }),
  // POST /api/resources/{id}/vote
  vote: (id) => Promise.resolve({ ok: true }),
  // POST /api/resources/{id}/report
  report: (id, reason, comment) => Promise.resolve({ ok: true }),
  // POST /api/resources
  submitResource: (payload) => Promise.resolve({ ok: true })
};

/* ---------- Icons (inline SVG, no external assets) ---------- */

const ICONS = {
  book: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>',
  bell: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  upvote: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  file: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  upload: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  empty: '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
};

function typeBadgeClass(type) {
  switch (type) {
    case "Notes": return "badge-notes";
    case "Past Paper": return "badge-pastpaper";
    case "Slides": return "badge-slides";
    case "Summary": return "badge-summary";
    default: return "badge-notes";
  }
}

function statusBadgeMarkup(status) {
  if (status === "Approved") return `<span class="status-badge status-approved">${ICONS.check} Approved</span>`;
  if (status === "Pending") return `<span class="status-badge status-pending">&#9679; Pending</span>`;
  return `<span class="status-badge status-rejected">${ICONS.warn} Rejected</span>`;
}

/* ---------- Header / footer partials ---------- */

const BASE_PREFIX = window.location.pathname.includes("/admin/") ? "../" : "";

function renderHeader(activePage) {
  const mount = document.getElementById("site-header");
  if (!mount) return;
  const user = getAuthState();
  const p = BASE_PREFIX;

  const navLinks = [
    { href: `${p}index.html`, label: "Home", key: "home" },
    { href: `${p}browse.html`, label: "Browse", key: "browse" },
    { href: `${p}upload.html`, label: "Upload", key: "upload" },
    { href: `${p}my_uploads.html`, label: "My Uploads", key: "my_uploads" }
  ];

  const navHtml = navLinks.map(l =>
    `<a href="${l.href}" ${activePage === l.key ? 'aria-current="page"' : ''}>${l.label}</a>`
  ).join("");

  const authArea = user
    ? `<div class="notif-wrap" style="position:relative;">
         <button class="icon-btn" id="notifBtn" aria-haspopup="true" aria-expanded="false" aria-label="Notifications">
           ${ICONS.bell}<span class="notif-dot" id="notifDot"></span>
         </button>
       </div>
       <button class="avatar-btn" id="profileBtn" aria-label="Profile menu">
         <span class="avatar-circle">${(user.name || "U").charAt(0).toUpperCase()}</span>
       </button>`
    : `<a href="${p}login.html" class="btn btn-ghost btn-sm">Login</a>
       <a href="${p}register.html" class="btn btn-primary btn-sm">Register</a>`;

  const mobileAuth = user
    ? `<hr><a href="${p}profile.html">Profile</a><a href="${p}my_uploads.html">My Uploads</a>
       <button type="button" class="link-like" id="mobileLogout">Logout</button>`
    : `<hr><a href="${p}login.html">Login</a><a href="${p}register.html">Register</a>`;

  mount.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a href="${p}index.html" class="brand" style="text-decoration:none;">
          <span class="brand-mark">${ICONS.book}</span>
          <span class="brand-text"><span class="brand-name">UniShare</span><span class="brand-sub">UGANDA</span></span>
        </a>
        <nav class="main-nav" aria-label="Primary">${navHtml}</nav>
        <div class="header-actions">
          ${authArea}
          <button class="hamburger" id="hamburgerBtn" aria-label="Open menu" aria-expanded="false">${ICONS.menu}</button>
        </div>
      </div>
      <nav class="mobile-menu" id="mobileMenu" aria-label="Mobile">
        ${navLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join("")}
        ${mobileAuth}
      </nav>
      <div class="notif-panel" id="notifPanel" role="dialog" aria-label="Notifications">
        <div class="notif-panel-header">Notifications</div>
        <div class="notif-list" id="notifList"></div>
      </div>
    </header>
  `;

  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  hamburgerBtn?.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("open");
    hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
  });

  const mobileLogout = document.getElementById("mobileLogout");
  mobileLogout?.addEventListener("click", () => { clearAuthState(); window.location.href = `${p}index.html`; });

  const notifBtn = document.getElementById("notifBtn");
  const notifPanel = document.getElementById("notifPanel");
  if (notifBtn && notifPanel) {
    api.getNotifications().then(list => {
      const listEl = document.getElementById("notifList");
      listEl.innerHTML = list.map(n => `
        <div class="notif-item ${n.unread ? 'unread' : ''}">
          <span class="notif-icon">${ICONS.bell}</span>
          <div class="notif-text">${n.text}<div class="notif-time">${n.time}</div></div>
        </div>
      `).join("");
      const dot = document.getElementById("notifDot");
      if (dot && !list.some(n => n.unread)) dot.style.display = "none";
    });
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = notifPanel.classList.toggle("open");
      notifBtn.setAttribute("aria-expanded", String(isOpen));
    });
    document.addEventListener("click", (e) => {
      if (!notifPanel.contains(e.target) && e.target !== notifBtn) {
        notifPanel.classList.remove("open");
        notifBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  const profileBtn = document.getElementById("profileBtn");
  profileBtn?.addEventListener("click", () => { window.location.href = `${p}profile.html`; });
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  const p = BASE_PREFIX;
  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <div class="brand"><span class="brand-mark">${ICONS.book}</span><span class="brand-name">UniShare Uganda</span></div>
            <p class="footer-mission">Making academic resources accessible to students across Uganda.</p>
          </div>
          <ul class="footer-links">
            <li><a href="${p}index.html#about">About</a></li>
            <li><a href="${p}browse.html">Browse Resources</a></li>
            <li><a href="${p}upload.html">Upload</a></li>
            <li><a href="${p}index.html#contact">Contact</a></li>
            <li><a href="${p}index.html#contact">Report an Issue</a></li>
            <li><a href="${p}index.html#terms">Terms</a></li>
          </ul>
        </div>
        <div class="footer-bottom">&copy; 2026 UniShare Uganda</div>
      </div>
    </footer>
  `;
}

function populateUniversitySelect(select, includeAll) {
  if (!select) return;
  let html = "";
  if (includeAll) html += `<option value="">All Universities</option>`;
  html += UNIVERSITIES.map(u => `<option value="${u}">${u}</option>`).join("");
  select.innerHTML = html;
}

/* ---------- Toast ---------- */

function showToast(message, type) {
  let toast = document.getElementById("globalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.className = "toast" + (type ? ` toast-${type}` : "");
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ---------- Resource card renderer (shared by home + detail "more resources") ---------- */

function resourceCardHtml(r) {
  return `
    <article class="resource-card">
      <div class="resource-card-top">
        <span class="badge ${typeBadgeClass(r.type)}">${r.type}</span>
      </div>
      <h3>${r.title}</h3>
      <div class="resource-meta">
        <span>${r.course_code} &middot; ${r.course_name}</span>
        <span>${r.university}</span>
        <span>${r.lecturer} &middot; ${r.year}</span>
      </div>
      <div class="resource-card-footer">
        <span class="upvote-count">${ICONS.upvote} ${r.upvote_count}</span>
        <a href="resource_detail.html?id=${r.id}" class="btn btn-outline btn-sm">View</a>
      </div>
    </article>
  `;
}

/* ---------- Nav-guard for gated pages ---------- */

function requireAuth(redirectTo) {
  if (!getAuthState()) {
    window.location.href = redirectTo || `${BASE_PREFIX}login.html`;
    return false;
  }
  return true;
}

/* Any element with data-icon="name" gets its markup filled from ICONS.
   Lets static HTML reference icons without inline JS template literals. */
function hydrateIcons(scope) {
  (scope || document).querySelectorAll("[data-icon]").forEach(el => {
    const name = el.getAttribute("data-icon");
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

/* Init header/footer on every page automatically if mounts exist */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute("data-page") || "";
  renderHeader(page);
  renderFooter();
  hydrateIcons();
});
