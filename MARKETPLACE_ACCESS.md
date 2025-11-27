# Cara Mengakses Marketplace

## ✅ Link Marketplace Sudah Ditambahkan

Marketplace sekarang bisa diakses dari beberapa tempat:

### 1. Halaman Utama (index.html)
- **Tombol di Hero Section**: "🛒 Marketplace Daur Ulang"
- **Feature Card**: Di bagian "Fitur Utama" ada card "Marketplace Daur Ulang" dengan link

### 2. Dashboard (welcome.html)
- **Navigation Bar**: Link "Marketplace" dan "Profil" di header
- Tampil setelah user login

### 3. Halaman Profil (profile.html)
- **Navigation Bar**: Link "Marketplace" dan "Dashboard" di header

### 4. Akses Langsung
- URL: `http://localhost:3000/marketplace.html`

## 🎯 Fitur Marketplace yang Tersedia

### Halaman Browse (marketplace.html)
- ✅ Filter berdasarkan kategori
- ✅ Filter berdasarkan lokasi (kota, kecamatan, desa)
- ✅ Search keyword
- ✅ Sort (terbaru, harga, relevansi, lokasi)
- ✅ Pagination
- ✅ Responsive design

### Backend Endpoints
- ✅ GET /api/marketplace/listings - List dengan filter
- ✅ GET /api/marketplace/listings/:id - Detail listing
- ✅ POST /api/marketplace/listings - Create listing
- ✅ POST /api/marketplace/orders - Ajukan Pembelian
- ✅ GET /api/marketplace/orders - List orders
- ✅ GET /api/marketplace/orders/:id - Detail order
- ✅ PUT /api/marketplace/orders/:id/status - Update status
- ✅ POST /api/marketplace/messages - Kirim pesan
- ✅ GET /api/marketplace/messages/:order_id - Get messages

## 📝 Catatan

- Halaman marketplace akan kosong jika belum ada data di database
- Untuk test, buat beberapa listing via API atau buat halaman create listing terlebih dahulu
- Pastikan server berjalan: `npm start`
- Pastikan Supabase sudah dikonfigurasi di `.env`

## 🚀 Langkah Selanjutnya

1. Test akses marketplace dari berbagai halaman
2. Buat halaman create listing untuk user bisa jual barang
3. Buat halaman detail produk untuk user bisa lihat detail dan ajukan pembelian

