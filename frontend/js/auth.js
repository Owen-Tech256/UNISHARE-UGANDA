/* =========================================================
   UniShare Uganda — auth.js
   Login / Register form logic (frontend-only, fake auth)
   ========================================================= */

function wirePasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    btn.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
    btn.innerHTML = isPw
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-3.22 4.53M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
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
    error.classList.remove("show");
  }
}

function isValidInstitutionalEmail(value) {
  // simple realistic check: standard email shape, any domain accepted for demo
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/* ---------- Login page ---------- */

function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  wirePasswordToggle("loginPwToggle", "loginPassword");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const alertBox = document.getElementById("loginAlert");
    alertBox.classList.remove("show");

    let valid = true;
    if (!email.trim()) { setFieldError("loginEmail", "loginEmailError", "Email is required."); valid = false; }
    else setFieldError("loginEmail", "loginEmailError", "");
    if (!password) { setFieldError("loginPassword", "loginPasswordError", "Password is required."); valid = false; }
    else setFieldError("loginPassword", "loginPasswordError", "");

    if (!valid) return;

    // Demo rule: any password under 4 chars simulates an invalid login,
    // so the generic error state can be seen without a backend.
    if (password.length < 4) {
      alertBox.textContent = "Invalid email or password.";
      alertBox.classList.add("show");
      return;
    }

    const submitBtn = document.getElementById("loginSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    api.login(email, password).then((res) => {
      setAuthState(res.user);
      window.location.href = "index.html";
    });
  });
}

/* ---------- Register page ---------- */

function initRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  populateUniversitySelect(document.getElementById("regUniversity"), false);
  wirePasswordToggle("regPwToggle", "regPassword");
  wirePasswordToggle("regConfirmPwToggle", "regConfirmPassword");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;

    const name = document.getElementById("regName").value.trim();
    if (!name) { setFieldError("regName", "regNameError", "Full name is required."); valid = false; }
    else setFieldError("regName", "regNameError", "");

    const email = document.getElementById("regEmail").value.trim();
    if (!email) { setFieldError("regEmail", "regEmailError", "Institutional email is required."); valid = false; }
    else if (!isValidInstitutionalEmail(email)) { setFieldError("regEmail", "regEmailError", "Enter a valid email address."); valid = false; }
    else setFieldError("regEmail", "regEmailError", "");

    const university = document.getElementById("regUniversity").value;
    if (!university) { setFieldError("regUniversity", "regUniversityError", "Select your university."); valid = false; }
    else setFieldError("regUniversity", "regUniversityError", "");

    const password = document.getElementById("regPassword").value;
    if (!password || password.length < 8) { setFieldError("regPassword", "regPasswordError", "Password must be at least 8 characters."); valid = false; }
    else setFieldError("regPassword", "regPasswordError", "");

    const confirm = document.getElementById("regConfirmPassword").value;
    if (confirm !== password || !confirm) { setFieldError("regConfirmPassword", "regConfirmPasswordError", "Passwords do not match."); valid = false; }
    else setFieldError("regConfirmPassword", "regConfirmPasswordError", "");

    const course = document.getElementById("regCourse").value.trim();
    if (!course) { setFieldError("regCourse", "regCourseError", "Course of study is required."); valid = false; }
    else setFieldError("regCourse", "regCourseError", "");

    const year = document.getElementById("regYear").value;
    if (!year) { setFieldError("regYear", "regYearError", "Select your year of study."); valid = false; }
    else setFieldError("regYear", "regYearError", "");

    const terms = document.getElementById("regTerms").checked;
    const termsError = document.getElementById("regTermsError");
    if (!terms) { termsError.classList.add("show"); valid = false; } else { termsError.classList.remove("show"); }

    if (!valid) return;

    const submitBtn = document.getElementById("regSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    api.register({ name, email, university, password, course, year }).then(() => {
      setAuthState({ name, email });
      window.location.href = "index.html";
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  initRegisterForm();
});
