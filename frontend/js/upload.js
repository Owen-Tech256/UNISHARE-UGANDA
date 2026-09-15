/* =========================================================
   UniShare Uganda — upload.js
   ========================================================= */

const ACCEPTED_EXT = ["pdf", "docx", "pptx", "jpg", "jpeg", "png"];
const MAX_FILE_MB = 20;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function initUploadPage() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  if (!requireAuth("login.html")) return;

  populateUniversitySelect(document.getElementById("upUniversity"), false);

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileChip = document.getElementById("fileChip");
  const dzFileError = document.getElementById("dzFileError");
  let selectedFile = null;

  function handleFiles(files) {
    dzFileError.classList.remove("show");
    if (!files || !files.length) return;
    const file = files[0];
    const ext = file.name.split(".").pop().toLowerCase();

    if (!ACCEPTED_EXT.includes(ext)) {
      dzFileError.textContent = "Unsupported file type. Please upload PDF, DOCX, PPTX, JPG or PNG.";
      dzFileError.classList.add("show");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      dzFileError.textContent = `File is too large. Maximum size is ${MAX_FILE_MB} MB.`;
      dzFileError.classList.add("show");
      return;
    }

    selectedFile = file;
    fileChip.style.display = "flex";
    fileChip.querySelector(".file-chip-name").textContent = file.name;
    fileChip.querySelector(".file-chip-size").textContent = formatBytes(file.size);
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

  /* Duplicate check simulation */
  const duplicateNotice = document.getElementById("duplicateNotice");
  function checkDuplicate() {
    const code = document.getElementById("upCourseCode").value.trim().toUpperCase();
    const year = document.getElementById("upYear").value;
    const semester = document.getElementById("upSemester").value;
    const type = document.getElementById("upType").value;
    if (!code || !year || !semester || !type) { duplicateNotice.style.display = "none"; return; }

    const match = RESOURCES.find(r =>
      r.course_code.toUpperCase() === code && r.year === year && r.semester === semester && r.type === type
    );
    duplicateNotice.style.display = match ? "flex" : "none";
  }
  ["upCourseCode", "upYear", "upSemester", "upType"].forEach(id => {
    document.getElementById(id).addEventListener("change", checkDuplicate);
    document.getElementById(id).addEventListener("blur", checkDuplicate);
  });
  document.getElementById("viewExistingBtn")?.addEventListener("click", () => {
    const code = document.getElementById("upCourseCode").value.trim();
    window.location.href = `browse.html?q=${encodeURIComponent(code)}`;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;
    const required = [
      ["upUniversity", "upUniversityError", "Select a university."],
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

    if (!valid) return;

    const submitBtn = document.getElementById("uploadSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    api.submitResource({
      university: document.getElementById("upUniversity").value,
      course_code: document.getElementById("upCourseCode").value,
      title: document.getElementById("upTitle").value,
      file_name: selectedFile.name
    }).then(() => {
      document.getElementById("uploadFormWrap").style.display = "none";
      document.getElementById("uploadSuccess").style.display = "block";
    });
  });
}

document.addEventListener("DOMContentLoaded", initUploadPage);
