# Rencana Arsitektur - Fitur Marketplace SampahKuPilah

## 📊 Struktur Tabel Supabase

### 1. Tabel `marketplace_listings`
**Deskripsi**: Menyimpan data produk/barang yang dijual

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | ID unik listing |
| `seller_id` | UUID | NOT NULL, FK ke users(id) | ID penjual |
| `seller_email` | TEXT | NOT NULL | Email penjual (untuk query cepat) |
| `title` | TEXT | NOT NULL | Judul produk |
| `description` | TEXT | NOT NULL | Deskripsi produk |
| `category` | TEXT | NOT NULL | Kategori (plastik, elektronik, furniture, pakaian, dll) |
| `tags` | TEXT[] | | Array tag untuk pencarian |
| `price` | NUMERIC(10,2) | | Harga (opsional, bisa gratis) |
| `images` | TEXT[] | | Array URL gambar produk |
| `location_city` | TEXT | | Kota |
| `location_district` | TEXT | | Kecamatan |
| `location_village` | TEXT | | Desa/Kelurahan |
| `status` | TEXT | NOT NULL, DEFAULT 'active' | Status: 'active', 'pending', 'sold', 'inactive' |
| `ai_generated` | BOOLEAN | DEFAULT false | Flag apakah data di-generate AI |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu diupdate |

**Indexes:**
- `idx_listings_seller_email` pada `seller_email`
- `idx_listings_category` pada `category`
- `idx_listings_status` pada `status`
- `idx_listings_location` pada `location_city, location_district, location_village`
- `idx_listings_created_at` pada `created_at DESC`
- Full-text search: `idx_listings_search` pada `title, description, tags` (GIN index)

---

### 2. Tabel `marketplace_orders`
**Deskripsi**: Menyimpan data order/pembelian

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | ID unik order |
| `order_id` | TEXT | UNIQUE, NOT NULL | Order ID untuk referensi (format: ORD-YYYYMMDD-XXXX) |
| `listing_id` | UUID | NOT NULL, FK ke marketplace_listings(id) | ID listing yang dibeli |
| `seller_id` | UUID | NOT NULL, FK ke users(id) | ID penjual |
| `seller_email` | TEXT | NOT NULL | Email penjual |
| `buyer_id` | UUID | NOT NULL, FK ke users(id) | ID pembeli |
| `buyer_email` | TEXT | NOT NULL | Email pembeli |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | Status: 'pending', 'deal', 'done', 'canceled' |
| `cod_location` | TEXT | | Lokasi COD (jika sudah disepakati) |
| `cod_time` | TIMESTAMPTZ | | Waktu COD (jika sudah disepakati) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu diupdate |

**Indexes:**
- `idx_orders_buyer_email` pada `buyer_email`
- `idx_orders_seller_email` pada `seller_email`
- `idx_orders_listing_id` pada `listing_id`
- `idx_orders_status` pada `status`
- `idx_orders_created_at` pada `created_at DESC`

---

### 3. Tabel `marketplace_messages`
**Deskripsi**: Menyimpan pesan chat antara pembeli dan penjual

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | ID unik pesan |
| `message_id` | TEXT | UNIQUE, NOT NULL | Message ID untuk referensi |
| `order_id` | UUID | NOT NULL, FK ke marketplace_orders(id) | ID order terkait |
| `sender_id` | UUID | NOT NULL, FK ke users(id) | ID pengirim |
| `sender_email` | TEXT | NOT NULL | Email pengirim |
| `receiver_id` | UUID | NOT NULL, FK ke users(id) | ID penerima |
| `receiver_email` | TEXT | NOT NULL | Email penerima |
| `content` | TEXT | NOT NULL | Isi pesan |
| `read` | BOOLEAN | DEFAULT false | Status sudah dibaca |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu dikirim |

**Indexes:**
- `idx_messages_order_id` pada `order_id`
- `idx_messages_sender_email` pada `sender_email`
- `idx_messages_receiver_email` pada `receiver_email`
- `idx_messages_created_at` pada `created_at ASC`

---

### 4. Tabel `user_stats` (Extend dari yang sudah ada atau buat baru)
**Deskripsi**: Statistik dan poin gamifikasi user

| Kolom | Tipe | Constraints | Deskripsi |
|-------|------|-------------|-----------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | ID unik |
| `user_id` | UUID | UNIQUE, NOT NULL, FK ke users(id) | ID user |
| `user_email` | TEXT | UNIQUE, NOT NULL | Email user |
| `total_items_sold` | INTEGER | DEFAULT 0 | Total barang yang dijual |
| `total_items_bought` | INTEGER | DEFAULT 0 | Total barang yang dibeli |
| `points_seller` | INTEGER | DEFAULT 0 | Poin sebagai penjual |
| `points_buyer` | INTEGER | DEFAULT 0 | Poin sebagai pembeli |
| `total_points` | INTEGER | DEFAULT 0 | Total poin (points_seller + points_buyer) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Waktu diupdate |

**Indexes:**
- `idx_user_stats_user_email` pada `user_email`
- `idx_user_stats_total_points` pada `total_points DESC` (untuk leaderboard)
- `idx_user_stats_points_seller` pada `points_seller DESC`
- `idx_user_stats_points_buyer` pada `points_buyer DESC`

---

## 🔌 Endpoint REST API (Node.js/Express)

### Marketplace Listings

#### 1. `GET /api/marketplace/listings`
**Deskripsi**: Ambil daftar listing dengan filter dan sort

**Query Parameters:**
- `keyword` (string, optional): Pencarian di title/description/tags
- `category` (string, optional): Filter kategori
- `city` (string, optional): Filter kota
- `district` (string, optional): Filter kecamatan
- `village` (string, optional): Filter desa
- `status` (string, optional): Filter status (default: 'active')
- `sort` (string, optional): Sort by ('newest', 'price_low', 'price_high', 'relevance', 'location')
- `page` (integer, optional): Halaman (default: 1)
- `limit` (integer, optional): Limit per halaman (default: 20, max: 100)

**Response:**
```json
{
  "listings": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### 2. `GET /api/marketplace/listings/:id`
**Deskripsi**: Ambil detail listing

**Response:**
```json
{
  "id": "uuid",
  "title": "...",
  "description": "...",
  "category": "...",
  "price": 0,
  "images": [...],
  "location": {...},
  "seller": {...},
  "status": "active"
}
```

#### 3. `POST /api/marketplace/listings`
**Deskripsi**: Buat listing baru (perlu auth)

**Body:**
```json
{
  "title": "...",
  "description": "...",
  "category": "...",
  "tags": [...],
  "price": 0,
  "images": [...],
  "location_city": "...",
  "location_district": "...",
  "location_village": "...",
  "use_ai": true  // Optional: generate dengan AI
}
```

**Headers:**
- `x-user-email`: Email user yang membuat listing

#### 4. `PUT /api/marketplace/listings/:id`
**Deskripsi**: Update listing (hanya owner)

#### 5. `DELETE /api/marketplace/listings/:id`
**Deskripsi**: Hapus listing (hanya owner, soft delete: set status='inactive')

---

### Marketplace Orders

#### 6. `POST /api/marketplace/orders`
**Deskripsi**: Buat order baru (Ajukan Pembelian)

**Body:**
```json
{
  "listing_id": "uuid"
}
```

**Headers:**
- `x-user-email`: Email pembeli

**Response:**
```json
{
  "order": {...},
  "message": "Order berhasil dibuat"
}
```

#### 7. `GET /api/marketplace/orders`
**Deskripsi**: Ambil daftar order user (buyer atau seller)

**Query Parameters:**
- `role` (string, optional): 'buyer' atau 'seller' (default: 'buyer')
- `status` (string, optional): Filter status
- `page`, `limit`: Pagination

**Headers:**
- `x-user-email`: Email user

#### 8. `GET /api/marketplace/orders/:id`
**Deskripsi**: Ambil detail order

#### 9. `PUT /api/marketplace/orders/:id/status`
**Deskripsi**: Update status order

**Body:**
```json
{
  "status": "deal" | "done" | "canceled",
  "cod_location": "...",  // Optional
  "cod_time": "..."       // Optional
}
```

**Note**: 
- Hanya seller bisa update ke 'done'
- Update ke 'done' akan trigger:
  - Update listing status ke 'sold'
  - Update user_stats (tambah poin)

---

### Marketplace Messages

#### 10. `POST /api/marketplace/messages`
**Deskripsi**: Kirim pesan baru

**Body:**
```json
{
  "order_id": "uuid",
  "content": "Pesan..."
}
```

**Headers:**
- `x-user-email`: Email pengirim

#### 11. `GET /api/marketplace/messages/:order_id`
**Deskripsi**: Ambil semua pesan untuk order tertentu

**Query Parameters:**
- `page`, `limit`: Pagination (optional)

**Headers:**
- `x-user-email`: Email user (untuk validasi akses)

**Response:**
```json
{
  "messages": [...],
  "order": {...}
}
```

#### 12. `PUT /api/marketplace/messages/:id/read`
**Deskripsi**: Tandai pesan sebagai sudah dibaca

---

### Gamification & Stats

#### 13. `GET /api/marketplace/stats/:user_email`
**Deskripsi**: Ambil statistik user

**Response:**
```json
{
  "total_items_sold": 10,
  "total_items_bought": 5,
  "points_seller": 100,
  "points_buyer": 50,
  "total_points": 150
}
```

#### 14. `GET /api/marketplace/leaderboard`
**Deskripsi**: Ambil leaderboard

**Query Parameters:**
- `type` (string, optional): 'seller', 'buyer', atau 'all' (default: 'all')
- `limit` (integer, optional): Jumlah top users (default: 10)

**Response:**
```json
{
  "seller_leaderboard": [...],
  "buyer_leaderboard": [...]
}
```

---

### AI Integration (OpenAI)

#### 15. `POST /api/marketplace/ai/generate-listing`
**Deskripsi**: Generate listing dengan AI (judul, deskripsi, tags)

**Body:**
```json
{
  "image_url": "...",  // Optional: untuk generate dari gambar
  "category": "...",   // Optional
  "user_description": "..."  // Optional: deskripsi manual user
}
```

**Response:**
```json
{
  "title": "...",
  "description": "...",
  "tags": [...],
  "category": "..."
}
```

---

## 📄 Halaman Frontend

### Halaman Baru yang Perlu Dibuat

1. **`public/marketplace.html`**
   - Halaman utama marketplace
   - Daftar produk dengan grid/list view
   - Filter sidebar (kategori, lokasi)
   - Search bar
   - Sort dropdown
   - Pagination

2. **`public/marketplace-detail.html`**
   - Halaman detail produk
   - Gambar produk (carousel)
   - Info produk lengkap
   - Tombol "Ajukan Pembelian"
   - Info penjual

3. **`public/marketplace-create.html`**
   - Form create listing
   - Upload gambar
   - Input lokasi (kota, kecamatan, desa)
   - Toggle "Generate dengan AI"
   - Preview hasil AI

4. **`public/marketplace-orders.html`**
   - Daftar order user
   - Filter by status
   - Tab: "Sebagai Pembeli" / "Sebagai Penjual"
   - Link ke detail order

5. **`public/marketplace-order-detail.html`**
   - Detail order
   - Info listing
   - Chat interface
   - Tombol "Tandai Terjual" (untuk seller)
   - Status order

6. **`public/leaderboard.html`**
   - Leaderboard penjual
   - Leaderboard pembeli
   - Ranking dengan badge

### File JavaScript yang Perlu Dibuat

1. **`public/js/marketplace.js`**
   - Fungsi fetch listings dengan filter
   - Render listing cards
   - Handle search, filter, sort
   - Pagination logic

2. **`public/js/marketplace-detail.js`**
   - Fetch detail listing
   - Handle "Ajukan Pembelian"
   - Render detail

3. **`public/js/marketplace-create.js`**
   - Form validation
   - Upload gambar (preview)
   - Call AI generate endpoint
   - Submit listing

4. **`public/js/marketplace-orders.js`**
   - Fetch orders
   - Render order list
   - Filter by status

5. **`public/js/marketplace-chat.js`**
   - Fetch messages
   - Send message
   - Real-time polling (setInterval)
   - Mark as read

6. **`public/js/leaderboard.js`**
   - Fetch leaderboard
   - Render ranking

### File CSS yang Perlu Dibuat/Diupdate

1. **`public/css/marketplace.css`**
   - Styling untuk marketplace pages
   - Grid layout untuk listing cards
   - Filter sidebar
   - Chat interface styling

2. **Update `public/css/common.css`**
   - Tambah utility classes untuk marketplace
   - Badge styles untuk kategori/status

---

## 🔄 Flow Aplikasi

### Flow 1: Create Listing
```
User → marketplace-create.html
  → Input data / Upload gambar
  → (Optional) Generate dengan AI
  → Submit → POST /api/marketplace/listings
  → Redirect ke marketplace-detail.html
```

### Flow 2: Browse & Search
```
User → marketplace.html
  → Filter/Search → GET /api/marketplace/listings
  → Render listing cards
  → Click card → marketplace-detail.html
```

### Flow 3: Ajukan Pembelian
```
User → marketplace-detail.html
  → Click "Ajukan Pembelian"
  → POST /api/marketplace/orders
  → Create order (status: 'pending')
  → Redirect ke marketplace-order-detail.html
```

### Flow 4: Chat & Deal
```
User → marketplace-order-detail.html
  → Load messages → GET /api/marketplace/messages/:order_id
  → Send message → POST /api/marketplace/messages
  → Polling messages setiap 3 detik
  → Seller update status → PUT /api/marketplace/orders/:id/status
```

### Flow 5: Tandai Terjual
```
Seller → marketplace-order-detail.html
  → Click "Tandai Terjual"
  → PUT /api/marketplace/orders/:id/status (status: 'done')
  → Backend:
    - Update order status
    - Update listing status → 'sold'
    - Update user_stats (tambah poin seller & buyer)
```

---

## 🎯 Poin Gamifikasi

### Aturan Poin:
- **Seller**: +10 poin per barang terjual
- **Buyer**: +5 poin per barang dibeli
- **Bonus**: +5 poin jika total_items_sold >= 10 (seller)
- **Bonus**: +5 poin jika total_items_bought >= 5 (buyer)

### Trigger:
- Saat order status berubah ke 'done'
- Update `user_stats` table
- Recalculate `total_points`

---

## 🔐 Security & Validation

1. **Authentication**: 
   - Semua endpoint create/update/delete perlu `x-user-email` header
   - Validasi user exists di database

2. **Authorization**:
   - Hanya owner bisa edit/delete listing
   - Hanya buyer/seller yang terlibat bisa akses order
   - Hanya participant order bisa kirim/lihat messages

3. **Input Validation**:
   - Validate email format
   - Validate UUID format
   - Sanitize text input
   - Validate image URLs/upload

4. **Rate Limiting**:
   - Limit create listing: 10 per jam
   - Limit send message: 20 per menit
   - Limit create order: 5 per jam

---

## 📝 Catatan Implementasi

1. **OpenAI Integration**:
   - Gunakan `openai` client yang sudah ada di `server.js`
   - Buat helper function di `server.js` atau file terpisah
   - Prompt engineering untuk generate listing yang relevan

2. **Supabase Integration**:
   - Gunakan `supabase` client yang sudah ada
   - Semua operasi database melalui Supabase
   - Handle error dengan fallback jika perlu

3. **Image Upload**:
   - Untuk MVP: simpan URL gambar (user upload ke external service)
   - Atau: implementasi upload ke Supabase Storage (future)

4. **Real-time Chat**:
   - MVP: Polling setiap 3 detik
   - Future: WebSocket atau Supabase Realtime

5. **Pagination**:
   - Implementasi server-side pagination
   - Limit default: 20 items per page

---

## 🚀 Prioritas Implementasi

### Phase 1: Core Marketplace (MVP)
1. ✅ Tabel database (listings, orders, messages, user_stats)
2. ✅ Endpoint: GET listings (dengan filter)
3. ✅ Endpoint: GET/POST listing detail
4. ✅ Halaman: marketplace.html (browse)
5. ✅ Halaman: marketplace-detail.html

### Phase 2: Order & Chat
6. ✅ Endpoint: POST order (Ajukan Pembelian)
7. ✅ Endpoint: GET/POST messages
8. ✅ Halaman: marketplace-order-detail.html
9. ✅ Chat interface dengan polling

### Phase 3: Create Listing & AI
10. ✅ Endpoint: POST listing (create)
11. ✅ Endpoint: AI generate listing
12. ✅ Halaman: marketplace-create.html

### Phase 4: Gamification
13. ✅ Update user_stats saat order done
14. ✅ Endpoint: GET leaderboard
15. ✅ Halaman: leaderboard.html
16. ✅ Update profile.js untuk tampilkan stats

---

## ❓ Pertanyaan untuk User

1. **Image Upload**: Apakah ingin implementasi upload gambar ke Supabase Storage, atau cukup URL gambar dari external service untuk MVP?

2. **AI Generate**: Apakah ingin generate dari gambar (vision API) atau cukup dari text description?

3. **Lokasi**: Apakah perlu validasi lokasi (kota/kecamatan/desa) atau cukup free text?

4. **Pricing**: Apakah semua barang bisa gratis (price = 0) atau ada minimum price?

5. **Order Status**: Apakah perlu status tambahan seperti 'shipped' atau cukup 'pending', 'deal', 'done', 'canceled'?

---

**Silakan review rencana ini dan beri feedback. Setelah disetujui, saya akan mulai implementasi secara bertahap sesuai prioritas di atas.**

