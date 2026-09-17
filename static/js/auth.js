/* =========================================================
   UniShare Uganda - auth.js (live app)
   Login / Register / force-change logic.
   Design pattern from frontend/js/auth.js; backend calls real.
   ========================================================= */

function wirePasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  const eyeSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeOffSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-3.22 4.53M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  btn.innerHTML = eyeSvg;
  btn.addEventListener("click", () => {
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    btn.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
    btn.innerHTML = isPw ? eyeOffSvg : eyeSvg;
  });
}

function setFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (!input || !error) return;
  if (message) {
    input.classList.add("has-error");
    error.textContent = message;
    error.classList.add("show");
  } else {
    input.classList.remove("has-error");
    error.textContent = "";
    error.classList.remove("show");
  }
}

function isValidInstitutionalEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function isValidStudentNumber(value) {
  return /^\d{10}$/.test(value.trim());
}

/* ---------- Login page ---------- */

function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  wirePasswordToggle("loginPwToggle", "loginPassword");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById("loginAlert");
    alertBox.classList.remove("show");

    const identifier = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    let valid = true;
    if (!identifier.trim()) { setFieldError("loginEmail", "loginEmailError", "Enter your student number, staff ID, or email."); valid = false; }
    else setFieldError("loginEmail", "loginEmailError", "");
    if (!password) { setFieldError("loginPassword", "loginPasswordError", "Password is required."); valid = false; }
    else setFieldError("loginPassword", "loginPasswordError", "");
    if (!valid) return;

    const submitBtn = document.getElementById("loginSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      const res = await api.login(identifier, password);
      showToast("Login successful. Redirecting…", "success");
      if (res.data.must_change_password) {
        openForceChangeModal();
        return; // redirect happens after the password change
      }
      setTimeout(() => { window.location.href = res.data.redirect_url; }, 400);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
      alertBox.textContent = err.message || "Invalid email or password.";
      alertBox.classList.add("show");
    }
  });
}

/* ---------- Register page ---------- */

function initRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  wirePasswordToggle("regPwToggle", "regPassword");
  wirePasswordToggle("regConfirmPwToggle", "regConfirmPassword");

  populateSchoolSelect(document.getElementById("regSchool"), false);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    const name = document.getElementById("regName").value.trim();
    if (!name || name.length < 3) { setFieldError("regName", "regNameError", "Full name must be at least 3 characters."); valid = false; }
    else setFieldError("regName", "regNameError", "");

    const studentNumber = document.getElementById("regStudentNumber").value.trim();
    if (!isValidStudentNumber(studentNumber)) { setFieldError("regStudentNumber", "regStudentNumberError", "Student Number must contain exactly 10 digits."); valid = false; }
    else setFieldError("regStudentNumber", "regStudentNumberError", "");

    const email = document.getElementById("regEmail").value.trim();
    if (!email) { setFieldError("regEmail", "regEmailError", "Institutional email is required."); valid = false; }
    else if (!isValidInstitutionalEmail(email)) { setFieldError("regEmail", "regEmailError", "Enter a valid email address."); valid = false; }
    else setFieldError("regEmail", "regEmailError", "");

    const schoolId = document.getElementById("regSchool").value;
    if (!schoolId) { setFieldError("regSchool", "regSchoolError", "Select your school."); valid = false; }
    else setFieldError("regSchool", "regSchoolError", "");

    const password = document.getElementById("regPassword").value;
    if (!password || password.length < 8) { setFieldError("regPassword", "regPasswordError", "Password must be at least 8 characters."); valid = false; }
    else setFieldError("regPassword", "regPasswordError", "");

    const confirm = document.getElementById("regConfirmPassword").value;
    if (confirm !== password || !confirm) { setFieldError("regConfirmPassword", "regConfirmPasswordError", "Passwords do not match."); valid = false; }
    else setFieldError("regConfirmPassword", "regConfirmPasswordError", "");

    const terms = document.getElementById("regTerms").checked;
    const termsError = document.getElementById("regTermsError");
    if (!terms) { termsError.classList.add("show"); valid = false; } else { termsError.classList.remove("show"); }

    if (!valid) { showToast("Please fix the highlighted fields.", "error"); return; }

    const submitBtn = document.getElementById("regSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    try {
      const res = await api.register({
        full_name: name,
        student_number: studentNumber,
        email,
        school_id: Number(schoolId),
        password,
        confirm_password: confirm
      });
      showToast("Account created - you are now signed in.", "success");
      setTimeout(() => { window.location.href = res.data.redirect_url; }, 800);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
      const msg = err.message || "Registration failed.";
      if (msg.toLowerCase().includes("student number")) {
        setFieldError("regStudentNumber", "regStudentNumberError", msg);
      } else if (msg.toLowerCase().includes("email")) {
        setFieldError("regEmail", "regEmailError", msg);
      } else {
        showToast(msg, "error");
      }
    }
  });
}

/* ---------- Forced password change (temp-password users) ---------- */

function openForceChangeModal() {
  const modal = document.getElementById("forceChangeModal");
  if (modal) modal.classList.add("open");
}

function initForceChangeForm() {
  const form = document.getElementById("forceChangeForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("fcNewPassword").value;
    const confirmPassword = document.getElementById("fcConfirmPassword").value;

    if (newPassword.length < 8) { showToast("New password must be at least 8 characters.", "error"); return; }
    if (newPassword !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }

    try {
      await apiFetch("/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: "", new_password: newPassword, confirm_password: confirmPassword })
      });
      showToast("Password changed successfully!", "success");
      setTimeout(() => { window.location.href = "/index.html"; }, 600);
    } catch (err) {
      showToast(err.message || "Failed to update password.", "error");
    }
  });
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  initRegisterForm();
  initForceChangeForm();
});
