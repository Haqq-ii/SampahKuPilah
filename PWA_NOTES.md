# 📱 Dokumentasi PWA - SampahKuPilah

Dokumentasi ini menjelaskan implementasi Progressive Web App (PWA) untuk website SampahKuPilah.

## 📋 Daftar Isi

1. [Lokasi File PWA](#lokasi-file-pwa)
2. [Cara Update Versi Cache](#cara-update-versi-cache)
3. [Cara Cek PWA Sudah Aktif](#cara-cek-pwa-sudah-aktif)
4. [Troubleshooting](#troubleshooting)
5. [Catatan Penting](#catatan-penting)

---

## 📁 Lokasi File PWA

### 1. Manifest File
**Lokasi:** `public/manifest.webmanifest`

File ini berisi konfigurasi PWA seperti:
- Nama aplikasi: "SampahKuPilah"
- Theme color: `#4caf50` (hijau)
- Display mode: `standalone`
- Icons: `/icons/icon-192.png` dan `/icons/icon-512.png`

### 2. Service Worker
**Lokasi:** `public/service-worker.js`

Service worker ini menangani:
- **Pre-caching**: Cache asset utama saat install
- **Runtime caching**: Cache asset saat runtime
- **Offline support**: Fallback ke cache saat offline
- **Cache strategy**:
  - **Cache First**: Untuk CSS, JS, gambar, fonts
  - **Network First**: Untuk HTML pages dan API calls

**Versi cache saat ini:** `skp-pwa-v1`

### 3. Service Worker Registration
**Lokasi:** `public/js/pwa-register.js`

Script ini mendaftarkan service worker saat halaman di-load.

### 4. Icons
**Lokasi:** `public/icons/`

Direktori ini berisi icon untuk PWA:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

**Catatan:** Icon harus dibuat terlebih dahulu. Gunakan `icon-generator.html` di direktori icons untuk membuat icon sederhana.

### 5. HTML Integration
**Lokasi:** `public/index.html`

File HTML utama sudah ditambahkan:
- `<link rel="manifest" href="/manifest.webmanifest">`
- `<meta name="theme-color" content="#4caf50">`
- `<script src="js/pwa-register.js"></script>`

---

## 🔄 Cara Update Versi Cache

Saat ada perubahan besar pada asset (CSS, JS, HTML), Anda perlu update versi cache agar user mendapatkan versi terbaru.

### Langkah-langkah:

1. **Buka file `public/service-worker.js`**

2. **Update versi cache:**
   ```javascript
   // Ubah dari:
   const CACHE_NAME = 'skp-pwa-v1';
   // Menjadi:
   const CACHE_NAME = 'skp-pwa-v2'; // atau versi berikutnya
   ```

3. **Update daftar PRECACHE_ASSETS** jika ada file baru:
   ```javascript
   const PRECACHE_ASSETS = [
     '/',
     '/index.html',
     '/css/common.css',
     // ... tambahkan file baru di sini
   ];
   ```

4. **Restart server** dan **refresh halaman** di browser

5. **Service worker akan otomatis update** dan cache lama akan dihapus

### Tips:
- Update versi cache hanya saat ada perubahan penting
- Jangan update terlalu sering (bisa membingungkan user)
- Test di browser setelah update

---

## ✅ Cara Cek PWA Sudah Aktif

### Di Chrome DevTools (Desktop):

1. **Buka website** di Chrome: `http://localhost:3000` (atau URL production)

2. **Buka Chrome DevTools** (F12 atau Right-click → Inspect)

3. **Tab Application → Manifest:**
   - Klik tab **Application** di DevTools
   - Pilih **Manifest** di sidebar kiri
   - Cek apakah manifest terdeteksi dengan benar
   - Status **Installability** harus menunjukkan **"Yes"** atau **"Installable"**
   - Pastikan semua field terisi dengan benar (name, icons, theme-color, dll)

4. **Tab Application → Service Workers:**
   - Pilih **Service Workers** di sidebar kiri
   - Cek status service worker:
     - Status harus **"activated and is running"** (hijau)
     - Scope: `/`
     - Source: `service-worker.js`

5. **Tab Application → Storage:**
   - Pilih **Cache Storage** di sidebar kiri
   - Harus ada cache dengan nama `skp-pwa-v1` (atau versi terbaru)
   - Klik cache untuk melihat daftar file yang di-cache

6. **Test Offline:**
   - Di tab **Network**, centang **"Offline"**
   - Refresh halaman
   - Website harus masih bisa diakses (dari cache)

### Di Mobile (Android Chrome):

1. **Buka website** di Chrome mobile

2. **Cek menu browser:**
   - Tap menu (3 dots) di Chrome
   - Harus ada opsi **"Add to Home Screen"** atau **"Install App"**
   - Jika ada, berarti PWA sudah terdeteksi

3. **Install PWA:**
   - Tap **"Add to Home Screen"**
   - PWA akan terinstall sebagai aplikasi standalone
   - Icon akan muncul di home screen

4. **Cek di Settings:**
   - Buka **Settings → Apps**
   - Cari "SampahKuPilah"
   - Harus muncul sebagai installed app

### Di Mobile (iOS Safari):

1. **Buka website** di Safari iOS

2. **Tap Share button** (kotak dengan panah)

3. **Pilih "Add to Home Screen"**

4. **PWA akan terinstall** sebagai icon di home screen

---

## 🔧 Troubleshooting

### Problem: Service Worker tidak terdaftar

**Solusi:**
1. Pastikan website diakses via **HTTP/HTTPS** (bukan `file://`)
2. Untuk development, gunakan `localhost` (service worker bekerja di localhost)
3. Cek console browser untuk error message
4. Pastikan file `service-worker.js` ada di root `public/`
5. Pastikan path di `pwa-register.js` benar: `/service-worker.js`

### Problem: Manifest tidak terdeteksi

**Solusi:**
1. Pastikan file `manifest.webmanifest` ada di `public/`
2. Pastikan link di HTML benar: `<link rel="manifest" href="/manifest.webmanifest">`
3. Cek di DevTools → Application → Manifest untuk error detail
4. Pastikan format JSON valid (bisa test di JSON validator)

### Problem: Icon tidak muncul

**Solusi:**
1. Pastikan file icon ada di `public/icons/icon-192.png` dan `public/icons/icon-512.png`
2. Jika belum ada, buat icon menggunakan `public/icons/icon-generator.html`
3. Pastikan path di manifest benar: `"/icons/icon-192.png"`
4. Pastikan format icon adalah PNG dengan ukuran yang benar

### Problem: Cache tidak update

**Solusi:**
1. Update versi `CACHE_NAME` di `service-worker.js`
2. Hard refresh browser (Ctrl+Shift+R atau Cmd+Shift+R)
3. Atau unregister service worker di DevTools → Application → Service Workers → Unregister
4. Refresh halaman untuk re-register

### Problem: PWA tidak bisa diinstall

**Solusi:**
1. Pastikan semua requirement terpenuhi:
   - ✅ Manifest file valid
   - ✅ Service worker aktif
   - ✅ Icon tersedia (minimal 192x192 dan 512x512)
   - ✅ HTTPS (untuk production) atau localhost (untuk development)
2. Cek di DevTools → Application → Manifest untuk error detail
3. Pastikan `display: "standalone"` di manifest
4. Pastikan `start_url` dan `scope` benar

---

## ⚠️ Catatan Penting

### Development vs Production

1. **Development (localhost):**
   - Service worker bekerja di `localhost`
   - Tidak perlu HTTPS
   - Cocok untuk testing

2. **Production:**
   - **WAJIB menggunakan HTTPS** untuk service worker aktif
   - Service worker tidak bekerja di HTTP (kecuali localhost)
   - Pastikan SSL certificate valid

### Browser Support

- ✅ **Chrome/Edge**: Full support
- ✅ **Firefox**: Full support
- ✅ **Safari iOS**: Partial support (dari iOS 11.3+)
- ⚠️ **Safari Desktop**: Limited support

### Best Practices

1. **Update cache version** hanya saat ada perubahan penting
2. **Test offline functionality** setelah setiap update
3. **Monitor cache size** - jangan cache terlalu banyak file
4. **Update icons** jika ada perubahan branding
5. **Test di berbagai device** sebelum deploy

### Security

- Service worker hanya bekerja di secure context (HTTPS atau localhost)
- Jangan cache sensitive data di service worker
- Pastikan API calls tetap menggunakan authentication

---

## 📞 Support

Jika ada masalah atau pertanyaan tentang PWA implementation, cek:
1. Console browser untuk error messages
2. DevTools → Application untuk detail
3. Service worker logs di DevTools → Application → Service Workers

---

**Terakhir diupdate:** 2024
**Versi PWA:** v1

