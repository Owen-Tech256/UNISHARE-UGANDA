/* =========================================================
   UniShare Uganda - main.js (live app)
   Adapted from frontend/js/main.js (design preserved).

   The mock api shim bodies are replaced with fetch() calls to the
   Flask backend. Nothing that calls api.* needs to change elsewhere.
   Auth state comes from the server session via GET /api/auth/me.
   ========================================================= */

/* ---------- API client ---------- */

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = null;
  try { data = await response.json(); } catch (e) { /* non-JSON */ }
  if (!response.ok) {
    throw new Error((data && data.message) || 'Request failed');
  }
  return data;
}

/* ---------- API shim (same method names as the frontend reference) ---------- */

const api = {
  // GET /api/schools
  getSchools: () => apiFetch('/api/schools').then(r => r.data.schools),
  // GET /api/resources
  getResources: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/resources${qs ? '?' + qs : ''}`).then(r => r.data);
  },
  // GET /api/resources/{id}
  getResource: (id) => apiFetch(`/api/resources/${id}`).then(r => r.data.resource),
  // GET /api/my-uploads
  getMyUploads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/uploads${qs ? '?' + qs : ''}`).then(r => r.data);
  },
  // POST /api/auth/login
  login: (identifier, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  // POST /api/auth/register
  register: (payload) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  // POST /api/resources/{id}/vote
  vote: (id) => apiFetch(`/api/resources/${id}/upvote`, { method: 'POST' }),
  // POST /api/resources/{id}/report
  report: (id, reason, comment) =>
    apiFetch(`/api/resources/${id}/report`, { method: 'POST', body: JSON.stringify({ reason, comment }) }),
  // POST /api/resources
  submitResource: (formData) => apiFetch('/api/uploads', { method: 'POST', body: formData }),
  // POST .../approve | .../reject (admin or super-admin variant)
  moderate: (id, action, body, superAdmin) =>
    apiFetch(`/api/${superAdmin ? 'super-admin' : 'admin'}/resources/${id}/${action}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    })
};

/* ---------- Auth state (server session) ---------- */

let currentUser = null;
let mustChangePassword = false;
let authStatePromise = null;

function fetchAuthState() {
  if (!authStatePromise) {
    authStatePromise = apiFetch('/api/auth/me')
      .then(r => {
        currentUser = r.data.user;
        mustChangePassword = !!r.data.must_change_password;
        return currentUser;
      })
      .catch(() => { currentUser = null; return null; });
  }
  return authStatePromise;
}

function getAuthState() {
  return currentUser;
}

async function logout() {
  try { await apiFetch('/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  window.location.href = '/index.html';
}

function isModerator(user) {
  return !!user && (user.role === 'moderator' || user.role === 'super_admin');
}

/* ---------- Utilities ---------- */

function escapeHtml(text) {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Handles login-required errors from apiFetch with a friendly toast.
    Returns true if the error was an auth error. */
function handleAuthError(err) {
  if (err && /authentication required/i.test(err.message)) {
    showToast("Please log in to continue.", "error");
    return true;
  }
  return false;
}

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

function renderHeader(activePage) {
  const mount = document.getElementById("site-header");
  if (!mount) return;
  const user = getAuthState();

  const role = user ? user.role : null;
  const navLinks = [
    { href: `/index.html`, label: "Home", key: "home" },
    { href: `/browse.html`, label: "Browse", key: "browse" }
  ];
  if (role) navLinks.push({ href: `/upload.html`, label: "Upload", key: "upload" });
  if (role === 'coordinator' || role === 'moderator' || role === 'super_admin') {
    navLinks.push({ href: `/my_uploads.html`, label: "My Uploads", key: "my_uploads" });
  }
  if (role === 'moderator' || role === 'super_admin') {
    navLinks.push({ href: `/moderation_queue.html`, label: "Moderation", key: "moderation" });
  }
  if (role === 'super_admin') {
    navLinks.push({ href: `/users.html`, label: "Users", key: "users" });
    navLinks.push({ href: `/reports.html`, label: "Reports", key: "reports" });
  }

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
         <span class="avatar-circle">${(user.full_name || "U").charAt(0).toUpperCase()}</span>
       </button>
       <button type="button" class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button>`
    : `<a href="/login.html" class="btn btn-ghost btn-sm">Login</a>
       <a href="/register.html" class="btn btn-primary btn-sm">Register</a>`;

  const canUpload = role === 'coordinator' || role === 'moderator' || role === 'super_admin';
  const mobileAuth = user
    ? `<hr><a href="/profile.html">Profile</a>${canUpload ? `<a href="/my_uploads.html">My Uploads</a>` : ""}
       <button type="button" class="link-like" id="mobileLogout">Logout</button>`
    : `<hr><a href="/login.html">Login</a><a href="/register.html">Register</a>`;

  mount.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a href="/index.html" class="brand" style="text-decoration:none;">
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
        <div class="notif-list" id="notifList"><div class="notif-item"><div class="notif-text">No notifications yet.</div></div></div>
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
  mobileLogout?.addEventListener("click", logout);

  const notifBtn = document.getElementById("notifBtn");
  const notifPanel = document.getElementById("notifPanel");
  if (notifBtn && notifPanel) {
    const dot = document.getElementById("notifDot");
    if (dot) dot.style.display = "none"; /* notifications API not in v1 scope */
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
  profileBtn?.addEventListener("click", () => { window.location.href = "/profile.html"; });

  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", logout);
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <div class="brand"><span class="brand-mark">${ICONS.book}</span><span class="brand-name">UniShare Uganda</span></div>
            <p class="footer-mission">Making academic resources accessible to students across Uganda.</p>
          </div>
          <ul class="footer-links">
            <li><a href="/index.html#about">About</a></li>
            <li><a href="/browse.html">Browse Resources</a></li>
            <li><a href="/upload.html">Upload</a></li>
            <li><a href="/index.html#contact">Contact</a></li>
            <li><a href="/index.html#report">Report an Issue</a></li>
            <li><a href="/index.html#terms">Terms</a></li>
          </ul>
        </div>
        <div class="footer-bottom">&copy; 2026 UniShare Uganda</div>
      </div>
    </footer>
  `;
}

function populateSchoolSelect(select, includeAll) {
  if (!select) return;
  api.getSchools().then(schools => {
    let html = includeAll ? `<option value="">All Schools</option>` : `<option value="">Select school</option>`;
    html += schools.map(s => `<option value="${s.school_id}">${s.school_name}</option>`).join("");
    select.innerHTML = html;
  }).catch(() => { select.innerHTML = `<option value="">Could not load schools</option>`; });
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

/* ---------- Resource card renderer (shared) ---------- */

function resourceCardHtml(r) {
  return `
    <article class="resource-card">
      <div class="resource-card-top">
        <span class="badge ${typeBadgeClass(r.resource_type)}">${r.resource_type}</span>
      </div>
      <h3>${r.title}</h3>
      <div class="resource-meta">
        <span>${r.course_code} &middot; ${r.course_name}</span>
        <span>${r.school_name || ""}</span>
        <span>${r.lecturer_name} &middot; ${r.academic_year}</span>
      </div>
      <div class="resource-card-footer">
        <span class="upvote-count">${ICONS.upvote} ${r.upvotes}</span>
        <a href="/resource_detail.html?id=${r.resource_id}" class="btn btn-outline btn-sm">View</a>
      </div>
    </article>
  `;
}

/* ---------- Nav-guard for gated pages ---------- */

function requireAuth(redirectTo) {
  if (!getAuthState()) {
    window.location.href = redirectTo || "/login.html";
    return false;
  }
  return true;
}

/* Any element with data-icon="name" gets its markup filled from ICONS. */
function hydrateIcons(scope) {
  (scope || document).querySelectorAll("[data-icon]").forEach(el => {
    const name = el.getAttribute("data-icon");
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

/* ---------- Forced password change (temp-password users, any page) ---------- */

function ensureForceChangeModal() {
  let modal = document.getElementById("forceChangeModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = "forceChangeModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-head"><h3>Set a new password</h3></div>
        <p class="text-secondary" style="font-size:0.9rem;">Your account uses a temporary password. Choose a new one to continue.</p>
        <form id="forceChangeForm" novalidate>
          <div class="field">
            <label for="fcNewPassword">New password</label>
            <input type="password" id="fcNewPassword" class="input" autocomplete="new-password">
          </div>
          <div class="field">
            <label for="fcConfirmPassword">Confirm new password</label>
            <input type="password" id="fcConfirmPassword" class="input" autocomplete="new-password">
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary">Update Password</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
  }
  const form = document.getElementById("forceChangeForm");
  if (form && !form.dataset.wired) {
    form.dataset.wired = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = document.getElementById("fcNewPassword").value;
      const confirm = document.getElementById("fcConfirmPassword").value;
      if (pw.length < 8) { showToast("New password must be at least 8 characters.", "error"); return; }
      if (pw !== confirm) { showToast("Passwords do not match.", "error"); return; }
      try {
        await apiFetch("/change-password", {
          method: "POST",
          body: JSON.stringify({ current_password: "", new_password: pw, confirm_password: confirm })
        });
        showToast("Password updated. Redirecting…", "success");
        setTimeout(() => { window.location.href = "/index.html"; }, 600);
      } catch (err) {
        showToast(err.message || "Failed to update password.", "error");
      }
    });
  }
  /* Non-dismissible by design: no close button, no overlay-click close. */
  modal.classList.add("open");
}

/* ---------- Init header/footer on every page ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.getAttribute("data-page") || "";
  await fetchAuthState();          // header needs to know the session user
  renderHeader(page);
  renderFooter();
  hydrateIcons();
  if (mustChangePassword && page !== "login") ensureForceChangeModal();
});
