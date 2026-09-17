/* =========================================================
   UniShare Uganda - users.js (live app)
   User management for the super admin. Design patterns from
   the frontend reference (table + modal patterns); real API calls.
   ========================================================= */

function roleBadgeClass(role) {
  switch (role) {
    case "super_admin": return "status-rejected";
    case "moderator": return "status-pending";
    case "coordinator": return "status-approved";
    default: return "";
  }
}

function roleLabel(role) {
  switch (role) {
    case "super_admin": return "Super Admin";
    case "moderator": return "Moderator";
    case "coordinator": return "Coordinator";
    default: return "Student";
  }
}

function userRowHtml(u) {
  const isSelf = getAuthState() && getAuthState().user_id === u.user_id;
  const roleBadge = `<span class="status-badge ${roleBadgeClass(u.role)}">${roleLabel(u.role)}</span>`;

  let actions = "";
  if (u.role === "student") {
    actions = `
      <button class="btn btn-secondary btn-sm" data-assign="${u.user_id}" data-role="coordinator">Assign Coordinator</button>
      <button class="btn btn-outline btn-sm" data-assign="${u.user_id}" data-role="moderator">Assign Moderator</button>`;
  } else if (u.role === "coordinator" || u.role === "moderator") {
    actions = `<button class="btn btn-danger btn-sm" data-revoke="${u.user_id}" ${isSelf ? "disabled title='You cannot revoke your own role'" : ""}>Revoke to Student</button>`;
  }
  if (u.role !== "super_admin") {
    actions += `<button class="btn btn-ghost btn-sm" data-resetpw="${u.user_id}">Reset Password</button>`;
  }

  return `
    <tr>
      <td data-label="Name">${escapeHtml(u.full_name)}${isSelf ? ' <span class="text-secondary">(you)</span>' : ""}</td>
      <td data-label="ID">${escapeHtml(u.display_id || "—")}</td>
      <td data-label="Email">${escapeHtml(u.email)}</td>
      <td data-label="School">${escapeHtml(u.school_name || "—")}</td>
      <td data-label="Role">${roleBadge}</td>
      <td data-label="Joined">${formatDate(u.created_at)}</td>
      <td data-label="Actions" class="actions-cell">${actions}</td>
    </tr>
  `;
}

async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  const search = document.getElementById("userSearch").value.trim();
  const role = document.getElementById("userRoleFilter").value;
  const params = new URLSearchParams({ page: usersPage, per_page: USERS_PER_PAGE });
  if (search) params.set("search", search);
  if (role) params.set("role", role);

  try {
    const data = await apiFetch(`/api/admin/users?${params}`).then(r => r.data);
    if (!data.users.length) {
      tbody.innerHTML = "";
      document.getElementById("usersEmpty").style.display = "block";
      document.querySelector(".table-wrap").style.display = "none";
      return;
    }
    document.getElementById("usersEmpty").style.display = "none";
    document.querySelector(".table-wrap").style.display = "";
    tbody.innerHTML = data.users.map(userRowHtml).join("");
    hydrateIcons(tbody);
  } catch (err) {
    handleAuthError(err);
  }
}

async function loadUserStats() {
  try {
    const s = await apiFetch("/api/admin/stats").then(r => r.data);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("statStudents", s.total_students ?? 0);
    set("statCoordinators", s.total_coordinators ?? 0);
    set("statModerators", s.total_moderators ?? 0);
    set("statOpenReports", s.pending_reports ?? 0);
  } catch (err) { /* stats are non-critical */ }
}

function openTempPwModal(data) {
  document.getElementById("tempPwUser").value = data.user_name || data.user?.full_name || "";
  document.getElementById("tempPwValue").value = data.temp_password;
  document.getElementById("tempPwExpiry").value = formatDate(data.expires_at) + " (24h)";
  document.getElementById("tempPwModal").classList.add("open");
}

function initUsersPage() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  const user = getAuthState();
  if (!user || user.role !== "super_admin") {
    document.querySelector(".table-wrap").style.display = "none";
    document.getElementById("userStats").style.display = "none";
    document.querySelector(".admin-toolbar").style.display = "none";
    const gate = document.getElementById("usersEmpty");
    gate.style.display = "block";
    gate.querySelector("h3").textContent = "Super admin only";
    gate.querySelector("p").textContent = "User management is restricted to the super admin.";
    return;
  }

  loadUserStats();
  loadUsers();

  /* Search + role filter (debounced search) */
  let searchTimer = null;
  document.getElementById("userSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { usersPage = 1; loadUsers(); }, 300);
  });
  document.getElementById("userRoleFilter").addEventListener("change", () => { usersPage = 1; loadUsers(); });

  /* Row actions (event delegation) */
  tbody.addEventListener("click", async (e) => {
    const assignBtn = e.target.closest("[data-assign]");
    if (assignBtn) {
      const uid = assignBtn.getAttribute("data-assign");
      const role = assignBtn.getAttribute("data-role");
      if (!confirm(`Assign the ${role} role to this user? They gain ${role === "coordinator" ? "upload" : "upload + moderation"} rights immediately.`)) return;
      try {
        const r = await apiFetch(`/api/admin/users/${uid}/assign-role`, { method: "POST", body: JSON.stringify({ role }) });
        showToast(r.message || "Role assigned.", "success");
        loadUsers(); loadUserStats();
      } catch (err) { showToast(err.message, "error"); }
      return;
    }

    const revokeBtn = e.target.closest("[data-revoke]");
    if (revokeBtn) {
      const uid = revokeBtn.getAttribute("data-revoke");
      if (!confirm("Revoke this user's staff role? They lose upload/moderation access immediately.")) return;
      try {
        const r = await apiFetch(`/api/admin/users/${uid}/revoke-role`, { method: "POST" });
        showToast(r.message || "Role revoked.", "success");
        loadUsers(); loadUserStats();
      } catch (err) { showToast(err.message, "error"); }
      return;
    }

    const resetBtn = e.target.closest("[data-resetpw]");
    if (resetBtn) {
      const uid = resetBtn.getAttribute("data-resetpw");
      if (!confirm("Generate a temporary password for this user? Their current password stops working.")) return;
      try {
        const r = await apiFetch(`/api/admin/users/${uid}/reset-password`, { method: "POST" });
        openTempPwModal(r.data);
      } catch (err) { showToast(err.message, "error"); }
    }
  });

  /* Add staff modal */
  const staffModal = document.getElementById("staffModal");
  document.getElementById("addStaffBtn").addEventListener("click", () => {
    populateSchoolSelect(document.getElementById("staffSchool"), false);
    staffModal.classList.add("open");
  });
  document.getElementById("staffModalClose").addEventListener("click", () => staffModal.classList.remove("open"));
  document.getElementById("staffModalCancel").addEventListener("click", () => staffModal.classList.remove("open"));

  document.getElementById("staffForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      full_name: document.getElementById("staffName").value,
      staff_id: document.getElementById("staffId").value,
      email: document.getElementById("staffEmail").value,
      role: document.getElementById("staffRole").value,
      school_id: Number(document.getElementById("staffSchool").value)
    };
    try {
      const r = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(payload) });
      staffModal.classList.remove("open");
      document.getElementById("staffForm").reset();
      openTempPwModal(r.data);
      loadUsers(); loadUserStats();
    } catch (err) { showToast(err.message, "error"); }
  });

  /* Temp password modal */
  document.getElementById("tempPwClose").addEventListener("click", () => document.getElementById("tempPwModal").classList.remove("open"));
  document.getElementById("tempPwDone").addEventListener("click", () => document.getElementById("tempPwModal").classList.remove("open"));
}

document.addEventListener("DOMContentLoaded", () => {
  initUsersPage();
});
