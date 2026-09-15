/* ==========================================================================
   UniShare Uganda — admin.js
   Handles admin/moderation_queue.html and admin/reports.html
   ========================================================================== */

function requireModeratorOrRedirect() {
  const user = getCurrentUser();
  if (!user) {
    showToast("Please log in as a moderator to continue.", "error");
    setTimeout(() => { window.location.href = "../login.html"; }, 900);
    return false;
  }
  if (!isModerator(user)) {
    showToast("This area is restricted to moderators.", "error");
    setTimeout(() => { window.location.href = "../browse.html"; }, 900);
    return false;
  }
  return true;
}

/* ---------------------------- Mock moderation data ---------------------------- */

function getDismissedSeedIds() {
  return readJSON("unishare_seed_moderated", []);
}

function dismissSeedId(id) {
  const dismissed = getDismissedSeedIds();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    writeJSON("unishare_seed_moderated", dismissed);
  }
}

function getModerationQueueItems() {
  // Pending items = user uploads with status "pending", plus a handful of
  // seeded mock-pending items so the queue never looks empty on a fresh session.
  const userItems = getUserUploads();
  const dismissed = getDismissedSeedIds();
  const seededPending = MOCK_RESOURCES.slice(0, 6)
    .map((r, i) => ({ ...r, id: "seed-pending-" + i, status: "pending", possibleDuplicate: i % 3 === 0 }))
    .filter((r) => !dismissed.includes(r.id));
  return [...userItems.filter((u) => u.status === "pending"), ...seededPending];
}

function renderModerationStats(queue) {
  document.getElementById("stat-pending").textContent = queue.length;
  document.getElementById("stat-approved-today").textContent = readJSON("unishare_approved_today", 0);
  document.getElementById("stat-rejected").textContent = getUserUploads().filter((u) => u.status === "rejected").length;
  document.getElementById("stat-duplicates").textContent = queue.filter((q) => q.possibleDuplicate).length;
}

function renderModerationQueue() {
  const mount = document.getElementById("moderation-list");
  const uniFilter = document.getElementById("mod-filter-university").value;
  const typeFilter = document.getElementById("mod-filter-type").value;

  let queue = getModerationQueueItems();
  if (uniFilter) queue = queue.filter((q) => q.university === uniFilter);
  if (typeFilter) queue = queue.filter((q) => q.type === typeFilter);

  renderModerationStats(getModerationQueueItems());

  if (queue.length === 0) {
    mount.innerHTML = `<div class="empty-state"><h3>Queue is clear</h3><p>No submissions match these filters right now.</p></div>`;
    return;
  }

  mount.innerHTML = queue.map((item) => {
    const type = resourceTypeMeta(item.type);
    return `
      <article class="resource-card" style="flex-direction: row; align-items: stretch;" data-mod-id="${item.id}">
        <div class="tab ${type.tabClass}" style="width: 6px; height: auto;"></div>
        <div class="card-body" style="flex-direction: row; flex-wrap: wrap; align-items: center; gap: var(--space-4);">
          <div style="flex: 1; min-width: 220px;">
            <div class="card-eyebrow" style="margin-bottom: 6px;">
              <span class="course-stamp">${escapeHtml(item.courseCode)}</span>
              <span class="badge ${type.badgeClass}">${type.label}</span>
              ${item.possibleDuplicate ? `<span class="stamp stamp-duplicate" style="transform:none; padding:2px 8px; font-size:0.7rem;">Possible Duplicate</span>` : ""}
            </div>
            <h3 style="margin-bottom: 4px;">${escapeHtml(item.title)}</h3>
            <div class="card-meta">
              <span>${escapeHtml(item.university)} · ${escapeHtml(item.lecturer)}</span>
              <span>${escapeHtml(item.academicYear)}, ${escapeHtml(item.semester)} · Uploaded by ${escapeHtml(item.uploader)} on ${formatDate(item.uploadDate)}</span>
            </div>
          </div>
          <div class="action-row">
            <label class="checkbox-row" style="align-items:center; margin-right: 8px;">
              <input type="checkbox" class="mod-select-checkbox" data-mod-select="${item.id}" aria-label="Select ${escapeHtml(item.title)}">
            </label>
            <button type="button" class="btn btn-outline btn-sm" data-mod-preview="${item.id}">Preview</button>
            <button type="button" class="btn btn-accent btn-sm" data-mod-approve="${item.id}">Approve</button>
            <button type="button" class="btn btn-danger btn-sm" data-mod-reject="${item.id}">Reject</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  wireModerationRowActions();
}

function approveItem(id) {
  const uploads = getUserUploads();
  const idx = uploads.findIndex((u) => u.id === id);
  if (idx > -1) {
    uploads[idx].status = "approved";
    uploads[idx].approved = true;
    writeJSON(LS_KEYS.uploads, uploads);
  } else if (id.startsWith("seed-pending-")) {
    dismissSeedId(id);
  }
  const approvedToday = readJSON("unishare_approved_today", 0);
  writeJSON("unishare_approved_today", approvedToday + 1);
  showToast("Resource approved.", "success");
  renderModerationQueue();
}

function rejectItem(id, reason) {
  const uploads = getUserUploads();
  const idx = uploads.findIndex((u) => u.id === id);
  if (idx > -1) {
    uploads[idx].status = "rejected";
    uploads[idx].approved = false;
    uploads[idx].rejectionReason = reason;
    writeJSON(LS_KEYS.uploads, uploads);
  } else if (id.startsWith("seed-pending-")) {
    dismissSeedId(id);
  }
  showToast("Resource rejected.", "success");
  renderModerationQueue();
}

let pendingRejectId = null;

function wireModerationRowActions() {
  document.querySelectorAll("[data-mod-approve]").forEach((btn) => {
    btn.addEventListener("click", () => approveItem(btn.dataset.modApprove));
  });
  document.querySelectorAll("[data-mod-reject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingRejectId = btn.dataset.modReject;
      openModal("reject-modal");
    });
  });
  document.querySelectorAll("[data-mod-preview]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("Preview: opening a read-only view of this submission.");
    });
  });
}

function initModerationQueuePage() {
  const mount = document.getElementById("moderation-list");
  if (!mount) return;
  if (!requireModeratorOrRedirect()) return;

  document.getElementById("mod-filter-university").innerHTML =
    `<option value="">All universities</option>` +
    UNIVERSITIES.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  document.getElementById("mod-filter-type").innerHTML =
    `<option value="">All types</option>` +
    RESOURCE_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");

  document.getElementById("mod-filter-university").addEventListener("change", renderModerationQueue);
  document.getElementById("mod-filter-type").addEventListener("change", renderModerationQueue);

  document.getElementById("reject-confirm-btn").addEventListener("click", () => {
    const reason = document.getElementById("reject-reason-select").value;
    if (!reason) { showToast("Select a rejection reason.", "error"); return; }
    rejectItem(pendingRejectId, reason);
    closeModal("reject-modal");
    document.getElementById("reject-reason-select").value = "";
    document.getElementById("reject-comment").value = "";
  });

  document.getElementById("approve-selected-btn").addEventListener("click", () => {
    const ids = Array.from(document.querySelectorAll(".mod-select-checkbox:checked")).map((cb) => cb.dataset.modSelect);
    if (ids.length === 0) { showToast("Select at least one item first.", "error"); return; }
    ids.forEach((id) => approveItem(id));
  });

  renderModerationQueue();
}

/* ---------------------------- Reports page ---------------------------- */

function seedReports() {
  const existing = readJSON(LS_KEYS.reports, null);
  if (existing) return existing;

  const reasons = ["Outdated", "Wrong Course", "Duplicate", "Incorrect Content", "Inappropriate"];
  const sample = MOCK_RESOURCES.slice(0, 9).map((r, i) => ({
    id: "report-" + i,
    resourceId: r.id,
    resourceTitle: r.title,
    courseCode: r.courseCode,
    reasonCounts: { [reasons[i % reasons.length]]: 1 + (i % 4) },
    latestReportDate: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    status: i % 4 === 0 ? "resolved" : "open"
  }));
  writeJSON(LS_KEYS.reports, sample);
  return sample;
}

function renderReports() {
  const statusFilter = document.getElementById("report-filter-status").value;
  const reasonFilter = document.getElementById("report-filter-reason").value;
  let reports = seedReports();

  if (statusFilter) reports = reports.filter((r) => r.status === statusFilter);
  if (reasonFilter) reports = reports.filter((r) => Object.keys(r.reasonCounts).includes(reasonFilter));

  const mount = document.getElementById("reports-table-body");
  if (reports.length === 0) {
    document.getElementById("reports-empty").hidden = false;
    mount.innerHTML = "";
    return;
  }
  document.getElementById("reports-empty").hidden = true;

  mount.innerHTML = reports.map((r) => {
    const totalReports = Object.values(r.reasonCounts).reduce((a, b) => a + b, 0);
    const topReason = Object.entries(r.reasonCounts).sort((a, b) => b[1] - a[1])[0][0];
    return `
      <tr data-report-id="${r.id}">
        <td data-label="Resource">${escapeHtml(r.resourceTitle)}</td>
        <td data-label="Course">${escapeHtml(r.courseCode)}</td>
        <td data-label="Reports">${totalReports}</td>
        <td data-label="Reason">${escapeHtml(topReason)}</td>
        <td data-label="Latest">${formatDate(r.latestReportDate)}</td>
        <td data-label="Status"><span class="badge ${r.status === "open" ? "badge-status-pending" : "badge-status-approved"}">${r.status === "open" ? "Open" : "Resolved"}</span></td>
        <td data-label="Actions">
          <div class="action-row">
            <a href="../resource_detail.html?id=${encodeURIComponent(r.resourceId)}" class="btn btn-ghost btn-sm">View</a>
            <button type="button" class="btn btn-outline btn-sm" data-report-dismiss="${r.id}">Dismiss</button>
            <button type="button" class="btn btn-danger btn-sm" data-report-remove="${r.id}">Remove</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-report-dismiss]").forEach((btn) => {
    btn.addEventListener("click", () => updateReportStatus(btn.dataset.reportDismiss, "resolved", "Report dismissed."));
  });
  document.querySelectorAll("[data-report-remove]").forEach((btn) => {
    btn.addEventListener("click", () => updateReportStatus(btn.dataset.reportRemove, "resolved", "Resource removed and report closed."));
  });
}

function updateReportStatus(reportId, status, message) {
  const reports = seedReports();
  const idx = reports.findIndex((r) => r.id === reportId);
  if (idx > -1) {
    reports[idx].status = status;
    writeJSON(LS_KEYS.reports, reports);
  }
  showToast(message, "success");
  renderReports();
}

function initReportsPage() {
  const mount = document.getElementById("reports-table-body");
  if (!mount) return;
  if (!requireModeratorOrRedirect()) return;

  document.getElementById("report-filter-reason").innerHTML =
    `<option value="">All reasons</option>` +
    REPORT_REASONS.map((r) => `<option value="${r}">${r}</option>`).join("");

  document.getElementById("report-filter-status").addEventListener("change", renderReports);
  document.getElementById("report-filter-reason").addEventListener("change", renderReports);

  renderReports();
}

document.addEventListener("DOMContentLoaded", () => {
  initModerationQueuePage();
  initReportsPage();
});
