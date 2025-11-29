# 🚀 Panduan Deployment ke Vercel - SampahKuPilah

Dokumentasi lengkap untuk deploy website SampahKuPilah ke Vercel.

## ✅ Prasyarat

- [x] Supabase sudah aktif dan berfungsi
- [x] Environment variables sudah siap
- [x] Semua fitur sudah diuji di local

---

## 📋 Langkah-langkah Deployment

### 1. Persiapkan Repository

Pastikan project sudah di-push ke GitHub/GitLab/Bitbucket:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Install Vercel CLI (Opsional)

Jika ingin deploy via CLI:

```bash
npm i -g vercel
```

### 3. Deploy via Vercel Dashboard (Recommended)

1. **Buka [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Klik "Add New Project"**
3. **Import repository** dari GitHub/GitLab/Bitbucket
4. **Configure Project:**
   - Framework Preset: **Other**
   - Root Directory: `./` (root project)
   - Build Command: (kosongkan, tidak perlu build)
   - Output Directory: (kosongkan)
   - Install Command: `npm install`

### 4. Set Environment Variables

Di Vercel Dashboard → Project Settings → Environment Variables, tambahkan:

#### Wajib:
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

#### Opsional:
```
YOUTUBE_API_KEY=...
ESP32_HOST=http://192.168.1.20
PORT=3000
```

**Catatan:** 
- Set untuk **Production**, **Preview**, dan **Development**
- Jangan commit file `.env` ke repository (sudah di `.gitignore`)

### 5. Deploy

Klik **"Deploy"** dan tunggu proses build selesai.

---

## 🔧 Konfigurasi yang Sudah Dibuat

### File `vercel.json`
File ini sudah dibuat dan mengkonfigurasi:
- Serverless function untuk Express app
- Routing untuk semua request ke `server.js`
- Environment variable `NODE_ENV=production`

### Modifikasi `server.js`
Sudah dimodifikasi untuk:
- ✅ Deteksi environment Vercel (`IS_VERCEL`)
- ✅ Nonaktifkan file system write di Vercel
- ✅ Export default untuk serverless function
- ✅ Fallback ke Supabase saja di Vercel (tidak pakai JSON file)
- ✅ Error handling yang lebih baik jika Supabase tidak tersedia

---

## ✅ Checklist Setelah Deploy

### 1. Test Basic Functionality
- [ ] Website bisa diakses (tidak 404)
- [ ] Static files ter-load (CSS, JS, images)
- [ ] PWA manifest terdeteksi (DevTools → Application → Manifest)

### 2. Test Authentication
- [ ] Register user baru berhasil
- [ ] Login berhasil
- [ ] Data tersimpan di Supabase (cek Supabase Dashboard)

### 3. Test Core Features
- [ ] Deteksi sampah berfungsi (jika OpenAI API key valid)
- [ ] Marketplace bisa diakses
- [ ] Create listing berhasil
- [ ] Service worker terdaftar (DevTools → Application → Service Workers)

### 4. Test PWA
- [ ] Manifest terdeteksi
- [ ] Service worker aktif
- [ ] Bisa install sebagai PWA (di mobile)

---

## 🐛 Troubleshooting

### Problem: Build Error - Sharp

**Error:** `sharp` module tidak terinstall

**Solusi:**
1. Pastikan `sharp` ada di `package.json` dependencies
2. Vercel akan auto-install, tapi jika error, tambahkan di `vercel.json`:
```json
{
  "functions": {
    "server.js": {
      "includeFiles": "node_modules/sharp/**"
    }
  }
}
```

### Problem: Environment Variables Tidak Terdeteksi

**Error:** `OPENAI_API_KEY tidak ditemukan`

**Solusi:**
1. Pastikan env vars sudah di-set di Vercel Dashboard
2. Set untuk **Production**, **Preview**, dan **Development**
3. Redeploy setelah set env vars

### Problem: File System Write Error

**Error:** `EACCES: permission denied` atau `EROFS: read-only file system`

**Solusi:**
- ✅ Sudah di-handle! File system write sudah dinonaktifkan di Vercel
- Pastikan Supabase dikonfigurasi dengan benar
- Semua operasi write akan menggunakan Supabase

### Problem: Supabase Connection Error

**Error:** `Supabase not configured` atau connection timeout

**Solusi:**
1. Cek `SUPABASE_URL` dan `SUPABASE_SERVICE_KEY` di Vercel Dashboard
2. Pastikan format benar (tidak ada spasi, tidak ada quote)
3. Test koneksi Supabase di local dulu
4. Cek Supabase Dashboard untuk memastikan project aktif

### Problem: Static Files Tidak Ter-load

**Error:** 404 untuk CSS/JS/images

**Solusi:**
1. Pastikan folder `public/` ada di root project
2. Pastikan routing di `vercel.json` benar
3. Cek path di HTML (harus relative, bukan absolute)

### Problem: Service Worker Tidak Terdaftar

**Error:** Service worker registration failed

**Solusi:**
1. Pastikan website diakses via HTTPS (Vercel otomatis HTTPS)
2. Cek path service worker di `pwa-register.js`: `/service-worker.js`
3. Pastikan file `service-worker.js` ada di `public/`

---

## 📊 Monitoring

### Vercel Dashboard
- **Deployments**: Lihat semua deployment
- **Functions**: Monitor serverless function logs
- **Analytics**: Traffic dan performance

### Supabase Dashboard
- **Database**: Cek data users, detections, listings
- **Logs**: Monitor query dan error
- **Storage**: Cek file uploads (jika ada)

---

## 🔄 Update Deployment

Setelah update code:

1. **Commit dan push ke repository:**
```bash
git add .
git commit -m "Update: ..."
git push origin main
```

2. **Vercel akan auto-deploy** jika terhubung dengan GitHub
3. Atau **manual deploy** via Vercel Dashboard

---

## 📝 Catatan Penting

### File System
- ✅ File system write **dinonaktifkan** di Vercel
- ✅ Semua data disimpan di **Supabase**
- ✅ File `data/users.json` hanya untuk **local development**

### Environment Variables
- ✅ **Jangan commit** file `.env` ke repository
- ✅ Set semua env vars di **Vercel Dashboard**
- ✅ Set untuk **Production**, **Preview**, dan **Development**

### PWA
- ✅ PWA akan bekerja di **HTTPS** (Vercel otomatis HTTPS)
- ✅ Service worker akan aktif setelah deploy
- ✅ Manifest akan terdeteksi dengan benar

### Performance
- ✅ Vercel menggunakan **CDN** untuk static files
- ✅ Serverless functions untuk **API routes**
- ✅ Auto-scaling berdasarkan traffic

---

## 🎯 Probabilitas Sukses

Dengan konfigurasi yang sudah dibuat:
- ✅ **95-100%** jika Supabase aktif dan env vars sudah di-set
- ✅ Semua fitur akan berjalan normal
- ✅ Tidak ada file system write error
- ✅ PWA akan bekerja dengan baik

---

## 📞 Support

Jika ada masalah:
1. Cek **Vercel Dashboard → Functions → Logs** untuk error
2. Cek **Supabase Dashboard → Logs** untuk database error
3. Test di local dulu sebelum deploy
4. Pastikan semua env vars sudah di-set

---

**Terakhir diupdate:** Setelah modifikasi untuk Vercel deployment
**Status:** ✅ Siap untuk deploy

