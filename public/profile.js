const USER_STORAGE_KEY = "sampahKuPilahUser";
const DETECTION_HISTORY_KEY = "sampahKuPilah:detectionHistory";
const LAST_DETECTIONS_KEY = "sampahKuPilah:lastDetections";

// Fungsi untuk mendapatkan data user dari localStorage
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Gagal membaca sesi pengguna:", err);
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

// Fungsi untuk mendapatkan inisial dari nama
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Fungsi untuk update avatar
function updateAvatar(user, targetElement = "profile") {
  const isNavbar = targetElement === "navbar";
  const initialsId = isNavbar ? "avatarInitials" : "profileAvatarInitials";
  const imageId = isNavbar ? "avatarImage" : "profileAvatarImage";
  const circleId = isNavbar ? "avatarCircle" : "profileAvatarLarge";
  
  const avatarInitials = document.getElementById(initialsId);
  const avatarImage = document.getElementById(imageId);
  const avatarCircle = document.getElementById(circleId);
  
  if (!avatarInitials || !avatarImage || !avatarCircle) return;
  
  if (user && user.email) {
    // Jika ada foto profil, gunakan foto
    if (user.picture) {
      avatarImage.src = user.picture;
      avatarImage.classList.remove("hidden");
      avatarInitials.classList.add("hidden");
    } else {
      // Jika tidak ada foto, gunakan inisial
      const name = user.name || user.email;
      const initials = getInitials(name);
      avatarInitials.textContent = initials;
      avatarInitials.classList.remove("hidden");
      avatarImage.classList.add("hidden");
    }
  }
}

// Fungsi untuk memuat data user dan menampilkannya
function loadUserProfile() {
  const user = getStoredUser();
  
  if (!user) {
    // Jika tidak ada user, redirect ke login
    window.location.href = "login.html";
    return;
  }
  
  // Update navbar avatar
  updateAvatar(user, "navbar");
  
  // Update profile avatar besar
  updateAvatar(user, "profile");
  
  // Tampilkan informasi user
  document.getElementById("userFullName").textContent = user.name || user.email.split("@")[0];
  document.getElementById("userEmail").textContent = user.email;
  
  // Set nilai form edit
  document.getElementById("editName").value = user.name || user.email.split("@")[0];
  document.getElementById("editEmail").value = user.email;
}

// Fungsi untuk mendapatkan riwayat deteksi dari localStorage (fallback)
function getLocalStorageHistory() {
  try {
    const historyRaw = localStorage.getItem(DETECTION_HISTORY_KEY);
    if (historyRaw) {
      return JSON.parse(historyRaw);
    }
    
    // Jika tidak ada history khusus, coba ambil dari lastDetections
    const lastDetectionsRaw = localStorage.getItem(LAST_DETECTIONS_KEY);
    if (lastDetectionsRaw) {
      const labels = JSON.parse(lastDetectionsRaw);
      // Konversi ke format history
      return labels.map((label, index) => ({
        id: Date.now() - (labels.length - index) * 86400000, // Simulasi tanggal
        category: label,
        date: new Date(Date.now() - (labels.length - index) * 86400000).toISOString()
      }));
    }
    
    return [];
  } catch (err) {
    console.warn("Gagal membaca riwayat deteksi dari localStorage:", err);
    return [];
  }
}

// Fungsi untuk mendapatkan riwayat deteksi (prioritas: Supabase, fallback: localStorage)
async function getDetectionHistory() {
  const user = getStoredUser();
  if (!user || !user.email) {
    // Jika tidak ada user, gunakan localStorage
    return getLocalStorageHistory();
  }

  try {
    // Ambil dari Supabase
    const response = await fetch(`/api/detections?email=${encodeURIComponent(user.email)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data.detections && data.detections.length > 0) {
      // Konversi format Supabase ke format yang diharapkan
      return data.detections.map(d => ({
        id: d.id,
        date: d.created_at,
        category: d.category || d.bin_name?.toLowerCase() || "unknown",
        bin: d.category,
        confidence: d.confidence || null,
        reason: d.reason || null,
        label: d.bin_name || d.category
      }));
    }
    
    // Jika Supabase kosong, fallback ke localStorage
    return getLocalStorageHistory();
  } catch (err) {
    console.warn("Gagal mengambil riwayat dari Supabase, menggunakan localStorage:", err);
    // Fallback ke localStorage jika Supabase error
    return getLocalStorageHistory();
  }
}

// Fungsi untuk menghitung statistik
function calculateStatistics(history) {
  if (!history || history.length === 0) {
    return {
      total: 0,
      mostCommon: null,
      lastDate: null
    };
  }
  
  // Hitung kategori paling sering
  const categoryCount = {};
  history.forEach(item => {
    const category = item.category || item.bin || "unknown";
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });
  
  const mostCommon = Object.keys(categoryCount).reduce((a, b) => 
    categoryCount[a] > categoryCount[b] ? a : b
  );
  
  // Tanggal terakhir
  const sortedHistory = [...history].sort((a, b) => {
    const dateA = new Date(a.date || a.id || 0);
    const dateB = new Date(b.date || b.id || 0);
    return dateB - dateA;
  });
  
  const lastDate = sortedHistory.length > 0 ? sortedHistory[0].date || sortedHistory[0].id : null;
  
  return {
    total: history.length,
    mostCommon: formatCategory(mostCommon),
    lastDate: lastDate ? formatDate(new Date(lastDate)) : null
  };
}

// Fungsi untuk format tanggal
function formatDate(date) {
  if (!date || isNaN(date.getTime())) return "-";
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('id-ID', options);
}

// Fungsi untuk menampilkan statistik
async function displayStatistics() {
  const history = await getDetectionHistory(); // Tambahkan await karena sekarang async
  const stats = calculateStatistics(history);
  
  document.getElementById("totalDetections").textContent = stats.total;
  document.getElementById("mostCommonCategory").textContent = stats.mostCommon || "-";
  document.getElementById("lastDetectionDate").textContent = stats.lastDate || "-";
}

// Fungsi untuk mendapatkan rekomendasi video berdasarkan kategori
function getVideoRecommendation(category) {
  const recommendations = {
    "organik": "https://www.youtube.com/results?search_query=daur+ulang+sampah+organik",
    "plastik": "https://www.youtube.com/results?search_query=daur+ulang+sampah+plastik",
    "kertas": "https://www.youtube.com/results?search_query=daur+ulang+sampah+kertas",
    "logam": "https://www.youtube.com/results?search_query=daur+ulang+sampah+logam",
    "kaca": "https://www.youtube.com/results?search_query=daur+ulang+sampah+kaca",
    "inorganik": "https://www.youtube.com/results?search_query=daur+ulang+sampah+anorganik",
    "anorganik": "https://www.youtube.com/results?search_query=daur+ulang+sampah+anorganik",
    "hijau": "https://www.youtube.com/results?search_query=daur+ulang+sampah+organik",
    "kuning": "https://www.youtube.com/results?search_query=daur+ulang+sampah+anorganik",
    "biru": "https://www.youtube.com/results?search_query=daur+ulang+sampah+kertas",
    "merah": "https://www.youtube.com/results?search_query=daur+ulang+sampah+berbahaya",
    "abu-abu": "https://www.youtube.com/results?search_query=daur+ulang+sampah+residu",
    "residu": "https://www.youtube.com/results?search_query=daur+ulang+sampah+residu"
  };
  
  const normalizedCategory = (category || "").toLowerCase();
  return recommendations[normalizedCategory] || recommendations["inorganik"];
}

// Fungsi untuk format kategori untuk display
function formatCategory(category) {
  if (!category) return "Unknown";
  const categoryMap = {
    "organik": "Organik",
    "plastik": "Plastik",
    "kertas": "Kertas",
    "logam": "Logam",
    "kaca": "Kaca",
    "inorganik": "Anorganik",
    "anorganik": "Anorganik",
    "hijau": "Organik",
    "kuning": "Anorganik",
    "biru": "Kertas",
    "merah": "B3",
    "abu-abu": "Residu",
    "residu": "Residu"
  };
  
  const normalized = category.toLowerCase();
  return categoryMap[normalized] || category.charAt(0).toUpperCase() + category.slice(1);
}

// Fungsi untuk menampilkan riwayat deteksi
async function displayDetectionHistory() {
  const history = await getDetectionHistory(); // Tambahkan await karena sekarang async
  const tbody = document.getElementById("historyTableBody");
  
  if (!tbody) return;
  
  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="no-history-message">
          <i class="fas fa-info-circle"></i>
          <span>Belum ada riwayat deteksi</span>
        </td>
      </tr>
    `;
    return;
  }
  
  // Sort berdasarkan tanggal terbaru
  const sortedHistory = [...history].sort((a, b) => {
    const dateA = new Date(a.date || a.id || 0);
    const dateB = new Date(b.date || b.id || 0);
    return dateB - dateA;
  });
  
  tbody.innerHTML = sortedHistory.map(item => {
    const date = item.date ? new Date(item.date) : (item.id ? new Date(item.id) : new Date());
    const category = item.category || item.bin || "unknown";
    const videoUrl = getVideoRecommendation(category);
    const formattedDate = formatDate(date);
    const formattedCategory = formatCategory(category);
    
    return `
      <tr>
        <td>${formattedDate}</td>
        <td><span class="category-badge category-${category.toLowerCase()}">${formattedCategory}</span></td>
        <td>
          <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="video-link">
            <i class="fas fa-play-circle"></i> Lihat Video
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

// Fungsi untuk handle ganti foto
function handleChangePhoto() {
  const photoInput = document.getElementById("photoInput");
  if (!photoInput) return;
  
  photoInput.click();
  
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      if (window.notification) {
        window.notification.error("File harus berupa gambar");
      } else {
        alert("File harus berupa gambar");
      }
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      
      // Update avatar preview
      const avatarImage = document.getElementById("profileAvatarImage");
      const avatarInitials = document.getElementById("profileAvatarInitials");
      
      if (avatarImage && avatarInitials) {
        avatarImage.src = imageUrl;
        avatarImage.classList.remove("hidden");
        avatarInitials.classList.add("hidden");
      }
      
      // Simpan ke localStorage (preview only, tidak ada backend)
      const user = getStoredUser();
      if (user) {
        user.picture = imageUrl;
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        
        // Update navbar avatar juga
        updateAvatar(user, "navbar");
        
        if (window.notification) {
          window.notification.success("Foto profil berhasil diubah");
        }
      }
    };
    reader.readAsDataURL(file);
  });
}

// Fungsi untuk handle edit profil
function handleEditProfile() {
  const modal = document.getElementById("editProfileModal");
  if (modal) {
    modal.classList.remove("hidden");
  }
}

// Fungsi untuk handle simpan edit profil
function handleSaveProfile(e) {
  e.preventDefault();
  
  const name = document.getElementById("editName").value.trim();
  if (!name) {
    if (window.notification) {
      window.notification.error("Nama tidak boleh kosong");
    } else {
      alert("Nama tidak boleh kosong");
    }
    return;
  }
  
  const user = getStoredUser();
  if (user) {
    user.name = name;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    
    // Update tampilan
    document.getElementById("userFullName").textContent = name;
    updateAvatar(user, "profile");
    updateAvatar(user, "navbar");
    
    // Tutup modal
    const modal = document.getElementById("editProfileModal");
    if (modal) {
      modal.classList.add("hidden");
    }
    
    if (window.notification) {
      window.notification.success("Profil berhasil diperbarui");
    }
  }
}

// Fungsi untuk handle logout
function handleLogout() {
  if (confirm("Apakah Anda yakin ingin keluar?")) {
    localStorage.removeItem(USER_STORAGE_KEY);
    window.location.href = "index.html";
  }
}

// Load marketplace stats
async function loadMarketplaceStats() {
  const user = getStoredUser();
  if (!user || !user.email) return;

  try {
    const response = await fetch(`/api/marketplace/stats/${encodeURIComponent(user.email)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const stats = await response.json();

    // Update UI
    const totalItemsSoldEl = document.getElementById("totalItemsSold");
    const totalItemsBoughtEl = document.getElementById("totalItemsBought");
    const totalPointsEl = document.getElementById("totalPoints");

    if (totalItemsSoldEl) totalItemsSoldEl.textContent = stats.total_items_sold || 0;
    if (totalItemsBoughtEl) totalItemsBoughtEl.textContent = stats.total_items_bought || 0;
    if (totalPointsEl) totalPointsEl.textContent = stats.total_points || 0;
  } catch (err) {
    console.warn("Gagal mengambil statistik marketplace:", err);
    // Set default values
    const totalItemsSoldEl = document.getElementById("totalItemsSold");
    const totalItemsBoughtEl = document.getElementById("totalItemsBought");
    const totalPointsEl = document.getElementById("totalPoints");
    if (totalItemsSoldEl) totalItemsSoldEl.textContent = "0";
    if (totalItemsBoughtEl) totalItemsBoughtEl.textContent = "0";
    if (totalPointsEl) totalPointsEl.textContent = "0";
  }
}

// Inisialisasi saat halaman dimuat
document.addEventListener("DOMContentLoaded", async () => {
  // Load user profile
  loadUserProfile();
  
  // Display statistics (async)
  await displayStatistics();
  
  // Display detection history (async)
  await displayDetectionHistory();

  // Load marketplace stats
  await loadMarketplaceStats();
  
  // Event listeners
  const changePhotoBtn = document.getElementById("changePhotoBtn");
  if (changePhotoBtn) {
    changePhotoBtn.addEventListener("click", handleChangePhoto);
  }
  
  const editProfileBtn = document.getElementById("editProfileBtn");
  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", handleEditProfile);
  }
  
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
  
  const editProfileForm = document.getElementById("editProfileForm");
  if (editProfileForm) {
    editProfileForm.addEventListener("submit", handleSaveProfile);
  }
  
  const closeEditModal = document.getElementById("closeEditModal");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const modal = document.getElementById("editProfileModal");
  
  if (closeEditModal) {
    closeEditModal.addEventListener("click", () => {
      if (modal) modal.classList.add("hidden");
    });
  }
  
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      if (modal) modal.classList.add("hidden");
    });
  }
  
  // Close modal ketika klik overlay
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }
});

