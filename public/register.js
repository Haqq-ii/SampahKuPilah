const USER_STORAGE_KEY = 'sampahKuPilahUser';
function persistUserSession(profile) {
  if (!profile || !profile.email) return;
  const normalized = {
    email: profile.email,
    name: profile.name || profile.email.split('@')[0]
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
}
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const existingSession = localStorage.getItem(USER_STORAGE_KEY);
  if (existingSession) {
    window.location.href = 'index.html';
    return;
  }
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (password !== confirm) {
      alert('Password dan konfirmasi tidak cocok!');
      return;
    }
    try {
      const res = await fetch('/register', {
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
