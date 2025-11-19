# Summary: Deteksi Scan Sekali & Upload Foto

## Tujuan
Mengubah sistem deteksi dari realtime loop menjadi dua mode aksi manual:
1. **Scan Sekali** - tangkap 1 frame dari kamera
2. **Upload Foto** - pilih gambar dari direktori lokal

## Perubahan yang Dilakukan

### 1. `public/welcome.html`
**Penambahan:**
- Tombol "Scan Sekali" (`#scanOnce`) - diaktifkan setelah kamera mulai
- Tombol "Upload Foto" (`#uploadPhoto`) - selalu aktif
- Input file tersembunyi (`#photoInput`) dengan `accept="image/*"`
- Template bin tambahan: `#paperBin` dan `#residualBin`

**Yang Dipertahankan:**
- Semua elemen HTML yang ada (header, camera section, hasil deteksi)
- Semua ID yang digunakan UI: `#detectedName`, `#detectedType`, `#detectedConfidence`, `#recommendedBin`
- Struktur video container, placeholder, dan overlay

### 2. `public/camera-detection.js`
**Perubahan Utama:**
- ❌ **Dihapus:** Loop deteksi realtime (`startRealDetection()`, `stopRealDetection()`)
- ❌ **Dihapus:** Import dari `detection-openai.js`
- ✅ **Ditambahkan:** Method `scanOnce()` - tangkap dan proses 1 frame dari video
- ✅ **Ditambahkan:** Method `handleFileUpload()` - proses gambar yang di-upload
- ✅ **Ditambahkan:** Method `createMultiViewCrops()` - buat 3 crop (tight 60%, center 80%, wide 90%)
- ✅ **Ditambahkan:** Method `classifyImages()` - kirim ke POST `/classify`

**Alur Kerja Baru:**
1. User klik "Mulai" → kamera aktif, tombol "Scan Sekali" enabled
2. User klik "Scan Sekali" → ambil 1 frame → buat 3 crop → kirim ke server → tampilkan hasil
3. User klik "Upload Foto" → pilih file → buat 3 crop → kirim ke server → tampilkan hasil

**Multi-View Crops:**
- **Tight (60%)**: crop 60% dari tengah frame
- **Center (80%)**: crop 80% dari tengah frame  
- **Wide (90%)**: crop 90% dari tengah frame
- Semua di-resize ke **320×240 JPEG** dengan quality 0.7
- Dikirim dalam 1 request: `{ images: [base64_tight, base64_center, base64_wide] }`

### 3. `public/css/dashboard.css`
**Penambahan:**
- Style untuk `.scan-btn` (biru, hover effect)
- Style untuk `.upload-btn` (kuning, hover effect)
- Style untuk `.waste-bin.paper` (biru)
- Style untuk `.waste-bin.residual` (abu-abu)

## Endpoint Server
Tetap menggunakan **POST /classify** yang menerima:
```json
{
  "images": ["base64_tight", "base64_center", "base64_wide"]
}
```

Dan mengembalikan:
```json
{
  "decision": {
    "bin": "kuning",
    "confidence": 0.85,
    "dominant_class": "Plastik Botol",
    "reason": "..."
  }
}
```

## Keuntungan
1. ✅ Tidak ada loop realtime → lebih hemat resource
2. ✅ User kontrol penuh kapan deteksi dilakukan
3. ✅ Dapat upload foto dari galeri/file
4. ✅ Tetap multi-view untuk akurasi tinggi
5. ✅ UI/UX tetap sama, hanya tambahan tombol

## Yang TIDAK Diubah
- Struktur HTML utama
- ID dan class elemen hasil
- Endpoint `/classify`
- Format multi-view crops
- Template tong sampah
- Camera controls layout

## Testing
Untuk menguji:
1. Buka `welcome.html`
2. Klik "Mulai" untuk aktifkan kamera
3. Klik "Scan Sekali" untuk deteksi dari kamera
4. Klik "Upload Foto" untuk upload gambar dari file
5. Verifikasi hasil muncul di kartu deteksi dan rekomendasi tong sampah

