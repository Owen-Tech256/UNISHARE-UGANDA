/* ==========================================================================
   UniShare Uganda — auth.js
   Handles login.html and register.html: validation, mock session, redirects.
   ========================================================================== */

function wirePasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.textContent = isHidden ? "Hide" : "Show";
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* ---------------------------- Login ---------------------------- */

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  // Already logged in? Skip straight to browse.
  if (getCurrentUser()) {
    window.location.href = "browse.html";
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    let valid = true;

    if (!email) { setFieldError("login-email", "Enter your email address."); valid = false; }
    else if (!isValidEmail(email)) { setFieldError("login-email", "Enter a valid email address."); valid = false; }
    else setFieldError("login-email", "");

    if (!password) { setFieldError("login-password", "Enter your password."); valid = false; }
    else setFieldError("login-password", "");

    if (!valid) return;

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in…";

    setTimeout(() => {
      const user = findUserByEmail(email);
      if (!user || user.password !== password) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Log In";
        showToast("Incorrect email or password.", "error");
        setFieldError("login-password", "Incorrect email or password.");
        return;
      }
      setCurrentUser(user);
      showToast(`Welcome back, ${user.fullName.split(" ")[0]}!`, "success");
      setTimeout(() => { window.location.href = "browse.html"; }, 500);
    }, 500);
  });
}

/* ---------------------------- Register ---------------------------- */

function initRegisterPage() {
  const form = document.getElementById("register-form");
  if (!form) return;

  const uniSelect = document.getElementById("register-university");
  if (uniSelect) {
    uniSelect.innerHTML = `<option value="">Select your university</option>` +
      UNIVERSITIES.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valid = true;

    const fullName = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const university = document.getElementById("register-university").value;
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;
    const course = document.getElementById("register-course").value.trim();
    const year = document.getElementById("register-year").value;
    const agree = document.getElementById("register-agree").checked;

    if (!fullName) { setFieldError("register-name", "Enter your full name."); valid = false; }
    else setFieldError("register-name", "");

    if (!email) { setFieldError("register-email", "Enter your institutional email."); valid = false; }
    else if (!isValidEmail(email)) { setFieldError("register-email", "Enter a valid email address."); valid = false; }
    else if (findUserByEmail(email)) { setFieldError("register-email", "An account with this email already exists."); valid = false; }
    else setFieldError("register-email", "");

    if (!university) { setFieldError("register-university", "Select your university."); valid = false; }
    else setFieldError("register-university", "");

    if (!password || password.length < 8) { setFieldError("register-password", "Password must be at least 8 characters."); valid = false; }
    else setFieldError("register-password", "");

    if (confirmPassword !== password || !confirmPassword) { setFieldError("register-confirm-password", "Passwords do not match."); valid = false; }
    else setFieldError("register-confirm-password", "");

    if (!course) { setFieldError("register-course", "Enter your course of study."); valid = false; }
    else setFieldError("register-course", "");

    if (!year) { setFieldError("register-year", "Select your year of study."); valid = false; }
    else setFieldError("register-year", "");

    const agreeField = document.getElementById("register-agree").closest(".field");
    const agreeError = agreeField.querySelector(".error-msg");
    if (!agree) {
      agreeField.classList.add("has-error");
      agreeError.textContent = "You must agree to upload only original/accurate content.";
      valid = false;
    } else {
      agreeField.classList.remove("has-error");
      agreeError.textContent = "";
    }

    if (!valid) {
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account…";

    setTimeout(() => {
      const newUser = {
        id: uid("user"),
        fullName, email, university, password,
        course, year, role: "student",
        memberSince: new Date().toISOString().slice(0, 10)
      };
      const users = getAllUsers();
      users.push(newUser);
      writeJSON(LS_KEYS.users, users);

      document.getElementById("register-success").hidden = false;
      form.hidden = true;
      showToast("Account created — please log in.", "success");
      setTimeout(() => { window.location.href = "login.html"; }, 1400);
    }, 600);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wirePasswordToggles();
  initLoginPage();
  initRegisterPage();
});
