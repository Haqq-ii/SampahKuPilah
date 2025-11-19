/**
 * FORGOT PASSWORD FUNCTIONALITY
 * Handle forgot password form submission
 */

// Import password toggle utility (jika menggunakan module)
// import { initPasswordToggle } from './password-toggle.js';

// DOM Elements
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const emailResetInput = document.getElementById('emailReset');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

/**
 * Initialize forgot password page
 */
function initForgotPassword() {
  console.log('🔑 Forgot Password page initialized');
  
  // Add form submit listener
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', handleForgotPasswordSubmit);
  }
}

/**
 * Handle forgot password form submission
 * @param {Event} event - Form submit event
 */
async function handleForgotPasswordSubmit(event) {
  event.preventDefault();
  
  // Dapatkan email dari form
  const email = emailResetInput.value.trim();
  
  // Validasi email
  if (!email) {
    showError('Email tidak boleh kosong!');
    return;
  }
  
  if (!isValidEmail(email)) {
    showError('Format email tidak valid!');
    return;
  }
  
  // Hide previous messages
  hideMessages();
  
  // Disable form saat processing
  const submitButton = forgotPasswordForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
  
  try {
    // Simulasi API call untuk reset password
    // Dalam implementasi real, ganti dengan actual API endpoint
    const response = await sendResetPasswordEmail(email);
    
    if (response.success) {
      // Show success message
      showSuccess('Email reset password telah dikirim! Silakan cek inbox Anda.');
      
      // Reset form
      forgotPasswordForm.reset();
      
      // Optional: Redirect ke login setelah 3 detik
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    } else {
      showError(response.message || 'Email tidak terdaftar dalam sistem.');
    }
  } catch (error) {
    console.error('❌ Error sending reset email:', error);
    showError('Terjadi kesalahan. Silakan coba lagi nanti.');
  } finally {
    // Re-enable form
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
  }
}

/**
 * Send reset password email (Simulasi - ganti dengan real API)
 * @param {string} email - User email
 * @returns {Promise<Object>} Response object
 */
async function sendResetPasswordEmail(email) {
  // Simulasi delay API call
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulasi response
  // Dalam implementasi real, ganti dengan actual fetch ke backend
  
  // Check if email exists in users (untuk demo purposes)
  const usersResponse = await fetch('/api/users/check-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  }).catch(() => {
    // Jika API belum ready, return success untuk demo
    return { ok: true, json: async () => ({ exists: true }) };
  });
  
  if (usersResponse.ok) {
    const data = await usersResponse.json();
    
    if (data.exists) {
      // Email exists, send reset link
      return {
        success: true,
        message: 'Reset password email sent successfully'
      };
    } else {
      // Email tidak terdaftar
      return {
        success: false,
        message: 'Email tidak terdaftar dalam sistem kami.'
      };
    }
  }
  
  // Default success untuk demo
  return {
    success: true,
    message: 'Reset password email sent successfully'
  };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  hideMessages();
  
  if (successMessage) {
    const messageText = successMessage.querySelector('p');
    if (messageText) {
      messageText.textContent = message;
    }
    successMessage.classList.remove('hidden');
    
    // Scroll to message
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  console.log('✅ Success:', message);
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  hideMessages();
  
  if (errorMessage && errorText) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // Scroll to message
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Shake animation untuk error
    errorMessage.style.animation = 'shake 0.5s';
    setTimeout(() => {
      errorMessage.style.animation = '';
    }, 500);
  }
  
  console.error('❌ Error:', message);
}

/**
 * Hide all messages
 */
function hideMessages() {
  if (successMessage) {
    successMessage.classList.add('hidden');
  }
  if (errorMessage) {
    errorMessage.classList.add('hidden');
  }
}

/**
 * Add shake animation to CSS (jika belum ada)
 */
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

// Initialize saat DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initForgotPassword);
} else {
  initForgotPassword();
}


