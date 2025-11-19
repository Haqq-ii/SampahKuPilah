/**
 * Password Validator - Validasi password strength
 * Requirements:
 * - Minimal 8 karakter
 * - Harus ada huruf besar (uppercase)
 * - Harus ada huruf kecil (lowercase)
 * - Harus ada angka
 * - Opsional: simbol (untuk password yang lebih kuat)
 */

class PasswordValidator {
  constructor() {
    this.minLength = 8;
    this.requireUppercase = true;
    this.requireLowercase = true;
    this.requireNumber = true;
    this.requireSymbol = false; // Opsional, bisa diaktifkan untuk password lebih kuat
  }

  /**
   * Validasi password strength
   * @param {string} password - Password yang akan divalidasi
   * @returns {Object} { valid: boolean, errors: string[], strength: string }
   */
  validate(password) {
    const errors = [];
    let strength = "weak";

    if (!password || typeof password !== "string") {
      return {
        valid: false,
        errors: ["Password wajib diisi"],
        strength: "weak",
      };
    }

    // Check length
    if (password.length < this.minLength) {
      errors.push(`Password minimal ${this.minLength} karakter`);
    }

    // Check uppercase
    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("Password harus mengandung huruf besar (A-Z)");
    }

    // Check lowercase
    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push("Password harus mengandung huruf kecil (a-z)");
    }

    // Check number
    if (this.requireNumber && !/[0-9]/.test(password)) {
      errors.push("Password harus mengandung angka (0-9)");
    }

    // Check symbol (optional)
    if (this.requireSymbol && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password harus mengandung simbol (!@#$%^&*)");
    }

    // Calculate strength
    if (errors.length === 0) {
      if (password.length >= 12 && this.hasSymbol(password)) {
        strength = "very-strong";
      } else if (password.length >= 10) {
        strength = "strong";
      } else {
        strength = "medium";
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Check if password has symbol
   */
  hasSymbol(password) {
    return /[!@#$%^&*(),.?":{}|<>]/.test(password);
  }

  /**
   * Get strength indicator (0-4)
   * 0 = very weak, 4 = very strong
   */
  getStrengthScore(password) {
    if (!password) return 0;

    let score = 0;

    // Length
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character types
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    // Cap at 4
    return Math.min(score, 4);
  }

  /**
   * Get strength label
   */
  getStrengthLabel(score) {
    if (score === 0) return { label: "Sangat Lemah", color: "#f44336" };
    if (score === 1) return { label: "Lemah", color: "#ff9800" };
    if (score === 2) return { label: "Sedang", color: "#ffc107" };
    if (score === 3) return { label: "Kuat", color: "#4caf50" };
    return { label: "Sangat Kuat", color: "#2e7d32" };
  }
}

// Email validator
class EmailValidator {
  /**
   * Validasi email format
   * @param {string} email - Email yang akan divalidasi
   * @returns {Object} { valid: boolean, error: string }
   */
  validate(email) {
    if (!email || typeof email !== "string") {
      return {
        valid: false,
        error: "Email wajib diisi",
      };
    }

    const trimmed = email.trim().toLowerCase();

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return {
        valid: false,
        error: "Format email tidak valid",
      };
    }

    // Check length
    if (trimmed.length > 254) {
      return {
        valid: false,
        error: "Email terlalu panjang (maksimal 254 karakter)",
      };
    }

    // Check local part (before @)
    const [localPart, domain] = trimmed.split("@");
    if (localPart.length > 64) {
      return {
        valid: false,
        error: "Bagian sebelum @ terlalu panjang",
      };
    }

    // Check for common invalid patterns
    if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
      return {
        valid: false,
        error: "Email tidak boleh dimulai atau diakhiri dengan titik",
      };
    }

    if (trimmed.includes("..")) {
      return {
        valid: false,
        error: "Email tidak boleh mengandung titik berturut-turut",
      };
    }

    return {
      valid: true,
      error: null,
    };
  }
}

// Export untuk global access
window.PasswordValidator = PasswordValidator;
window.EmailValidator = EmailValidator;

// Create global instances
window.passwordValidator = new PasswordValidator();
window.emailValidator = new EmailValidator();

