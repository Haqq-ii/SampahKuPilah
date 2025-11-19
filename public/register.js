const USER_STORAGE_KEY = "sampahKuPilahUser";

function persistUserSession(profile) {
  if (!profile || !profile.email) return;
  const normalized = {
    email: profile.email,
    name: profile.name || profile.email.split("@")[0],
    picture: profile.picture || null
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
}

// Initialize validators (akan di-load dari password-validator.js)
let passwordValidator, emailValidator;
if (window.passwordValidator && window.emailValidator) {
  passwordValidator = window.passwordValidator;
  emailValidator = window.emailValidator;
}

const registerForm = document.getElementById("registerForm");

// Initialize password strength indicator
function initPasswordStrengthIndicator() {
  const passwordInput = document.getElementById("password");
  const strengthIndicator = document.getElementById("passwordStrength");
  const strengthFill = document.getElementById("strengthFill");
  const strengthText = document.getElementById("strengthText");
  const requirements = {
    length: document.getElementById("req-length"),
    uppercase: document.getElementById("req-uppercase"),
    lowercase: document.getElementById("req-lowercase"),
    number: document.getElementById("req-number"),
  };

  if (!passwordInput || !strengthIndicator) return;

  passwordInput.addEventListener("input", () => {
    const password = passwordInput.value;

    if (password.length === 0) {
      strengthIndicator.style.display = "none";
      return;
    }

    strengthIndicator.style.display = "block";

    // Check requirements
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    };

    // Update requirement indicators
    Object.keys(requirements).forEach((key) => {
      const element = requirements[key];
      if (element) {
        if (checks[key]) {
          element.classList.add("valid");
          element.classList.remove("invalid");
        } else {
          element.classList.add("invalid");
          element.classList.remove("valid");
        }
      }
    });

    // Calculate strength
    if (passwordValidator) {
      const score = passwordValidator.getStrengthScore(password);
      const label = passwordValidator.getStrengthLabel(score);

      strengthFill.className = "strength-fill";
      if (score === 0 || score === 1) {
        strengthFill.classList.add("weak");
      } else if (score === 2) {
        strengthFill.classList.add("medium");
      } else if (score === 3) {
        strengthFill.classList.add("strong");
      } else {
        strengthFill.classList.add("very-strong");
      }

      strengthFill.style.width = `${(score / 4) * 100}%`;
      strengthText.textContent = `Kekuatan: ${label.label}`;
      strengthText.style.color = label.color;
    } else {
      // Fallback calculation
      let score = 0;
      if (password.length >= 8) score++;
      if (checks.uppercase) score++;
      if (checks.lowercase) score++;
      if (checks.number) score++;

      const percentage = (score / 4) * 100;
      strengthFill.style.width = `${percentage}%`;

      if (score <= 1) {
        strengthFill.className = "strength-fill weak";
        strengthText.textContent = "Kekuatan: Lemah";
        strengthText.style.color = "#f44336";
      } else if (score === 2) {
        strengthFill.className = "strength-fill medium";
        strengthText.textContent = "Kekuatan: Sedang";
        strengthText.style.color = "#ff9800";
      } else if (score === 3) {
        strengthFill.className = "strength-fill strong";
        strengthText.textContent = "Kekuatan: Kuat";
        strengthText.style.color = "#4caf50";
      } else {
        strengthFill.className = "strength-fill very-strong";
        strengthText.textContent = "Kekuatan: Sangat Kuat";
        strengthText.style.color = "#2e7d32";
      }
    }
  });
}

if (registerForm) {
  // Initialize password strength indicator
  initPasswordStrengthIndicator();

  // Jika ingin: blokir pendaftaran saat sudah login (opsional)
  // const existingSession = localStorage.getItem(USER_STORAGE_KEY);
  // if (existingSession) { window.location.href = 'index.html'; return; }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    const email = (emailInput.value || "").trim().toLowerCase();
    const password = passwordInput.value || "";
    const confirm = confirmPasswordInput.value || "";

    // ✅ Validasi Email (dengan EmailValidator jika tersedia)
    let emailValidation;
    if (emailValidator) {
      emailValidation = emailValidator.validate(email);
    } else {
      // Fallback validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      emailValidation = {
        valid: email && emailRegex.test(email),
        error: !email ? "Email wajib diisi!" : !emailRegex.test(email) ? "Format email tidak valid!" : null,
      };
    }

    if (!emailValidation.valid) {
      if (window.notification) {
        window.notification.error(emailValidation.error || "Email tidak valid!");
      } else {
        alert(emailValidation.error || "Email tidak valid!");
      }
      emailInput.focus();
      return;
    }

    // ✅ Validasi Password (dengan PasswordValidator jika tersedia)
    let passwordValidation;
    if (passwordValidator) {
      passwordValidation = passwordValidator.validate(password);
    } else {
      // Fallback validation - minimal 8 karakter
      passwordValidation = {
        valid: password.length >= 8,
        errors: password.length < 8 ? ["Password minimal 8 karakter"] : [],
      };
    }

    if (!passwordValidation.valid) {
      const errorMessage = passwordValidation.errors.join(", ");
      if (window.notification) {
        window.notification.error(errorMessage);
      } else {
        alert(errorMessage);
      }
      passwordInput.focus();
      return;
    }

    // ✅ Validasi Konfirmasi Password
    if (password !== confirm) {
      if (window.notification) {
        window.notification.error("Password dan konfirmasi tidak cocok!");
      } else {
        alert("Password dan konfirmasi tidak cocok!");
      }
      confirmPasswordInput.focus();
      return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendaftar...';

    try {
      const res = await fetch("/register", {
        // ⬅️ pakai alias yang disiapkan server
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data = {};
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => ({}));
      } else if (res.redirected) {
        // Jika server membalas redirect (mode form), anggap sukses
        window.location.href = res.url || "login.html";
        return;
      }

      if (res.ok && (data.ok ?? true)) {
        if (window.notification) {
          window.notification.success("Pendaftaran berhasil! Mengalihkan ke halaman login...");
        } else {
          alert("Pendaftaran berhasil! Silakan login dengan akun yang baru dibuat.");
        }
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1000);
      } else {
        if (window.notification) {
          window.notification.error(data.message || "Terjadi kesalahan saat mendaftar");
        } else {
          alert(data.message || "Terjadi kesalahan saat mendaftar");
        }
      }
    } catch (err) {
      console.error("Registration error:", err);
      if (window.notification) {
        window.notification.error("Terjadi kesalahan server. Silakan coba lagi.");
      } else {
        alert("Terjadi kesalahan server. Silakan coba lagi.");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}
