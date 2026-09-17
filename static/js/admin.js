/* =========================================================
   UniShare Uganda - admin.js (live app)
   Adapted from frontend/js/admin.js (design preserved);
   mock data replaced with real API calls.
   ========================================================= */

let modStatus = "pending";

/* ---------- Moderation Queue ---------- */

function modItemHtml(item) {
  return `
    <div class="mod-item" data-id="${item.resource_id}">
      <div class="mod-item-top">
        <label class="checkbox-row" style="align-items:center;">
          <input type="checkbox" class="mod-select" data-id="${item.resource_id}" aria-label="Select ${escapeHtml(item.title)}">
          <div>
            <span class="badge ${typeBadgeClass(item.resource_type)}">${escapeHtml(item.resource_type)}</span>
            <h3 style="margin-top:6px;"><a href="/resource_detail.html?id=${item.resource_id}">${escapeHtml(item.title)}</a></h3>
          </div>
        </label>
        <span class="status-badge status-${item.status}">${item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
      </div>
      <div class="mod-item-meta">
        <div><div class="meta-label">Course</div><div class="meta-value">${escapeHtml(item.course_code)} &middot; ${escapeHtml(item.course_name)}</div></div>
        <div><div class="meta-label">School</div><div class="meta-value">${escapeHtml(item.school_name || "—")}</div></div>
        <div><div class="meta-label">Lecturer</div><div class="meta-value">${escapeHtml(item.lecturer_name)}</div></div>
        <div><div class="meta-label">Year / Semester</div><div class="meta-value">${escapeHtml(item.academic_year)} &middot; ${escapeHtml(item.semester)}</div></div>
        <div><div class="meta-label">Uploader</div><div class="meta-value">${escapeHtml(item.uploader_name || "—")}</div></div>
        <div><div class="meta-label">Submitted</div><div class="meta-value">${formatDate(item.created_at)}</div></div>
      </div>
      ${item.status === "rejected" && item.rejection_reason ? `<div class="notice-box notice-warning">${ICONS.warn} Rejected: ${escapeHtml(item.rejection_reason)}</div>` : ""}
      <div class="mod-item-actions">
        <button class="btn btn-ghost btn-sm preview-btn" data-id="${item.resource_id}">Preview</button>
        <button class="btn btn-secondary btn-sm approve-btn" data-id="${item.resource_id}">${ICONS.check} Approve</button>
        <button class="btn btn-outline btn-sm edit-btn" data-id="${item.resource_id}">Edit Before Approve</button>
        <button class="btn btn-danger btn-sm reject-btn" data-id="${item.resource_id}">Reject</button>
      </div>
    </div>
  `;
}

function renderQueue(list) {
  const mount = document.getElementById("modQueueList");
  if (!mount) return;
  if (!list.length) {
    mount.innerHTML = `<div class="empty-state"><h3>Queue is clear</h3><p>There are no ${modStatus} submissions right now.</p></div>`;
    return;
  }
  mount.innerHTML = list.map(modItemHtml).join("");

  mount.querySelectorAll(".approve-btn").forEach(btn => btn.addEventListener("click", () => {
    approveItem(Number(btn.getAttribute("data-id")));
  }));
  mount.querySelectorAll(".reject-btn").forEach(btn => btn.addEventListener("click", () => {
    document.getElementById("rejectModal").setAttribute("data-target-id", btn.getAttribute("data-id"));
    document.getElementById("rejectModal").classList.add("open");
  }));
  mount.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => {
    openEditModal(Number(btn.getAttribute("data-id")));
  }));
  mount.querySelectorAll(".preview-btn").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-id");
    window.open(`/resource_detail.html?id=${id}`, "_blank");
  }));
}

function currentQueueView() {
  /* Client-side type filter (server handles status + school). */
  const type = document.getElementById("modFilterType")?.value;
  return allQueueItems.filter(i => (!type || i.resource_type === type));
}

async function loadQueue() {
  const mount = document.getElementById("modQueueList");
  const params = { status: modStatus, per_page: 100 };
  const schoolSel = document.getElementById("modFilterSchool");
  if (schoolSel && schoolSel.style.display !== "none" && schoolSel.value) {
    params.school_id = schoolSel.value;
  }
  try {
    const data = isSuperAdmin()
      ? await apiFetch(`/api/super-admin/moderation-queue?${new URLSearchParams(params)}`).then(r => r.data)
      : await apiFetch(`/api/admin/moderation-queue?${new URLSearchParams(params)}`).then(r => r.data);
    allQueueItems = data.resources;
    renderQueue(currentQueueView());
  } catch (err) {
    handleAuthError(err);
    if (mount) mount.innerHTML = `<div class="empty-state"><h3>Could not load queue</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function openEditModal(id) {
  const item = allQueueItems.find(i => i.resource_id === id);
  if (!item) return;
  document.getElementById("editResourceId").value = item.resource_id;
  document.getElementById("editTitle").value = item.title;
  document.getElementById("editCourseCode").value = item.course_code;
  document.getElementById("editCourseName").value = item.course_name;
  document.getElementById("editLecturer").value = item.lecturer_name;
  document.getElementById("editSemester").value = item.semester;
  document.getElementById("editType").value = item.resource_type;
  document.getElementById("editDescription").value = item.description || "";
  document.getElementById("editModal").classList.add("open");
}

function updateQueueStats() {
  const pending = allQueueItems.filter(i => i.status === "pending").length;
  const today = allQueueItems.filter(i => i.created_at && i.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  let oldestDays = 0;
  const now = Date.now();
  allQueueItems.filter(i => i.status === "pending" && i.created_at).forEach(i => {
    const days = Math.floor((now - new Date(i.created_at).getTime()) / 864e5);
    if (days > oldestDays) oldestDays = days;
  });

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText("statPendingCount", pending);
  setText("statPendingCount2", pending);
  setText("statToday", today);
  setText("statToday2", today);
  setText("statOldest", oldestDays ? `${oldestDays} day${oldestDays > 1 ? "s" : ""}` : "today");
  setText("statOldest2", oldestDays ? `${oldestDays} day${oldestDays > 1 ? "s" : ""}` : "0d");
}

async function initModerationQueue() {
  const mount = document.getElementById("modQueueList");
  if (!mount) return;

  const user = await authReady().then(getAuthState);
  if (!user || !isModerator(user)) {
    mount.innerHTML = `<div class="empty-state"><h3>Staff only</h3><p>You need a moderator or super admin account to view this page.</p></div>`;
    return;
  }
  isSuperAdminFlag = user.role === "super_admin";

  /* Super admin gets the school filter (populated from /api/schools). */
  const schoolSel = document.getElementById("modFilterSchool");
  if (schoolSel && isSuperAdminFlag) {
    schoolSel.style.display = "";
    populateSchoolSelect(schoolSel, true);
    schoolSel.addEventListener("change", loadQueue);
  }

  updateQueueStats();
  loadQueue();

  document.getElementById("modFilterType").addEventListener("change", () => renderQueue(currentQueueView()));

  document.getElementById("modStatusTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".pill-tab");
    if (!btn) return;
    document.querySelectorAll("#modStatusTabs .pill-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    modStatus = btn.getAttribute("data-status");
    loadQueue();
  });

  document.getElementById("selectAllPending")?.addEventListener("change", (e) => {
    mount.querySelectorAll(".mod-select").forEach(cb => cb.checked = e.target.checked);
  });

  document.getElementById("approveSelectedBtn")?.addEventListener("click", async () => {
    const ids = Array.from(mount.querySelectorAll(".mod-select:checked")).map(cb => Number(cb.getAttribute("data-id")));
    if (!ids.length) { showToast("Select at least one item first.", "error"); return; }
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await api.moderate(id, "approve", null, isSuperAdmin());
        ok++;
      } catch (err) { fail++; }
    }
    showToast(`${ok} approved${fail ? `, ${fail} failed` : ""}.`, fail ? "error" : "success");
    loadQueue();
  });

  /* Reject modal actions */
  document.getElementById("rejectModalClose").addEventListener("click", () => document.getElementById("rejectModal").classList.remove("open"));
  document.getElementById("rejectModalCancel").addEventListener("click", () => document.getElementById("rejectModal").classList.remove("open"));
  document.getElementById("rejectModalSubmit").addEventListener("click", async () => {
    const id = Number(document.getElementById("rejectModal").getAttribute("data-target-id"));
    const reason = document.getElementById("rejectReason").value;
    const comment = document.getElementById("rejectComment").value.trim();
    try {
      await api.moderate(id, "reject", { reason: comment ? `${reason}: ${comment}` : reason }, isSuperAdmin());
      showToast("Resource rejected.", "success");
      document.getElementById("rejectModal").classList.remove("open");
      loadQueue();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  /* Edit modal actions */
  document.getElementById("editModalClose").addEventListener("click", () => document.getElementById("editModal").classList.remove("open"));
  document.getElementById("editModalCancel").addEventListener("click", () => document.getElementById("editModal").classList.remove("open"));
  document.getElementById("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editResourceId").value;
    const payload = {
      title: document.getElementById("editTitle").value,
      course_code: document.getElementById("editCourseCode").value,
      course_name: document.getElementById("editCourseName").value,
      lecturer_name: document.getElementById("editLecturer").value,
      semester: document.getElementById("editSemester").value,
      resource_type: document.getElementById("editType").value,
      description: document.getElementById("editDescription").value
    };
    try {
      await apiFetch(`/api/admin/resources/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Saved.", "success");
      document.getElementById("editModal").classList.remove("open");
      loadQueue();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

/* ---------- Reports page (Step 5.3) ---------- */

function reportRowHtml(rep) {
  const status = rep.status === "open"
    ? `<span class="status-badge status-pending">Open</span>`
    : `<span class="status-badge status-approved">Resolved</span>`;
  return `
    <tr>
      <td data-label="Resource"><a href="/resource_detail.html?id=${rep.resource_id}">${escapeHtml(rep.resource_title)}</a></td>
      <td data-label="Reason"><span class="badge badge-summary">${escapeHtml(rep.reason)}</span>${rep.comment ? `<div class="text-secondary" style="font-size:0.8rem;margin-top:4px;">${escapeHtml(rep.comment)}</div>` : ""}</td>
      <td data-label="Reporter">${escapeHtml(rep.reporter_name || "—")}</td>
      <td data-label="Date">${formatDate(rep.created_at)}</td>
      <td data-label="Status">${status}</td>
      <td data-label="Actions">
        ${rep.status === "open" ? `<button class="btn btn-secondary btn-sm" data-resolve="${rep.report_id}">Resolve</button>` : ""}
        <button class="btn btn-danger btn-sm" data-remove="${rep.resource_id}" data-title="${escapeHtml(rep.resource_title)}">Remove Resource</button>
      </td>
    </tr>
  `;
}

async function loadReports() {
  const tbody = document.getElementById("reportsTableBody");
  if (!tbody) return;
  const status = document.getElementById("reportStatusFilter")?.value || "open";
  try {
    const data = await apiFetch(`/api/admin/reports?status=${encodeURIComponent(status)}&per_page=100`).then(r => r.data);
    if (!data.reports.length) {
      tbody.innerHTML = "";
      const empty = document.getElementById("reportsEmpty");
      if (empty) empty.style.display = "block";
      return;
    }
    const empty = document.getElementById("reportsEmpty");
    if (empty) empty.style.display = "none";
    tbody.innerHTML = data.reports.map(reportRowHtml).join("");
  } catch (err) {
    handleAuthError(err);
  }
}

async function initReports() {
  const tbody = document.getElementById("reportsTableBody");
  if (!tbody) return;

  const user = await authReady().then(getAuthState);
  if (!user || user.role !== "super_admin") {
    document.querySelector(".table-wrap")?.style.setProperty("display", "none");
    const gate = document.getElementById("reportsEmpty");
    if (gate) {
      gate.style.display = "block";
      gate.querySelector("h3").textContent = "Super admin only";
      gate.querySelector("p").textContent = "Reports are managed by the super admin.";
    }
    return;
  }

  document.getElementById("reportStatusFilter")?.addEventListener("change", loadReports);
  loadReports();

  tbody.addEventListener("click", async (e) => {
    const resolveBtn = e.target.closest("[data-resolve]");
    if (resolveBtn) {
      try {
        await apiFetch(`/api/admin/reports/${resolveBtn.getAttribute("data-resolve")}/resolve`, { method: "POST" });
        showToast("Report resolved.", "success");
        loadReports();
      } catch (err) { showToast(err.message, "error"); }
      return;
    }
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      if (!confirm(`Remove "${removeBtn.getAttribute("data-title")}" from public view?`)) return;
      try {
        await apiFetch(`/api/admin/resources/${removeBtn.getAttribute("data-remove")}/soft-delete`, { method: "POST" });
        showToast("Resource removed from public view.", "success");
        loadReports();
      } catch (err) { showToast(err.message, "error"); }
    }
  });
}

/* ---------- Page dispatch ---------- */

let allQueueItems = [];
let isSuperAdminFlag = false;

function isSuperAdmin() { return isSuperAdminFlag; }

document.addEventListener("DOMContentLoaded", async () => {
  /* main.js's DOMContentLoaded await does NOT block these listeners —
     each init awaits authReady() before reading the session user. */
  await initModerationQueue();
  await initReports();
  hydrateIcons();
});
