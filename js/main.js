/* ==========================================================================
   UniShare Uganda — main.js
   Shared data, mock auth, navigation, footer, toasts, modals, utilities.
   Nothing here talks to a server — everything lives in memory + localStorage.
   ========================================================================== */

/* ---------------------------- Constants / Mock Data ---------------------------- */

const UNIVERSITIES = [
  "Makerere University",
  "Kyambogo University",
  "Makerere University Business School (MUBS)",
  "Mbarara University of Science & Technology (MUST)",
  "Uganda Christian University (UCU)",
  "Uganda Martyrs University",
  "Ndejje University",
  "Busitema University"
];

const RESOURCE_TYPES = [
  { id: "notes", label: "Notes", tabClass: "tab-notes", badgeClass: "badge-type-notes" },
  { id: "pastpaper", label: "Past Paper", tabClass: "tab-pastpaper", badgeClass: "badge-type-pastpaper" },
  { id: "slides", label: "Slides", tabClass: "tab-slides", badgeClass: "badge-type-slides" },
  { id: "summary", label: "Summary", tabClass: "tab-summary", badgeClass: "badge-type-summary" }
];

const COURSES = [
  { code: "CS101", name: "Introduction to Computer Science" },
  { code: "CSC201", name: "Data Structures & Algorithms" },
  { code: "BIT210", name: "Database Systems" },
  { code: "ECO101", name: "Principles of Microeconomics" },
  { code: "BBA201", name: "Principles of Marketing" },
  { code: "MATH101", name: "Calculus I" },
  { code: "STA201", name: "Probability & Statistics" },
  { code: "LAW101", name: "Introduction to Law" },
  { code: "CSC305", name: "Operating Systems" },
  { code: "BIT330", name: "Web Application Development" }
];

const LECTURERS = [
  "Dr. Grace Nakato", "Mr. Peter Okello", "Dr. Sarah Namuli", "Prof. John Ssekandi",
  "Dr. Ivan Mugisha", "Ms. Brenda Achieng", "Mr. Daniel Tumwine", "Dr. Fiona Kwagala",
  "Prof. Moses Rukundo", "Dr. Patricia Auma"
];

const ACADEMIC_YEARS = ["2021/2022", "2022/2023", "2023/2024", "2024/2025", "2025/2026"];
const SEMESTERS = ["Semester 1", "Semester 2"];

const REPORT_REASONS = ["Wrong Course", "Outdated", "Incorrect Content", "Duplicate", "Inappropriate", "Other"];

const MOCK_UPLOADER_NAMES = [
  "Timothy K.", "Ritah N.", "Allan M.", "Joan A.", "Kevin S.", "Sandra L.",
  "Brian O.", "Faith N.", "Emmanuel B.", "Doreen T."
];

/* Seeded pseudo-random so mock data stays stable across reloads within a session */
function seededRandom(seed) {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function buildMockResources() {
  const rand = seededRandom(42);
  const titles = {
    notes: "Lecture Notes", pastpaper: "Final Exam Past Paper",
    slides: "Lecture Slides", summary: "Revision Summary"
  };
  const fileTypes = ["PDF", "DOCX", "PPTX"];
  const resources = [];
  const count = 28;

  for (let i = 0; i < count; i++) {
    const course = COURSES[Math.floor(rand() * COURSES.length)];
    const type = RESOURCE_TYPES[Math.floor(rand() * RESOURCE_TYPES.length)];
    const university = UNIVERSITIES[Math.floor(rand() * UNIVERSITIES.length)];
    const lecturer = LECTURERS[Math.floor(rand() * LECTURERS.length)];
    const year = ACADEMIC_YEARS[Math.floor(rand() * ACADEMIC_YEARS.length)];
    const semester = SEMESTERS[Math.floor(rand() * SEMESTERS.length)];
    const uploader = MOCK_UPLOADER_NAMES[Math.floor(rand() * MOCK_UPLOADER_NAMES.length)];
    const upvotes = Math.floor(rand() * 140);
    const fileType = fileTypes[Math.floor(rand() * fileTypes.length)];
    const daysAgo = Math.floor(rand() * 220);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    resources.push({
      id: "res-" + (i + 1),
      title: `${course.code} — ${titles[type.id]} (${semester})`,
      courseCode: course.code,
      courseName: course.name,
      type: type.id,
      university,
      lecturer,
      academicYear: year,
      semester,
      uploader,
      upvotes,
      status: "approved",
      approved: true,
      uploadDate: date.toISOString(),
      fileType,
      fileSize: `${(0.4 + rand() * 4.2).toFixed(1)} MB`,
      fileName: `${course.code}-${type.id}-${year.replace("/", "-")}.${fileType.toLowerCase()}`,
      description: `${titles[type.id]} for ${course.name} (${course.code}), covering material taught by ${lecturer} during ${semester}, ${year}. Shared by a fellow student to help with revision.`
    });
  }
  return resources;
}

const MOCK_RESOURCES = buildMockResources();

/* ---------------------------- Storage keys ---------------------------- */

const LS_KEYS = {
  user: "unishare_user",
  users: "unishare_users",
  uploads: "unishare_uploads",
  votes: "unishare_votes",
  reports: "unishare_reports"
};

/* ---------------------------- Utilities ---------------------------- */

function uid(prefix) {
  return `${prefix || "id"}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(isoString) {
  const d = new Date(isoString);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const days = Math.floor(seconds / 86400);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  return `${Math.floor(months / 12)} year(s) ago`;
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay || 250);
  };
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Could not write to localStorage", e);
  }
}

/** Shared inline-validation helper used by auth.js and upload.js. */
function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  const field = input.closest(".field");
  if (!field) return;
  const errorEl = field.querySelector(".error-msg");
  if (message) {
    field.classList.add("has-error");
    if (errorEl) errorEl.textContent = message;
  } else {
    field.classList.remove("has-error");
    if (errorEl) errorEl.textContent = "";
  }
}

function resourceTypeMeta(typeId) {
  return RESOURCE_TYPES.find((t) => t.id === typeId) || RESOURCE_TYPES[0];
}

function maskEmail(email) {
  if (!email || email.indexOf("@") === -1) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 3))}@${domain}`;
}

/* ---------------------------- Combined resource list ---------------------------- */

/** All uploads created via the Upload page, newest first. */
function getUserUploads() {
  return readJSON(LS_KEYS.uploads, []);
}

/** Mock catalog + anything the current session has uploaded. */
function getAllResources() {
  return [...getUserUploads(), ...MOCK_RESOURCES];
}

function populateSearchSuggestions(listId) {
  const datalist = document.getElementById(listId);
  if (!datalist) return;
  const suggestions = new Set();
  getAllResources()
    .filter((resource) => resource.status === "approved" || resource.status === undefined)
    .forEach((resource) => {
      [resource.courseCode, resource.courseName, resource.title, resource.lecturer, resource.university]
        .forEach((value) => suggestions.add(value));
    });
  datalist.replaceChildren(...Array.from(suggestions).sort().map((value) => {
    const option = document.createElement("option");
    option.value = value;
    return option;
  }));
}

function getResourceById(id) {
  return getAllResources().find((r) => r.id === id) || null;
}

function getVotedIds() {
  return readJSON(LS_KEYS.votes, []);
}

function hasVoted(resourceId) {
  return getVotedIds().includes(resourceId);
}

function registerVote(resourceId) {
  const voted = getVotedIds();
  if (voted.includes(resourceId)) return false;
  voted.push(resourceId);
  writeJSON(LS_KEYS.votes, voted);

  // Persist the incremented count if it's a user upload; mock resources
  // get a session-only bump tracked alongside the vote list.
  const uploads = getUserUploads();
  const idx = uploads.findIndex((r) => r.id === resourceId);
  if (idx > -1) {
    uploads[idx].upvotes = (uploads[idx].upvotes || 0) + 1;
    writeJSON(LS_KEYS.uploads, uploads);
  }
  return true;
}

/* ---------------------------- Mock auth ---------------------------- */

function getSeedUsers() {
  // A couple of ready-made accounts so login can be demoed without registering first.
  return [
    { id: "user-student", fullName: "Aisha Nabirye", email: "aisha.nabirye@students.mak.ac.ug",
      password: "student123", university: UNIVERSITIES[0], course: "Computer Science",
      year: "Year 2", role: "student", memberSince: "2024-08-14" },
    { id: "user-mod", fullName: "Moderator Kato", email: "moderator@unishare.ug",
      password: "moderate123", university: UNIVERSITIES[0], course: "N/A",
      year: "N/A", role: "moderator", memberSince: "2023-02-01" }
  ];
}

function getAllUsers() {
  const stored = readJSON(LS_KEYS.users, null);
  if (!stored) {
    const seeded = getSeedUsers();
    writeJSON(LS_KEYS.users, seeded);
    return seeded;
  }
  return stored;
}

function findUserByEmail(email) {
  return getAllUsers().find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

function getCurrentUser() {
  return readJSON(LS_KEYS.user, null);
}

function setCurrentUser(user) {
  writeJSON(LS_KEYS.user, user);
}

function logout() {
  localStorage.removeItem(LS_KEYS.user);
  window.location.href = "index.html";
}

function isModerator(user) {
  return !!user && (user.role === "moderator" || user.role === "admin");
}

/* ---------------------------- Path helpers ---------------------------- */

/** Whether the current page lives inside /admin/, so links need "../" prefixes. */
function inAdminFolder() {
  return window.location.pathname.includes("/admin/");
}

function pathTo(page) {
  return inAdminFolder() && !page.startsWith("admin/") && !page.startsWith("http")
    ? `../${page}`
    : page;
}

/* ---------------------------- Header / Nav rendering ---------------------------- */

const NAV_ITEMS = [
  { key: "browse", label: "Browse", href: "browse.html" },
  { key: "upload", label: "Upload", href: "upload.html", authOnly: true },
  { key: "my_uploads", label: "My Uploads", href: "my_uploads.html", authOnly: true }
];

function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  const user = getCurrentUser();
  const activePage = document.body.dataset.page || "";
  const brandHref = pathTo("index.html");

  let linksHtml = "";

  linksHtml += `<li><a href="${pathTo("browse.html")}" class="${activePage === "browse" ? "active" : ""}">Browse</a></li>`;

  if (user) {
    linksHtml += `<li><a href="${pathTo("upload.html")}" class="${activePage === "upload" ? "active" : ""}">Upload</a></li>`;
    linksHtml += `<li><a href="${pathTo("my_uploads.html")}" class="${activePage === "my_uploads" ? "active" : ""}">My Uploads</a></li>`;
    if (isModerator(user)) {
      linksHtml += `<li><a href="${pathTo("admin/moderation_queue.html")}" class="${activePage === "moderation_queue" ? "active" : ""}">Moderation Queue</a></li>`;
      linksHtml += `<li><a href="${pathTo("admin/reports.html")}" class="${activePage === "reports" ? "active" : ""}">Reports</a></li>`;
    }
    linksHtml += `<li><a href="${pathTo("profile.html")}" class="${activePage === "profile" ? "active" : ""}">Profile</a></li>`;
    linksHtml += `<li><button type="button" class="nav-link" id="logout-btn">Logout</button></li>`;
  } else {
    linksHtml += `<li><a href="${pathTo("login.html")}" class="${activePage === "login" ? "active" : ""}">Login</a></li>`;
    linksHtml += `<li><a href="${pathTo("register.html")}" class="btn btn-accent btn-sm">Register</a></li>`;
  }

  mount.innerHTML = `
    <div class="container nav-bar">
      <a href="${brandHref}" class="brand">
        <span class="brand-mark" aria-hidden="true">US</span>
        UniShare Uganda
      </a>
      <button class="hamburger" id="hamburger-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
        <span></span>
      </button>
      <ul class="nav-links" id="nav-links">
        ${linksHtml}
      </ul>
    </div>
    <div class="mobile-drawer-backdrop" id="drawer-backdrop"></div>
  `;

  const hamburger = document.getElementById("hamburger-btn");
  const navLinks = document.getElementById("nav-links");
  const backdrop = document.getElementById("drawer-backdrop");

  function closeMenu() {
    navLinks.classList.remove("open");
    document.body.classList.remove("menu-open");
    hamburger.setAttribute("aria-expanded", "false");
  }
  function toggleMenu() {
    const isOpen = navLinks.classList.toggle("open");
    document.body.classList.toggle("menu-open", isOpen);
    hamburger.setAttribute("aria-expanded", String(isOpen));
  }

  hamburger.addEventListener("click", toggleMenu);
  backdrop.addEventListener("click", closeMenu);
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
    });
  }
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4 style="font-family: var(--font-display); font-size: 1.15rem;">UniShare Uganda</h4>
          <p style="color: rgba(255,255,255,0.65); font-size: 0.9rem; max-width: 34ch;">
            A shared shelf of notes, slides, summaries and past papers, built by students
            from universities across Uganda, for students across Uganda.
          </p>
        </div>
        <div>
          <h4>About</h4>
          <ul>
            <li><a href="${pathTo("index.html")}#mission">Our Mission</a></li>
            <li><a href="${pathTo("index.html")}#about">About UniShare</a></li>
            <li><a href="${pathTo("browse.html")}">Browse Resources</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="${pathTo("index.html")}#contact">Contact</a></li>
            <li><a href="${pathTo("index.html")}#report">Report an Issue</a></li>
            <li><a href="${pathTo("index.html")}#terms">Terms</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${year} UniShare Uganda. A student project — for demonstration only.</span>
        <span>Built for students, by students.</span>
      </div>
    </div>
  `;
}

/* ---------------------------- Toasts ---------------------------- */

function ensureToastRegion() {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("role", "status");
    document.body.appendChild(region);
  }
  return region;
}

function showToast(message, type) {
  const region = ensureToastRegion();
  const toast = document.createElement("div");
  toast.className = `toast${type ? " toast-" + type : ""}`;
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

/* ---------------------------- Modal helpers ---------------------------- */

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("open");
    const focusable = el.querySelector("input, textarea, select, button");
    if (focusable) focusable.focus();
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

function wireModalDismissals() {
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.remove("open");
    });
    backdrop.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => backdrop.classList.remove("open"));
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
    }
  });
}

/* ---------------------------- Resource card markup (shared) ---------------------------- */

function renderResourceCard(resource) {
  const type = resourceTypeMeta(resource.type);
  const voted = hasVoted(resource.id);
  const detailHref = pathTo(`resource_detail.html?id=${encodeURIComponent(resource.id)}`);
  return `
    <article class="resource-card" data-id="${resource.id}">
      <div class="tab ${type.tabClass}"></div>
      <div class="card-body">
        <div class="card-eyebrow">
          <span class="course-stamp">${escapeHtml(resource.courseCode)}</span>
          <span class="badge ${type.badgeClass}">${type.label}</span>
        </div>
        <h3><a href="${detailHref}">${escapeHtml(resource.title)}</a></h3>
        <div class="card-meta">
          <span>${escapeHtml(resource.university)}</span>
          <span>${escapeHtml(resource.lecturer)}</span>
        </div>
        <div class="card-footer">
          <button type="button" class="upvote-btn ${voted ? "voted" : ""}" data-vote-id="${resource.id}" aria-pressed="${voted}">
            ▲ <span class="vote-count">${resource.upvotes}</span>
          </button>
          <a href="${detailHref}" class="btn btn-outline btn-sm">View</a>
        </div>
      </div>
    </article>
  `;
}

/** Delegated upvote handling — works for any grid rendered with renderResourceCard(). */
function wireUpvoteDelegation(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vote-id]");
    if (!btn) return;
    const user = getCurrentUser();
    if (!user) {
      showToast("Login to vote.", "error");
      return;
    }
    const resourceId = btn.dataset.voteId;
    if (hasVoted(resourceId)) {
      showToast("You already upvoted this resource.");
      return;
    }
    registerVote(resourceId);
    btn.classList.add("voted");
    btn.setAttribute("aria-pressed", "true");
    const countEl = btn.querySelector(".vote-count");
    countEl.textContent = String(Number(countEl.textContent) + 1);
    showToast("Upvoted — thanks for the feedback!", "success");
  });
}

/* ---------------------------- Homepage-specific rendering ---------------------------- */

function renderHomepage() {
  const recentMount = document.getElementById("recent-resources-grid");
  if (recentMount) {
    const recent = [...getAllResources()]
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
      .slice(0, 8);
    recentMount.innerHTML = recent.map(renderResourceCard).join("");
    wireUpvoteDelegation("#recent-resources-grid");
  }

  const uniSelect = document.getElementById("hero-university-select");
  if (uniSelect) {
    uniSelect.innerHTML = `<option value="">All universities</option>` +
      UNIVERSITIES.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  }

  const heroForm = document.getElementById("hero-search-form");
  if (heroForm) {
    populateSearchSuggestions("hero-search-suggestions");
    heroForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("hero-search-input").value.trim();
      const uni = uniSelect ? uniSelect.value : "";
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (uni) params.set("university", uni);
      window.location.href = `browse.html${params.toString() ? "?" + params.toString() : ""}`;
    });
  }

  document.querySelectorAll("[data-category-link]").forEach((el) => {
    el.href = `browse.html?type=${encodeURIComponent(el.dataset.categoryLink)}`;
  });
}

/* ---------------------------- Init ---------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  wireModalDismissals();

  if (document.body.dataset.page === "home") {
    renderHomepage();
  }
});
