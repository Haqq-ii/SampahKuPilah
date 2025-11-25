# Troubleshooting Docker - Fitur Deteksi Sampah Tidak Berfungsi

## Masalah: Error 500 saat Deteksi Sampah

Jika Anda mendapatkan error `Server error: 500` atau `OpenAI API key tidak ditemukan` saat menggunakan fitur deteksi sampah di Docker, ikuti langkah-langkah berikut:

## Langkah 1: Pastikan File `.env` Ada

File `.env` harus ada di direktori `SampahKuPilah/` (sama dengan `docker-compose.yml`):

```bash
cd SampahKuPilah
ls -la .env
```

Jika file tidak ada, buat dari template:

```bash
cp env.example .env
```

## Langkah 2: Edit File `.env`

Buka file `.env` dan pastikan `OPENAI_API_KEY` sudah diisi dengan API key yang valid:

```bash
# Contoh isi file .env
OPENAI_API_KEY=sk-proj-your_actual_api_key_here
PORT=3000
ESP32_HOST=http://192.168.1.20
```

**Penting:** 
- API key harus dimulai dengan `sk-proj-` atau `sk-`
- Jangan ada spasi sebelum atau sesudah `=`
- Jangan gunakan tanda kutip di sekitar nilai

## Langkah 3: Verifikasi Konfigurasi

Setelah mengedit file `.env`, verifikasi bahwa konfigurasi benar:

**Di Windows (PowerShell):**
```powershell
Get-Content .env
```

**Di Linux/Mac:**
```bash
cat .env
```

Pastikan baris `OPENAI_API_KEY=...` ada dan berisi API key yang valid.

## Langkah 4: Restart Docker Container

Setelah mengubah file `.env`, restart container Docker:

```bash
# Stop container
docker-compose down

# Rebuild dan start
docker-compose up --build
```

**Atau jika sudah berjalan di background:**

```bash
docker-compose restart
docker-compose logs -f web
```

## Langkah 5: Cek Log Docker

Setelah restart, cek log untuk memastikan `OPENAI_API_KEY` ter-load:

```bash
docker-compose logs web | grep -i "OPENAI_API_KEY"
```

**Output yang diharapkan:**
```
🔑 OPENAI_API_KEY tersedia: true
   Key length: XX karakter
   Key prefix: sk-proj...
```

**Jika melihat:**
```
❌ ERROR: OPENAI_API_KEY tidak ditemukan di environment variables!
```

Berarti file `.env` tidak ter-load dengan benar.

## Langkah 6: Debug dengan Masuk ke Container

Jika masih ada masalah, masuk ke dalam container untuk memeriksa environment variables:

```bash
# Masuk ke container
docker-compose exec web sh

# Di dalam container, cek environment variable
echo $OPENAI_API_KEY

# Jika kosong, berarti env_file tidak ter-load
```

## Solusi Alternatif

Jika `env_file` di `docker-compose.yml` tidak bekerja, Anda bisa set environment variable langsung:

**Edit `docker-compose.yml`:**

```yaml
services:
  web:
    # ... konfigurasi lainnya ...
    environment:
      - OPENAI_API_KEY=sk-proj-your_actual_api_key_here
      - NODE_ENV=production
```

**⚠️ Peringatan:** Jangan commit file ini ke Git jika berisi API key!

## Verifikasi Fitur Deteksi Berfungsi

Setelah restart:

1. Buka browser dan kunjungi `http://localhost:3000`
2. Login ke aplikasi
3. Klik tombol "Upload Foto" atau "Scan Sekali"
4. Jika berhasil, Anda akan melihat hasil klasifikasi sampah
5. Jika masih error, cek console browser (F12) untuk pesan error yang lebih detail

## Pesan Error yang Mungkin Muncul

### Error: "OpenAI API key tidak ditemukan"
- **Solusi:** Pastikan file `.env` ada dan berisi `OPENAI_API_KEY` yang valid

### Error: "Server error: 500"
- **Cek log Docker:** `docker-compose logs web`
- Cari pesan error yang spesifik tentang API key atau OpenAI

### Error: "Request timeout"
- **Solusi:** Periksa koneksi internet atau coba lagi nanti

### Error: "Terlalu banyak permintaan"
- **Solusi:** Tunggu beberapa saat sebelum mencoba lagi (rate limit OpenAI)

## Masih Bermasalah?

Jika masih ada masalah setelah mengikuti langkah-langkah di atas:

1. **Cek versi Docker:**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Cek file `docker-compose.yml`:**
   Pastikan ada baris:
   ```yaml
   env_file:
     - .env
   ```

3. **Cek permissions file `.env`:**
   ```bash
   ls -la .env
   ```
   Pastikan file dapat dibaca.

4. **Coba rebuild dari awal:**
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

5. **Cek apakah container berjalan:**
   ```bash
   docker-compose ps
   ```

## Kontak Support

Jika masalah masih berlanjut, sediakan informasi berikut:
- Output dari `docker-compose logs web`
- Isi file `docker-compose.yml` (tanpa API key)
- Pesan error di browser console (F12)


