/**
 * PASSWORD TOGGLE UTILITY
 * Fungsi untuk show/hide password dengan animasi smooth
 * 
 * Cara penggunaan:
 * 1. Tambahkan struktur HTML:
 *    <div class="password-wrapper">
 *      <input type="password" id="yourPasswordId">
 *      <button type="button" class="toggle-password">
 *        <i class="fas fa-eye"></i>
 *      </button>
 *    </div>
 * 
 * 2. Panggil initPasswordToggle() setelah DOM loaded
 */

/**
 * Inisialisasi semua toggle password di halaman
 */
function initPasswordToggle() {
  // Dapatkan semua tombol toggle password
  const toggleButtons = document.querySelectorAll('.toggle-password');
  
  // Loop setiap tombol dan attach event listener
  toggleButtons.forEach(button => {
    button.addEventListener('click', function() {
      togglePasswordVisibility(this);
    });
  });
  
  console.log(`✅ Password toggle initialized: ${toggleButtons.length} toggle(s) found`);
}

/**
 * Toggle visibility password untuk satu input
 * @param {HTMLElement} button - Tombol toggle yang diklik
 */
function togglePasswordVisibility(button) {
  // Dapatkan password wrapper (parent dari button)
  const passwordWrapper = button.closest('.password-wrapper');
  
  if (!passwordWrapper) {
    console.error('❌ Password wrapper not found!');
    return;
  }
  
  // Dapatkan input password
  const passwordInput = passwordWrapper.querySelector('input[type="password"], input[type="text"]');
  
  if (!passwordInput) {
    console.error('❌ Password input not found!');
    return;
  }
  
  // Dapatkan icon element
  const icon = button.querySelector('i');
  
  if (!icon) {
    console.error('❌ Icon not found!');
    return;
  }
  
  // Toggle tipe input antara password dan text
  if (passwordInput.type === 'password') {
    // Show password
    passwordInput.type = 'text';
    
    // Ubah icon ke mata tertutup (eye-slash)
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
    
    // Tambahkan class active untuk styling
    button.classList.add('active');
    
    // Update aria-label untuk accessibility
    button.setAttribute('aria-label', 'Hide password');
    
    // Log untuk debugging
    console.log('👁️ Password shown');
  } else {
    // Hide password
    passwordInput.type = 'password';
    
    // Ubah icon kembali ke mata terbuka (eye)
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
    
    // Hapus class active
    button.classList.remove('active');
    
    // Update aria-label untuk accessibility
    button.setAttribute('aria-label', 'Show password');
    
    // Log untuk debugging
    console.log('🔒 Password hidden');
  }
  
  // Tambahkan animasi shake kecil untuk feedback visual
  button.style.animation = 'none';
  setTimeout(() => {
    button.style.animation = '';
  }, 10);
}

/**
 * Auto-initialize saat DOM ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPasswordToggle);
} else {
  // DOM sudah ready, langsung initialize
  initPasswordToggle();
}

// Export untuk digunakan di module lain (jika diperlukan)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPasswordToggle,
    togglePasswordVisibility
  };
}


