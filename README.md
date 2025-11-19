# SampahKuPilah - Aplikasi Deteksi Sampah AI Real-time

## Deskripsi
SampahKuPilah adalah aplikasi web untuk deteksi sampah secara real-time menggunakan kamera dan AI (OpenAI Vision API). Aplikasi ini membantu pengguna mengidentifikasi jenis sampah dan memberikan rekomendasi tong sampah yang sesuai dengan akurasi tinggi.

## Fitur Utama

### 🔐 Sistem Autentikasi
- Login manual dengan email dan password
- Login dengan Google OAuth
- Sistem registrasi pengguna
- Session management

### 📹 Deteksi Sampah Real-time dengan AI
- Akses kamera perangkat untuk deteksi langsung
- Integrasi OpenAI Vision API untuk deteksi akurat
- Overlay visual dengan bounding boxes
- Deteksi otomatis setiap detik dengan confidence threshold
- Mode simulasi untuk demo/testing (fallback)

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
- Node.js dengan ES Modules
- Express.js
- OpenAI API (Vision) untuk deteksi sampah
- JSON file storage untuk user data
- CORS dan body-parser untuk API

### Kamera & Deteksi
- WebRTC getUserMedia API
- Canvas API untuk overlay dan frame capture
- OpenAI Vision API dengan Structured Outputs
- Local Storage untuk riwayat deteksi

## Struktur File

```
SampahKuPilah/
├── public/
│   ├── index.html              # Halaman login
│   ├── register.html           # Halaman registrasi
│   ├── welcome.html            # Dashboard utama
│   ├── style.css               # Styling aplikasi
│   ├── script.js               # Script login/register
│   ├── register.js             # Script registrasi
│   ├── camera-detection.js     # Script deteksi sampah (main)
│   └── detection-openai.js     # Module deteksi AI real-time
├── server.js                   # Server Node.js dengan OpenAI API
├── users.json                  # Database pengguna
├── package.json                # Dependencies Node.js
├── env.example                 # Template environment variables
└── README.md                   # Dokumentasi
```

## Cara Menjalankan

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment Variables**
   ```bash
   # Copy template environment file
   cp env.example .env
   
   # Edit .env file dan masukkan OpenAI API key
   # OPENAI_API_KEY=your_openai_api_key_here
   # OPENAI_MODEL=gpt-4o-mini
   # PORT=3000
   ```

3. **Jalankan Server**
   ```bash
   npm start
   # atau
   node server.js
   ```

4. **Akses Aplikasi**
   - Buka browser dan kunjungi `http://localhost:3000`
   - Login atau daftar akun baru
   - Klik "Mulai" pada dashboard untuk mengaktifkan kamera
   - Arahkan kamera ke sampah untuk deteksi AI real-time

## Cara Penggunaan

### 1. Login/Registrasi
- Gunakan email dan password untuk login manual
- Atau klik tombol Google untuk login dengan akun Google
- Jika belum punya akun, klik "Daftar Akun"

### 2. Deteksi Sampah dengan AI
- Setelah login, Anda akan masuk ke dashboard
- Klik tombol "Mulai" untuk mengaktifkan kamera
- Arahkan kamera ke objek sampah
- AI akan menganalisis gambar dan mendeteksi jenis sampah
- Bounding boxes akan muncul di sekitar objek yang terdeteksi
- Sistem akan menampilkan hasil dengan confidence level

### 3. Melihat Hasil
- **Hasil Deteksi**: Nama sampah, jenis, dan confidence level
- **Rekomendasi Bin**: Tong sampah yang sesuai dengan jenis sampah
- **Riwayat**: 10 deteksi terbaru dengan timestamp

## AI Detection Capabilities

Aplikasi menggunakan OpenAI Vision API untuk deteksi sampah dengan akurasi tinggi:

### Jenis Sampah yang Dapat Dideteksi
- **Plastik** (Kuning) - Botol, kemasan, tas plastik
- **Kertas** (Biru) - Kertas, kardus, koran
- **Organik** (Hijau) - Sisa makanan, daun, kulit buah
- **Kaca** (Cokelat) - Botol kaca, gelas, pecahan kaca
- **Logam** (Abu) - Kaleng, besi, aluminium
- **Baterai** (Merah) - Baterai, aki, elektronik
- **Lainnya** (Ungu) - Sampah yang tidak masuk kategori

### Fitur AI
- **Structured Outputs**: Response JSON yang konsisten
- **Bounding Boxes**: Lokasi objek dalam gambar
- **Confidence Score**: Tingkat kepercayaan deteksi (0-1)
- **Real-time Processing**: Analisis setiap detik
- **Multi-object Detection**: Dapat mendeteksi beberapa objek sekaligus

## Fitur Responsif

- **Desktop**: Layout 2 kolom (kamera + hasil)
- **Tablet**: Layout 1 kolom dengan grid
- **Mobile**: Layout vertikal dengan optimasi touch

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Requirements

### OpenAI API
- **API Key**: Diperlukan untuk deteksi AI
- **Model**: gpt-4o-mini (default) atau gpt-4o
- **Cost**: ~$0.01-0.02 per 1000 deteksi (tergantung model)

### Browser Requirements
- **WebRTC Support**: Untuk akses kamera
- **ES6 Modules**: Untuk import/export
- **Canvas API**: Untuk overlay dan frame capture

## Pengembangan Selanjutnya

### AI Improvements
- Fine-tuning model untuk sampah lokal Indonesia
- Custom training data untuk akurasi lebih tinggi
- Support untuk lebih banyak jenis sampah

### Fitur Tambahan
- Export riwayat deteksi ke CSV/PDF
- Statistik penggunaan dan analitik
- Mode offline dengan model lokal
- Multi-language support

### UI/UX Improvements
- Dark/Light mode toggle
- Animasi yang lebih smooth
- Sound feedback untuk deteksi
- AR overlay untuk tong sampah
- Voice commands

## Kontribusi

Silakan buat issue atau pull request untuk berkontribusi pada pengembangan aplikasi ini.

## Lisensi

MIT License - Silakan gunakan dan modifikasi sesuai kebutuhan.

---

**Catatan**: Aplikasi ini menggunakan OpenAI Vision API untuk deteksi sampah real-time. Pastikan Anda memiliki API key yang valid dan koneksi internet yang stabil untuk pengalaman terbaik.


