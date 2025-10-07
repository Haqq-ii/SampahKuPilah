document.addEventListener('DOMContentLoaded', function() {
  // --- Login manual ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
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
          window.location.href = 'welcome.html?name=' + encodeURIComponent(email);
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
      window.location.href = 'welcome.html?name=' + encodeURIComponent(user.name || user.email);
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
