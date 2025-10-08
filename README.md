# EcoDetect - Aplikasi Deteksi Sampah Real-time

## Deskripsi
EcoDetect adalah aplikasi web untuk deteksi sampah secara real-time menggunakan kamera. Aplikasi ini membantu pengguna mengidentifikasi jenis sampah dan memberikan rekomendasi tong sampah yang sesuai.

## Fitur Utama

### 🔐 Sistem Autentikasi
- Login manual dengan email dan password
- Login dengan Google OAuth
- Sistem registrasi pengguna
- Session management

### 📹 Deteksi Sampah Real-time
- Akses kamera perangkat untuk deteksi langsung
- Mode simulasi untuk demo/testing
- Overlay visual dengan scan line dan crosshair
- Deteksi otomatis setiap 3-5 detik

### 🗂️ Klasifikasi Sampah
- **Organik**: Sisa makanan, daun kering, kulit buah
- **Anorganik**: Botol plastik, kaleng aluminium, kertas, kardus
- **B3 (Bahan Berbahaya)**: Baterai, lampu neon, obat kadaluarsa

### 🗑️ Rekomendasi Tong Sampah
- Tong Sampah Organik (hijau) - untuk sampah yang dapat terurai
- Tong Sampah Anorganik (biru) - untuk sampah yang dapat didaur ulang  
- Tong Sampah B3 (orange) - untuk sampah berbahaya dan beracun

### 📊 Dashboard Interaktif
- Tampilan hasil deteksi real-time
- Riwayat deteksi terbaru (10 item terakhir)
- Persentase confidence untuk setiap deteksi
- Notifikasi untuk setiap deteksi baru

## Teknologi yang Digunakan

### Frontend
- HTML5 dengan semantic elements
- CSS3 dengan modern features (Grid, Flexbox, Backdrop-filter)
- Vanilla JavaScript (ES6+)
- Font Awesome untuk ikon
- Google Fonts (Montserrat)

### Backend
- Node.js
- Express.js
- JSON file storage untuk user data

### Kamera & Deteksi
- WebRTC getUserMedia API
- Canvas API untuk simulasi
- Local Storage untuk riwayat deteksi

## Struktur File

```
LoginGoogle/
├── public/
│   ├── index.html          # Halaman login
│   ├── register.html       # Halaman registrasi
│   ├── welcome.html        # Dashboard utama
│   ├── style.css           # Styling aplikasi
│   ├── script.js           # Script login/register
│   ├── register.js         # Script registrasi
│   └── camera-detection.js # Script deteksi sampah
├── server.js               # Server Node.js
├── users.json              # Database pengguna
└── README.md              # Dokumentasi
```

## Cara Menjalankan

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Jalankan Server**
   ```bash
   node server.js
   ```

3. **Akses Aplikasi**
   - Buka browser dan kunjungi `http://localhost:3000`
   - Login atau daftar akun baru
   - Klik "Mulai" pada dashboard untuk mengaktifkan kamera

## Cara Penggunaan

### 1. Login/Registrasi
- Gunakan email dan password untuk login manual
- Atau klik tombol Google untuk login dengan akun Google
- Jika belum punya akun, klik "Daftar Akun"

### 2. Deteksi Sampah
- Setelah login, Anda akan masuk ke dashboard
- Klik tombol "Mulai" untuk mengaktifkan kamera
- Arahkan kamera ke objek sampah
- Sistem akan otomatis mendeteksi dan menampilkan hasil

### 3. Melihat Hasil
- **Hasil Deteksi**: Nama sampah, jenis, dan confidence level
- **Rekomendasi Bin**: Tong sampah yang sesuai dengan jenis sampah
- **Riwayat**: 10 deteksi terbaru dengan timestamp

## Database Sampah

Aplikasi memiliki database built-in dengan 10 jenis sampah:

| Nama Sampah | Jenis | Confidence | Ikon |
|-------------|-------|------------|------|
| Botol Plastik | Anorganik | 95% | 🍾 |
| Kaleng Aluminium | Anorganik | 92% | 🍺 |
| Kertas | Anorganik | 89% | 📄 |
| Kardus | Anorganik | 87% | 📦 |
| Sisa Makanan | Organik | 94% | 🍎 |
| Daun Kering | Organik | 91% | 🍃 |
| Kulit Buah | Organik | 88% | 🍌 |
| Baterai | B3 | 96% | 🔋 |
| Lampu Neon | B3 | 93% | 💡 |
| Obat Kadaluarsa | B3 | 90% | 💊 |

## Fitur Responsif

- **Desktop**: Layout 2 kolom (kamera + hasil)
- **Tablet**: Layout 1 kolom dengan grid
- **Mobile**: Layout vertikal dengan optimasi touch

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Pengembangan Selanjutnya

### Machine Learning Integration
- Integrasi dengan TensorFlow.js
- Training model untuk deteksi sampah yang lebih akurat
- Support untuk lebih banyak jenis sampah

### Fitur Tambahan
- Database sampah yang lebih lengkap
- Export riwayat deteksi
- Statistik penggunaan
- Mode offline

### UI/UX Improvements
- Dark/Light mode toggle
- Animasi yang lebih smooth
- Sound feedback untuk deteksi
- AR overlay untuk tong sampah

## Kontribusi

Silakan buat issue atau pull request untuk berkontribusi pada pengembangan aplikasi ini.

## Lisensi

MIT License - Silakan gunakan dan modifikasi sesuai kebutuhan.

---

**Catatan**: Aplikasi ini saat ini menggunakan simulasi deteksi untuk demo. Untuk implementasi nyata, diperlukan integrasi dengan model machine learning yang sudah dilatih untuk deteksi sampah.


