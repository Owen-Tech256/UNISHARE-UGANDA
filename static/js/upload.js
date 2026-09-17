/* =========================================================
   UniShare Uganda - upload.js (live app)
   Design from frontend/js/upload.js; real FormData POST.
   ========================================================= */

const ACCEPTED_EXT = ["pdf", "docx", "pptx", "jpg", "jpeg", "png"];
const MAX_FILE_MB = 16;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fileExtension(name) {
  return name.split(".").pop().toLowerCase();
}

function initUploadPage() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  // Gated page: must be logged in. Coordinators only get the real form.
  if (!getAuthState()) {
    window.location.href = "/login.html";
    return;
  }

  const roleNotice = document.getElementById("roleNotice");
  const user = getAuthState();
  if (user.role !== "coordinator") {
    // Show an explanatory gate instead of the form
    if (roleNotice) {
      roleNotice.style.display = "block";
      document.getElementById("uploadFormWrap").style.display = "none";
    }
    return;
  }

  populateSchoolSelect(document.getElementById("upSchool"), false);
  document.getElementById("upSchool").value = user.school_id;

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileChip = document.getElementById("fileChip");
  const dzFileError = document.getElementById("dzFileError");
  let selectedFile = null;

  function handleFiles(files) {
    dzFileError.classList.remove("show");
    if (!files || !files.length) return;
    const file = files[0];
    const ext = fileExtension(file.name);

    if (!ACCEPTED_EXT.includes(ext)) {
      dzFileError.textContent = "Unsupported file type. Please upload PDF, DOCX, PPTX, JPG or PNG.";
      dzFileError.classList.add("show");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1e6) {
      dzFileError.textContent = `File is too large. Maximum size is ${MAX_FILE_MB} MB.`;
      dzFileError.classList.add("show");
      return;
    }

    selectedFile = file;
    fileChip.style.display = "flex";
    fileChip.querySelector(".file-chip-name").textContent = file.name;
    fileChip.querySelector(".file-chip-size").textContent = `${ext.toUpperCase()} · ${formatBytes(file.size)}`;
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  ["dragenter", "dragover"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); });
  });
  dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  document.getElementById("fileChipRemove").addEventListener("click", (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = "";
    fileChip.style.display = "none";
  });

  /* ---------- Duplicate check (server-backed) ---------- */

  const duplicateNotice = document.getElementById("duplicateNotice");
  let dupTimeout;

  async function checkDuplicate() {
    const code = document.getElementById("upCourseCode").value.trim();
    const year = document.getElementById("upYear").value;
    const semester = document.getElementById("upSemester").value;
    const type = document.getElementById("upType").value;
    if (!code || !year || !semester || !type) { duplicateNotice.style.display = "none"; return; }

    try {
      const res = await apiFetch("/api/uploads/check-duplicate", {
        method: "POST",
        body: JSON.stringify({ course_code: code, academic_year: year, semester, resource_type: type })
      });
      duplicateNotice.style.display = res.data.count > 0 ? "flex" : "none";
    } catch (e) {
      duplicateNotice.style.display = "none"; // never block the form on check failure
    }
  }

  ["upCourseCode", "upYear", "upSemester", "upType"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => { clearTimeout(dupTimeout); dupTimeout = setTimeout(checkDuplicate, 500); });
    document.getElementById(id).addEventListener("blur", checkDuplicate);
  });

  document.getElementById("viewExistingBtn")?.addEventListener("click", () => {
    const code = document.getElementById("upCourseCode").value.trim();
    window.location.href = `/browse.html?course_code=${encodeURIComponent(code)}`;
  });

  /* ---------- Submit ---------- */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    const required = [
      ["upSchool", "upSchoolError", "Select your school."],
      ["upCourseCode", "upCourseCodeError", "Course code is required."],
      ["upCourseName", "upCourseNameError", "Course name is required."],
      ["upLecturer", "upLecturerError", "Lecturer name is required."],
      ["upYear", "upYearError", "Select an academic year."],
      ["upSemester", "upSemesterError", "Select a semester."],
      ["upType", "upTypeError", "Select a resource type."],
      ["upTitle", "upTitleError", "Title is required."]
    ];
    required.forEach(([inputId, errId, msg]) => {
      const val = document.getElementById(inputId).value.trim();
      setFieldError(inputId, errId, val ? "" : msg);
      if (!val) valid = false;
    });

    if (!selectedFile) {
      dzFileError.textContent = "Please select a file to upload.";
      dzFileError.classList.add("show");
      valid = false;
    }

    const confirmBox = document.getElementById("upConfirm");
    const confirmError = document.getElementById("upConfirmError");
    if (!confirmBox.checked) { confirmError.classList.add("show"); valid = false; }
    else confirmError.classList.remove("show");

    if (!valid) { showToast("Please fix the highlighted fields.", "error"); return; }

    const submitBtn = document.getElementById("uploadSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const formData = new FormData();
    formData.append("title", document.getElementById("upTitle").value);
    formData.append("course_code", document.getElementById("upCourseCode").value);
    formData.append("course_name", document.getElementById("upCourseName").value);
    formData.append("lecturer_name", document.getElementById("upLecturer").value);
    formData.append("academic_year", document.getElementById("upYear").value);
    formData.append("semester", document.getElementById("upSemester").value);
    formData.append("resource_type", document.getElementById("upType").value);
    formData.append("description", document.getElementById("upDescription").value);
    formData.append("file", selectedFile);

    try {
      await apiFetch("/api/uploads", { method: "POST", body: formData });
      showToast("Submitted - pending moderation review.", "success");
      document.getElementById("uploadFormWrap").style.display = "none";
      document.getElementById("uploadSuccess").style.display = "block";
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Resource";
      showToast(err.message || "Upload failed.", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", initUploadPage);
