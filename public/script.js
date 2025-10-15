const USER_STORAGE_KEY = 'sampahKuPilahUser';
function persistUserSession(profile) {
  if (!profile || !profile.email) return;
  const normalized = {
    email: profile.email,
    name: profile.name || profile.email.split('@')[0]
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
}
document.addEventListener('DOMContentLoaded', function() {
  // --- Login manual ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const existingSession = localStorage.getItem(USER_STORAGE_KEY);
    if (existingSession) {
      window.location.href = 'index.html';
      return;
    }
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('emailLogin').value;
      const password = document.getElementById('passwordLogin').value;
      try {
        const res = await fetch('/register', { // bisa diganti /login jika ingin validasi
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
          persistUserSession({ email });
          window.location.href = 'index.html';
        } else {
          alert(data.message);
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan server');
      }
    });
  }

  // --- Google Sign-In ---
  function handleCredentialResponse(response) {
    const user = parseJwt(response.credential);
    fetch('/save-google-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }).then(() => {
      persistUserSession({
        email: user.email,
        name: user.name || user.given_name || user.family_name || user.email
      });
      window.location.href = 'index.html';
    });
  }
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
  }

  function initGoogleSignIn() {
    google.accounts.id.initialize({
      client_id: '493653215915-ljtfgmg57f2si5jqggtro166jpbqibko.apps.googleusercontent.com', // <-- Ganti dengan Client ID kamu
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      document.getElementById('googleSignInButton'),
      { theme: 'outline', size: 'large', width: '100%' }
    );
    google.accounts.id.prompt();
  }

  if (window.google && window.google.accounts) {
    initGoogleSignIn();
  } else {
    const checkGoogle = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(checkGoogle);
        initGoogleSignIn();
      }
    }, 500);
  }
});
