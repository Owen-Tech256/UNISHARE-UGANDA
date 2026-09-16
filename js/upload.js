/* ==========================================================================
   UniShare Uganda - upload.js
   Handles the resource upload form on upload.html. Frontend-only: nothing
   is actually uploaded - the "file" is just remembered by name/size/type.
   ========================================================================== */

const ALLOWED_EXTENSIONS = ["pdf", "docx", "pptx", "jpg", "jpeg", "png"];
let selectedFile = null;
let selectedCourse = null;

function requireAuthOrRedirect() {
  if (!getCurrentUser()) {
    showToast("Please log in to upload a resource.", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 900);
    return false;
  }
  return true;
}

function populateUploadFormOptions() {
  document.getElementById("upload-university").innerHTML =
    `<option value="">Select university</option>` +
    UNIVERSITIES.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");

  document.getElementById("upload-year").innerHTML =
    `<option value="">Select year</option>` +
    ACADEMIC_YEARS.slice().reverse().map((y) => `<option value="${y}">${y}</option>`).join("");

  document.getElementById("upload-semester").innerHTML =
    `<option value="">Select semester</option>` +
    SEMESTERS.map((s) => `<option value="${s}">${s}</option>`).join("");

  document.getElementById("upload-type").innerHTML =
    `<option value="">Select type</option>` +
    RESOURCE_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
}

/* ---------------------------- Autocomplete (course + lecturer) ---------------------------- */

function wireAutocomplete(inputId, listId, dataset, onPick) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  function renderOptions(matches) {
    if (!matches.length) { list.classList.remove("open"); list.innerHTML = ""; return; }
    list.innerHTML = matches.slice(0, 6).map((item, i) => {
      const label = typeof item === "string" ? item : `${item.code} - ${item.name}`;
      return `<button type="button" data-index="${i}">${escapeHtml(label)}</button>`;
    }).join("");
    list.classList.add("open");
    list.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        onPick(matches[Number(btn.dataset.index)]);
        list.classList.remove("open");
      });
    });
  }

  input.addEventListener("input", debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.classList.remove("open"); return; }
    const matches = dataset.filter((item) => {
      const label = typeof item === "string" ? item : `${item.code} ${item.name}`;
      return label.toLowerCase().includes(q);
    });
    renderOptions(matches);
  }, 180));

  input.addEventListener("blur", () => {
    setTimeout(() => list.classList.remove("open"), 150);
  });
}

function initCourseAutocomplete() {
  wireAutocomplete("upload-course-code", "course-autocomplete-list", COURSES, (course) => {
    selectedCourse = course;
    document.getElementById("upload-course-code").value = course.code;
    document.getElementById("upload-course-name").value = course.name;
    checkForDuplicates();
  });
}

function initLecturerAutocomplete() {
  wireAutocomplete("upload-lecturer", "lecturer-autocomplete-list", LECTURERS, (name) => {
    document.getElementById("upload-lecturer").value = name;
  });
}

/* ---------------------------- Duplicate detection (mock) ---------------------------- */

function checkForDuplicates() {
  const courseCode = document.getElementById("upload-course-code").value.trim().toLowerCase();
  const type = document.getElementById("upload-type").value;
  const warning = document.getElementById("duplicate-warning");
  if (!courseCode || !type) { warning.hidden = true; return; }

  const matches = getAllResources().filter(
    (r) => r.courseCode.toLowerCase() === courseCode && r.type === type
  );

  if (matches.length > 0) {
    warning.hidden = false;
    document.getElementById("duplicate-view-link").href =
      `browse.html?q=${encodeURIComponent(courseCode)}&type=${encodeURIComponent(type)}`;
  } else {
    warning.hidden = true;
  }
}

/* ---------------------------- File upload / drag & drop ---------------------------- */

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name) {
  return name.split(".").pop().toLowerCase();
}

function handleFileSelection(file) {
  const errorEl = document.getElementById("file-error");
  if (!file) return;
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errorEl.textContent = "Unsupported file type. Please choose a PDF, DOCX, PPTX, JPG, or PNG file.";
    errorEl.style.display = "block";
    return;
  }
  errorEl.style.display = "none";
  selectedFile = file;

  document.getElementById("dropzone").hidden = true;
  const chip = document.getElementById("file-chip");
  chip.hidden = false;
  chip.querySelector(".file-chip-name").textContent = file.name;
  chip.querySelector(".file-chip-meta").textContent = `${ext.toUpperCase()} · ${formatFileSize(file.size)}`;
}

function initDropzone() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const chip = document.getElementById("file-chip");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); });
  });
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFileSelection(e.target.files[0]);
  });

  chip.querySelector(".remove-file-btn").addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    chip.hidden = true;
    dropzone.hidden = false;
  });
}

/* ---------------------------- Validation + submit ---------------------------- */

function validateUploadForm() {
  let valid = true;
  const requiredFields = [
    ["upload-university", "Select a university."],
    ["upload-course-code", "Enter a course code."],
    ["upload-course-name", "Enter the course name."],
    ["upload-lecturer", "Enter the lecturer's name."],
    ["upload-year", "Select the academic year."],
    ["upload-semester", "Select the semester."],
    ["upload-type", "Select a resource type."],
    ["upload-title", "Give this resource a title."]
  ];

  requiredFields.forEach(([id, message]) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { setFieldError(id, message); valid = false; }
    else setFieldError(id, "");
  });

  if (!selectedFile) {
    document.getElementById("file-error").textContent = "Please attach a file.";
    document.getElementById("file-error").style.display = "block";
    valid = false;
  }

  const confirmBox = document.getElementById("upload-confirm");
  const confirmField = confirmBox.closest(".field");
  if (!confirmBox.checked) {
    confirmField.classList.add("has-error");
    confirmField.querySelector(".error-msg").textContent = "You must confirm this content is accurate and yours to share.";
    valid = false;
  } else {
    confirmField.classList.remove("has-error");
  }

  return valid;
}

function initUploadForm() {
  const form = document.getElementById("upload-form");
  if (!form) return;
  if (!requireAuthOrRedirect()) return;

  populateUploadFormOptions();
  initCourseAutocomplete();
  initLecturerAutocomplete();
  initDropzone();

  document.getElementById("upload-course-code").addEventListener("blur", checkForDuplicates);
  document.getElementById("upload-type").addEventListener("change", checkForDuplicates);

  let submitting = false;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateUploadForm()) {
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    submitting = true;
    const submitBtn = document.getElementById("upload-submit-btn");
    submitBtn.disabled = true;
    submitBtn.classList.add("loader-dots");
    submitBtn.textContent = "Submitting";

    setTimeout(() => {
      const user = getCurrentUser();
      const type = document.getElementById("upload-type").value;
      const resource = {
        id: uid("upload"),
        title: document.getElementById("upload-title").value.trim(),
        description: document.getElementById("upload-description").value.trim(),
        courseCode: document.getElementById("upload-course-code").value.trim().toUpperCase(),
        courseName: document.getElementById("upload-course-name").value.trim(),
        university: document.getElementById("upload-university").value,
        lecturer: document.getElementById("upload-lecturer").value.trim(),
        academicYear: document.getElementById("upload-year").value,
        semester: document.getElementById("upload-semester").value,
        type,
        uploader: user.fullName,
        uploaderId: user.id,
        upvotes: 0,
        status: "pending",
        approved: false,
        uploadDate: new Date().toISOString(),
        fileType: fileExtension(selectedFile.name).toUpperCase(),
        fileSize: formatFileSize(selectedFile.size),
        fileName: selectedFile.name
      };

      const uploads = getUserUploads();
      uploads.unshift(resource);
      writeJSON(LS_KEYS.uploads, uploads);

      form.hidden = true;
      document.getElementById("upload-success").hidden = false;
    }, 900);
  });
}

document.addEventListener("DOMContentLoaded", initUploadForm);
