/* =========================================================
   UniShare Uganda — admin.js
   ========================================================= */

const PENDING_QUEUE = [
  { id: 13, title: "Operating Systems Summary", course_code: "CIT220", course_name: "Operating Systems", university: "Makerere University", lecturer: "Dr. Ivan Mugisha", year: "2025/2026", semester: "Semester 1", type: "Summary", uploader_name: "Kevin W.", submitted: "2026-09-08", duplicate: false },
  { id: 15, title: "Cell Biology Notes", course_code: "BIO101", course_name: "Cell Biology", university: "Gulu University", lecturer: "Dr. Christine Aciro", year: "2025/2026", semester: "Semester 1", type: "Notes", uploader_name: "Ruth A.", submitted: "2026-09-07", duplicate: true },
  { id: 16, title: "Corporate Finance Past Paper 2025", course_code: "FIN301", course_name: "Corporate Finance", university: "MUBS", lecturer: "Ms. Ritah Nabirye", year: "2025/2026", semester: "Semester 2", type: "Past Paper", uploader_name: "Angela T.", submitted: "2026-09-06", duplicate: false },
  { id: 17, title: "Discrete Mathematics Slides", course_code: "MTH140", course_name: "Discrete Mathematics", university: "Kyambogo University", lecturer: "Dr. Fred Ochieng", year: "2024/2025", semester: "Semester 1", type: "Slides", uploader_name: "Brian K.", submitted: "2026-09-04", duplicate: false }
];

const REPORTED = [
  { resource_id: 4, title: "Financial Accounting Summary Notes", course_code: "ACC110", reports: [
      { reason: "Outdated", reporter: "Diana M.", date: "2026-09-10" },
      { reason: "Incorrect content", reporter: "Kevin W.", date: "2026-09-09" }
    ], status: "Open" },
  { resource_id: 9, title: "Software Engineering Summary — SDLC Models", course_code: "CIT350", reports: [
      { reason: "Duplicate", reporter: "Grace N.", date: "2026-09-05" }
    ], status: "Resolved" }
];

function openModal(id) { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

/* ---------- Moderation Queue ---------- */

function modItemHtml(item) {
  return `
    <div class="mod-item" data-id="${item.id}">
      <div class="mod-item-top">
        <label class="checkbox-row" style="align-items:center;">
          <input type="checkbox" class="mod-select" data-id="${item.id}" aria-label="Select ${item.title}">
          <div>
            <span class="badge ${typeBadgeClass(item.type)}">${item.type}</span>
            <h3 style="margin-top:6px;">${item.title}</h3>
          </div>
        </label>
      </div>
      ${item.duplicate ? `<div class="notice-box notice-warning">${ICONS.warn} Similar resources already exist for this course.</div>` : ""}
      <div class="mod-item-meta">
        <div><div class="meta-label">Course</div><div class="meta-value">${item.course_code} &middot; ${item.course_name}</div></div>
        <div><div class="meta-label">University</div><div class="meta-value">${item.university}</div></div>
        <div><div class="meta-label">Lecturer</div><div class="meta-value">${item.lecturer}</div></div>
        <div><div class="meta-label">Year / Semester</div><div class="meta-value">${item.year} &middot; ${item.semester}</div></div>
        <div><div class="meta-label">Uploader</div><div class="meta-value">${item.uploader_name}</div></div>
        <div><div class="meta-label">Submitted</div><div class="meta-value">${item.submitted}</div></div>
      </div>
      <div class="mod-item-actions">
        <button class="btn btn-ghost btn-sm preview-btn" data-id="${item.id}">Preview</button>
        <button class="btn btn-secondary btn-sm approve-btn" data-id="${item.id}">${ICONS.check} Approve</button>
        <button class="btn btn-outline btn-sm edit-btn" data-id="${item.id}">Edit Before Approve</button>
        <button class="btn btn-danger btn-sm reject-btn" data-id="${item.id}">Reject</button>
      </div>
    </div>
  `;
}

function renderQueue(list) {
  const mount = document.getElementById("modQueueList");
  if (!mount) return;
  if (!list.length) {
    mount.innerHTML = `<div class="empty-state"><h3>Queue is clear</h3><p>There are no pending submissions right now.</p></div>`;
    return;
  }
  mount.innerHTML = list.map(modItemHtml).join("");

  mount.querySelectorAll(".approve-btn").forEach(btn => btn.addEventListener("click", () => {
    approveItem(Number(btn.getAttribute("data-id")));
  }));
  mount.querySelectorAll(".preview-btn").forEach(btn => btn.addEventListener("click", () => {
    showToast("Preview opened in a new panel (demo).", null);
  }));
  mount.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => {
    showToast("Edit-before-approve form would open here.", null);
  }));
  mount.querySelectorAll(".reject-btn").forEach(btn => btn.addEventListener("click", () => {
    document.getElementById("rejectModal").setAttribute("data-target-id", btn.getAttribute("data-id"));
    openModal("rejectModal");
  }));
}

function approveItem(id) {
  const idx = PENDING_QUEUE.findIndex(i => i.id === id);
  if (idx > -1) PENDING_QUEUE.splice(idx, 1);
  renderQueue(currentQueueView());
  showToast("Resource approved.", "success");
  updateQueueStats();
}

function rejectItem(id, reason, comment) {
  const idx = PENDING_QUEUE.findIndex(i => i.id === id);
  if (idx > -1) PENDING_QUEUE.splice(idx, 1);
  renderQueue(currentQueueView());
  showToast(`Resource rejected: ${reason}.`, "error");
  updateQueueStats();
}

function currentQueueView() {
  const uni = document.getElementById("modFilterUniversity")?.value;
  const type = document.getElementById("modFilterType")?.value;
  return PENDING_QUEUE.filter(i => (!uni || i.university === uni) && (!type || i.type === type));
}

function updateQueueStats() {
  ["statPendingCount", "statPendingCount2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = PENDING_QUEUE.length;
  });
}

function initModerationQueue() {
  const mount = document.getElementById("modQueueList");
  if (!mount) return;

  populateUniversitySelect(document.getElementById("modFilterUniversity"), true);
  updateQueueStats();
  renderQueue(currentQueueView());

  document.getElementById("modFilterUniversity").addEventListener("change", () => renderQueue(currentQueueView()));
  document.getElementById("modFilterType").addEventListener("change", () => renderQueue(currentQueueView()));

  document.getElementById("selectAllPending")?.addEventListener("change", (e) => {
    mount.querySelectorAll(".mod-select").forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById("approveSelectedBtn")?.addEventListener("click", () => {
    const ids = Array.from(mount.querySelectorAll(".mod-select:checked")).map(cb => Number(cb.getAttribute("data-id")));
    if (!ids.length) { showToast("Select at least one item first.", "error"); return; }
    ids.forEach(id => {
      const idx = PENDING_QUEUE.findIndex(i => i.id === id);
      if (idx > -1) PENDING_QUEUE.splice(idx, 1);
    });
    renderQueue(currentQueueView());
    updateQueueStats();
    showToast(`${ids.length} resource(s) approved.`, "success");
  });

  document.getElementById("rejectModalClose")?.addEventListener("click", () => closeModal("rejectModal"));
  document.getElementById("rejectModalCancel")?.addEventListener("click", () => closeModal("rejectModal"));
  document.getElementById("rejectModalSubmit")?.addEventListener("click", () => {
    const targetId = Number(document.getElementById("rejectModal").getAttribute("data-target-id"));
    const reason = document.getElementById("rejectReason").value;
    const comment = document.getElementById("rejectComment").value;
    closeModal("rejectModal");
    rejectItem(targetId, reason, comment);
    document.getElementById("rejectComment").value = "";
  });
}

/* ---------- Reports page ---------- */

function reportCardHtml(r) {
  const reasons = Array.from(new Set(r.reports.map(rep => rep.reason)));
  const latest = r.reports.map(rep => rep.date).sort().reverse()[0];
  return `
    <div class="report-card" data-id="${r.resource_id}">
      <div class="mod-item-top">
        <div>
          <h3>${r.title}</h3>
          <div class="text-secondary" style="font-size:0.88rem;margin-top:4px;">${r.course_code} &middot; ${r.reports.length} report${r.reports.length > 1 ? "s" : ""}</div>
        </div>
        <span class="status-badge ${r.status === "Open" ? "status-pending" : "status-approved"}">${r.status}</span>
      </div>
      <div class="report-reasons">${reasons.map(reason => `<span class="reason-chip">${reason}</span>`).join("")}</div>
      <div class="text-secondary" style="font-size:0.82rem;margin-top:8px;">Latest report: ${latest} &middot; Reported by: ${r.reports.map(rep => rep.reporter).join(", ")}</div>
      <div class="mod-item-actions">
        <a href="resource_detail.html?id=${r.resource_id}" class="btn btn-ghost btn-sm">View Resource</a>
        <button class="btn btn-outline btn-sm dismiss-btn" data-id="${r.resource_id}">Dismiss Report</button>
        <button class="btn btn-outline btn-sm">Edit Metadata</button>
        <button class="btn btn-outline btn-sm">Notify Uploader</button>
        <button class="btn btn-danger btn-sm remove-btn" data-id="${r.resource_id}">Remove Resource</button>
      </div>
    </div>
  `;
}

function renderReports() {
  const mount = document.getElementById("reportsList");
  if (!mount) return;
  if (!REPORTED.length) {
    mount.innerHTML = `<div class="empty-state"><h3>No open reports</h3><p>All reported resources have been reviewed.</p></div>`;
    return;
  }
  mount.innerHTML = REPORTED.map(reportCardHtml).join("");

  mount.querySelectorAll(".dismiss-btn").forEach(btn => btn.addEventListener("click", () => {
    const id = Number(btn.getAttribute("data-id"));
    const item = REPORTED.find(r => r.resource_id === id);
    if (item) item.status = "Resolved";
    renderReports();
    showToast("Report dismissed.", "success");
  }));
  mount.querySelectorAll(".remove-btn").forEach(btn => btn.addEventListener("click", () => {
    const id = Number(btn.getAttribute("data-id"));
    const idx = REPORTED.findIndex(r => r.resource_id === id);
    if (idx > -1) REPORTED.splice(idx, 1);
    renderReports();
    showToast("Resource removed.", "error");
  }));
}

document.addEventListener("DOMContentLoaded", () => {
  initModerationQueue();
  renderReports();
});
