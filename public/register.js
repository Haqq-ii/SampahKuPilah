const registerForm = document.getElementById('registerForm');
registerForm.addEventListener('submit', async (e) => {
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
      window.location.href = 'welcome.html?name=' + encodeURIComponent(email);
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error(err);
    alert('Terjadi kesalahan server');
  }
});
