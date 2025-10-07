const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// --- Register manual ---
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi' });
  }

  let users = [];
  try {
    users = JSON.parse(fs.readFileSync('users.json', 'utf-8'));
  } catch {
    users = [];
  }

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Email sudah terdaftar' });
  }

  users.push({ email, password });
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  res.json({ message: 'User berhasil didaftarkan', email });
});

// --- Save Google user ---
app.post('/save-google-user', (req, res) => {
  const user = req.body;
  let users = [];
  try {
    users = JSON.parse(fs.readFileSync('users.json', 'utf-8'));
  } catch {
    users = [];
  }
  users.push(user);
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  res.json({ message: 'Google user disimpan!' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
