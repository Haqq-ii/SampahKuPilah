# 🔧 Troubleshooting Vercel Deployment - Error 404 pada /login

## ❌ Error yang Terjadi

```
POST https://sampahkupilahfsd-ner5.vercel.app/login 404 (Not Found)
SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON
```

## 🔍 Analisis Masalah

Error 404 pada route `/login` berarti:
1. **Routing Vercel tidak mengenali route Express**
2. **Vercel mengembalikan HTML error page** (bukan JSON)
3. **Frontend mencoba parse HTML sebagai JSON** → SyntaxError

## ✅ Solusi yang Sudah Diterapkan

### 1. File `api/index.js` (Entry Point untuk Vercel)
- Import Express app dari `server.js`
- Export sebagai default untuk Vercel serverless function

### 2. File `vercel.json` (Konfigurasi Routing)
- Build `api/index.js` sebagai serverless function
- Route semua request (`/(.*)`) ke `/api/index.js`
- Filesystem handler untuk static files

### 3. Perbaikan Error Handling di Frontend
- Cek content-type sebelum parse JSON
- Handle non-JSON response dengan lebih baik
- Error message yang lebih informatif

## 🚀 Langkah-langkah Perbaikan

### Step 1: Commit dan Push Perubahan

```bash
git add .
git commit -m "Fix Vercel routing - add api/index.js entry point"
git push origin main
```

### Step 2: Redeploy di Vercel

1. **Buka Vercel Dashboard**
2. **Pilih project** SampahKuPilah
3. **Klik "Redeploy"** atau tunggu auto-deploy dari GitHub

### Step 3: Verifikasi Environment Variables

Pastikan semua env vars sudah di-set di **Vercel Dashboard → Settings → Environment Variables**:

**Wajib:**
- ✅ `OPENAI_API_KEY`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_KEY`

**Opsional:**
- `YOUTUBE_API_KEY`
- `ESP32_HOST`
- `PORT` (Vercel akan set otomatis)

**Catatan:** 
- Set untuk **Production**, **Preview**, dan **Development**
- Format: **TANPA** spasi, **TANPA** quote
- Contoh: `OPENAI_API_KEY=sk-proj-...` (bukan `OPENAI_API_KEY="sk-proj-..."`)

### Step 4: Test Setelah Redeploy

1. **Buka website** di browser
2. **Test Login:**
   - Buka `/login.html`
   - Coba login dengan user yang sudah ada
   - Cek console untuk error
3. **Test Register:**
   - Buka `/register.html`
   - Coba register user baru
   - Cek apakah data tersimpan di Supabase

## 🔍 Debugging

### Cek Vercel Function Logs

1. **Buka Vercel Dashboard → Project → Functions**
2. **Klik pada function** `api/index.js`
3. **Lihat logs** untuk error detail

### Cek Network Request

1. **Buka Chrome DevTools → Network**
2. **Coba login**
3. **Cek request `/login`:**
   - Status code (harus 200, bukan 404)
   - Response headers (harus `application/json`)
   - Response body (harus JSON, bukan HTML)

### Test API Endpoint Langsung

Buka di browser atau Postman:
```
https://sampahkupilahfsd-ner5.vercel.app/api/supabase/test
```

Jika ini bekerja, berarti routing `/api/*` OK, tapi routing root-level (`/login`, `/register`) mungkin masih bermasalah.

## 🐛 Jika Masih Error 404

### Opsi 1: Cek Build Logs

1. **Vercel Dashboard → Deployments → Latest**
2. **Cek "Build Logs"** untuk error saat build
3. **Cek "Function Logs"** untuk error saat runtime

### Opsi 2: Test Local dengan Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Test local
vercel dev
```

Ini akan simulate Vercel environment di local.

### Opsi 3: Alternatif Routing

Jika routing masih bermasalah, kita bisa:
1. **Pindahkan route ke `/api/login`** dan `/api/register`
2. **Update frontend** untuk call `/api/login` dan `/api/register`
3. **Atau gunakan catch-all route** yang lebih eksplisit

## 📝 Checklist Setelah Fix

- [ ] Route `/login` mengembalikan JSON (bukan 404)
- [ ] Route `/register` mengembalikan JSON (bukan 404)
- [ ] Login berhasil dan data tersimpan di Supabase
- [ ] Register berhasil dan data tersimpan di Supabase
- [ ] Static files ter-load (CSS, JS, images)
- [ ] PWA manifest terdeteksi
- [ ] Service worker terdaftar

## 🔄 Jika Perlu Rollback

Jika ada masalah setelah perubahan:

```bash
git revert HEAD
git push origin main
```

Vercel akan auto-redeploy dengan versi sebelumnya.

---

**Status:** ✅ Perbaikan sudah diterapkan
**Next Step:** Commit, push, dan redeploy di Vercel

