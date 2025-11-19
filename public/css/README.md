# CSS Architecture - SampahKuPilah

## 📂 Struktur File CSS

File CSS telah dipecah menjadi 4 file terpisah untuk meningkatkan maintainability dan performance:

```
public/css/
├── common.css      # Shared styles untuk semua halaman
├── landing.css     # Styles khusus untuk landing page (index.html)
├── auth.css        # Styles untuk login & register pages
└── dashboard.css   # Styles untuk dashboard/welcome page
```

## 📄 Detail File

### 1. **common.css** (~400 lines)
**Digunakan oleh:** Semua halaman

**Berisi:**
- CSS Variables (colors, gradients, borders, shadows, dll)
- Keyframe animations (gridMove, fadeIn, neonPulse, dll)
- Utility classes (.fade-in, .hidden)
- Shared form styles (input-group, input, label)
- Shared button styles (.btn, .divider, .small-btn)
- Shared container styles (.container)
- Responsive utilities

**Contoh penggunaan:**
```html
<link rel="stylesheet" href="css/common.css">
```

---

### 2. **landing.css** (~1200 lines)
**Digunakan oleh:** `index.html` (Landing Page)

**Berisi:**
- Landing body & background styles
- Navigation (.landing-nav, .nav-brand, .nav-button)
- Hero section (.hero, .hero-content, .hero-visual)
- Features section (.features, .feature-grid, .feature-card)
- Workflow section (.workflow, .workflow-steps)
- Download section (.download-card, .phone-mockup)
- AI Chat widget (.ai-chat-toggle, .ai-chat-panel)
- Responsive design untuk landing page

**Contoh penggunaan:**
```html
<link rel="stylesheet" href="css/common.css">
<link rel="stylesheet" href="css/landing.css">
```

---

### 3. **auth.css** (~300 lines)
**Digunakan oleh:** `login.html`, `register.html`

**Berisi:**
- Auth page body (.login-body)
- Header (.login-header, .logo-section)
- Main content (.login-main, .login-container)
- Form components (.form-header, .login-form)
- Google button (.google-btn)
- Form footer (.form-footer)
- Legacy support untuk body:not(.dashboard-body)
- Responsive design untuk auth pages

**Contoh penggunaan:**
```html
<link rel="stylesheet" href="css/common.css">
<link rel="stylesheet" href="css/auth.css">
```

---

### 4. **dashboard.css** (~800 lines)
**Digunakan oleh:** `welcome.html` (Dashboard)

**Berisi:**
- Dashboard body (.dashboard-body)
- Dashboard header (.dashboard-header, .header-content, .logout-btn)
- Dashboard main layout (.dashboard-main - grid 2fr 1fr)
- Camera section (.camera-section, .video-container, .camera-controls)
- Results section (.results-section, .detection-card)
- Waste bin recommendation (.bin-recommendation, .waste-bin)
- Detection history (.detection-history, .history-item)
- Responsive design untuk dashboard

**Contoh penggunaan:**
```html
<link rel="stylesheet" href="css/common.css">
<link rel="stylesheet" href="css/dashboard.css">
```

---

## 🔄 Migrasi dari style.css

File `style.css` lama (~2700 lines) telah dipecah dan dioptimasi:

| File Lama | File Baru | Lines |
|-----------|-----------|-------|
| style.css (ALL) | common.css | ~400 |
| style.css (landing) | landing.css | ~1200 |
| style.css (auth) | auth.css | ~300 |
| style.css (dashboard) | dashboard.css | ~800 |
| **TOTAL** | **~2700** | **~2700** |

**Backup:** File lama disimpan sebagai `style.css.backup`

---

## ✅ Keuntungan Arsitektur Baru

### 1. **Performance**
- Browser hanya load CSS yang dibutuhkan per halaman
- Mengurangi ukuran CSS yang di-download
- Faster initial page load

### 2. **Maintainability**
- Lebih mudah menemukan & edit styles spesifik
- Clear separation of concerns
- Mengurangi CSS conflicts

### 3. **Scalability**
- Mudah menambah halaman baru
- Reusable common styles via common.css
- Modular architecture

### 4. **Development**
- Easier code review
- Better collaboration
- Clear file organization

---

## 🎨 CSS Variables (dari common.css)

Gunakan CSS variables yang sudah didefinisikan untuk konsistensi:

```css
/* Colors */
var(--color-cyan)
var(--color-magenta)
var(--color-green)
var(--color-blue)
var(--color-red)

/* Gradients */
var(--gradient-radial-1)
var(--gradient-linear-dark)

/* Borders */
var(--border-cyan)
var(--border-magenta)

/* Shadows */
var(--shadow-cyan)
var(--shadow-green)

/* Backdrop */
var(--backdrop-blur)
```

---

## 🔧 Cara Menambah Halaman Baru

1. Buat file HTML baru (e.g., `about.html`)
2. Load `common.css` untuk shared styles
3. Buat file CSS baru jika perlu (e.g., `css/about.css`)
4. Link CSS files di HTML:

```html
<head>
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/about.css">
</head>
```

---

## 📝 Catatan

- **Jangan mengubah tampilan:** Semua refactoring dilakukan tanpa mengubah visual design
- **Mobile responsive:** Semua file sudah include responsive design
- **Browser compatibility:** Tested pada browser modern (Chrome, Firefox, Safari, Edge)
- **Font:** Menggunakan Montserrat dari Google Fonts (loaded di HTML)
- **Icons:** Menggunakan Font Awesome 6.0.0 (loaded di HTML)

---

## 🚀 Testing

Setelah refactoring:
1. ✅ Test semua halaman (index, login, register, welcome)
2. ✅ Test responsive design (mobile, tablet, desktop)
3. ✅ Test semua animasi & hover effects
4. ✅ Verify tidak ada visual regressions

---

**Dibuat:** Oktober 2024  
**Version:** 1.0.0  
**Maintainer:** SampahKuPilah Team


