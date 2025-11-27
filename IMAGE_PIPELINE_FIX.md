# Perbaikan Pipeline Gambar Marketplace

## Masalah yang Diperbaiki

1. **Error 431 (Request Header Fields Too Large)**: Data base64 yang sangat panjang disimpan sebagai string di database
2. **Error 404 untuk URL aneh**: JSON string digunakan sebagai URL gambar
3. **SyntaxError**: Response error HTML diparse sebagai JavaScript
4. **Layout berantakan**: Gambar gagal load menyebabkan layout rusak

## Solusi yang Diimplementasikan

### 1. Endpoint Upload ke Supabase Storage

**File**: `server.js`
**Endpoint**: `POST /api/marketplace/upload-image`

- Upload gambar ke Supabase Storage bucket `marketplace-images`
- Generate path unik: `listings/{timestamp}-{filename}.{ext}`
- Return public URL dari Supabase Storage
- **Fallback**: Jika upload gagal, return data URL (backward compatible)

### 2. Frontend Upload Pipeline

**File**: `public/js/marketplace-create.js`

**Fungsi `uploadImage(file)`**:
- Convert file ke base64
- Upload ke `/api/marketplace/upload-image`
- Return URL (Supabase Storage URL atau data URL fallback)

**Fungsi `collectImages()`**:
- Upload setiap gambar ke server
- Return array of URL strings (bukan objects)

**Perubahan**:
- Sebelum: `images = [{base64: "...", mimeType: "...", filename: "..."}]`
- Sesudah: `images = ["https://...supabase.co/storage/...jpg", "data:image/jpeg;base64,..."]`

### 3. Backend Processing

**File**: `server.js`
**Endpoint**: `POST /api/marketplace/listings`

**Normalisasi images**:
- Handle multiple formats:
  - URL strings (http/https/data URL) → langsung pakai
  - Objects `{base64, mimeType}` → convert ke data URL
  - Objects `{url}` → pakai URL
  - Objects `{path}` → construct Supabase Storage URL
- Simpan sebagai array of URL strings ke database

### 4. Frontend Rendering

**Files**: `public/js/marketplace-detail.js`, `public/js/marketplace.js`

**Fungsi `normalizeImage(img)`**:
- Handle semua format:
  - JSON string → parse → normalize
  - Object `{base64, mimeType}` → convert ke data URL
  - Object `{url}` → pakai URL
  - Object `{path}` → construct Supabase Storage URL
  - String URL → pakai langsung
- Return URL string yang valid

**Fungsi `parseImages(images)`**:
- Parse array dari Supabase response
- Normalize setiap item menggunakan `normalizeImage()`
- Return array of normalized URL strings

**Fungsi `renderImages(images)`**:
- Parse images menggunakan `parseImages()`
- Render main image dan thumbnails
- Error handling yang proper
- Logging untuk debugging

## Format Data di Database

**Kolom `images` (text[])** sekarang berisi:
```sql
-- Format baru (preferred):
['https://xxx.supabase.co/storage/v1/object/public/marketplace-images/listings/123.jpg']

-- Format lama (backward compatible):
['data:image/jpeg;base64,/9j/4AAQSkZJRg...']
```

**TIDAK lagi**:
- ❌ `['{"base64":"...","mimeType":"..."}']` (JSON string)
- ❌ `[{"base64":"...","mimeType":"..."}]` (Object - tidak bisa di Supabase text[])

## Backward Compatibility

Kode mendukung:
1. **Data lama**: JSON string atau object format → di-normalize ke URL
2. **Data baru**: URL strings → langsung digunakan
3. **Fallback**: Jika Supabase Storage tidak tersedia → gunakan data URL

## Setup Supabase Storage

Untuk menggunakan Supabase Storage:

1. Buat bucket `marketplace-images` di Supabase Dashboard
2. Set bucket sebagai **public**
3. Set policy untuk allow upload (jika perlu)

Jika bucket tidak ada, sistem akan fallback ke data URL.

## Testing

1. **Upload gambar baru**: Harus tersimpan sebagai Supabase Storage URL
2. **Load listing lama**: Harus bisa render (backward compatible)
3. **Error handling**: Gambar gagal load → tampilkan placeholder
4. **Layout**: Tidak berantakan meskipun gambar gagal load

## Catatan Penting

- Data URL masih digunakan sebagai fallback jika Supabase Storage tidak tersedia
- Normalisasi di frontend memastikan semua format bisa dirender
- Logging ditambahkan untuk debugging
- Error handling diperbaiki untuk mencegah layout rusak

