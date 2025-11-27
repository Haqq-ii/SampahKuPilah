// marketplace.js - Marketplace Browse & Filter Logic

const USER_STORAGE_KEY = "sampahKuPilahUser";

// Supabase configuration
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_STORAGE_BUCKET = 'marketplace-images';

/**
 * Convert image path/object to public URL
 * Uses normalizeImage() internally for consistency
 */
function toPublicUrl(imagePath) {
  return normalizeImage(imagePath);
}

/**
 * Normalize single image item to URL string
 * Handles: JSON string, object, data URL, http URL, storage path
 */
function normalizeImage(img) {
  if (!img) return null;

  // If already a valid URL string
  if (typeof img === 'string') {
    const trimmed = img.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    // Might be JSON string
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeImage(parsed);
      } catch (e) {
        return trimmed.length > 0 ? trimmed : null;
      }
    }
    
    return trimmed.length > 0 ? trimmed : null;
  }

  // If object
  if (typeof img === 'object' && img !== null) {
    if (img.base64 && img.mimeType) {
      return `data:${img.mimeType};base64,${img.base64}`;
    }
    if (img.url) return img.url;
    if (img.src) return img.src;
    if (img.path) {
      const path = img.path.startsWith('/') ? img.path.slice(1) : img.path;
      if (SUPABASE_URL) {
        return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${path}`;
      }
      return path;
    }
    return null;
  }

  return null;
}

/**
 * Parse images array from Supabase response
 * Returns array of normalized URL strings
 */
function parseImages(images) {
  if (!images) {
    return [];
  }

  if (Array.isArray(images)) {
    return images
      .map(normalizeImage)
      .filter(url => url !== null && url.length > 0);
  }

  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return parseImages(parsed);
    } catch (e) {
      const normalized = normalizeImage(images);
      return normalized ? [normalized] : [];
    }
  }

  if (typeof images === 'object' && images !== null) {
    const normalized = normalizeImage(images);
    return normalized ? [normalized] : [];
  }

  return [];
}

// State management
let currentFilters = {
  keyword: "",
  category: "",
  city: "",
  district: "",
  village: "",
  status: "active",
  sort: "newest",
  page: 1,
  limit: 20
};

let paginationInfo = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
};

// Get user from localStorage
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// Fetch listings from API
async function fetchListings(filters = {}) {
  const params = new URLSearchParams();
  
  Object.keys(filters).forEach(key => {
    if (filters[key] && filters[key] !== "") {
      params.append(key, filters[key]);
    }
  });

  try {
    const response = await fetch(`/api/marketplace/listings?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("Error fetching listings:", err);
    if (window.notification) {
      window.notification.error("Gagal memuat data. Silakan coba lagi.");
    }
    return { listings: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
}

// Render listing card
function renderListingCard(listing) {
  console.log('[renderListingCard] Listing:', listing.id, 'Images:', listing.images);
  
  // Parse and get first valid image URL
  // parseImages() already returns normalized URLs
  const parsedImages = parseImages(listing.images);
  const imageUrl = parsedImages && parsedImages.length > 0 ? parsedImages[0] : null;
  
  if (imageUrl) {
    console.log('[renderListingCard] Using image URL:', imageUrl.substring(0, 100) + '...');
  }
  
  const price = listing.price && listing.price > 0 
    ? `Rp ${parseInt(listing.price).toLocaleString("id-ID")}` 
    : "Gratis";
  
  const location = [
    listing.location_province,
    listing.location_city,
    listing.location_district,
    listing.location_village
  ].filter(Boolean).join(", ") || "Lokasi tidak tersedia";

  return `
    <div class="listing-card" data-listing-id="${listing.id}">
      <div class="listing-image">
        ${imageUrl 
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(listing.title)}" onerror="console.error('Failed to load listing image:', '${escapeHtml(imageUrl)}'); this.onerror=null; this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>'">`
          : '<i class="fas fa-image"></i>'
        }
      </div>
      <div class="listing-content">
        <h3 class="listing-title">${escapeHtml(listing.title)}</h3>
        <p class="listing-description">${escapeHtml(listing.description)}</p>
        <div class="listing-meta">
          <span class="listing-badge">${escapeHtml(listing.category)}</span>
        </div>
        <div class="listing-location">
          <i class="fas fa-map-marker-alt"></i>
          <span>${escapeHtml(location)}</span>
        </div>
        <div class="listing-footer">
          <span class="listing-price ${listing.price === 0 ? 'free' : ''}">${price}</span>
        </div>
      </div>
    </div>
  `;
}

// Escape HTML untuk prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render listings grid
function renderListings(listings) {
  const grid = document.getElementById("listingsGrid");
  const emptyState = document.getElementById("emptyState");
  const loadingIndicator = document.getElementById("loadingIndicator");

  loadingIndicator.classList.add("hidden");

  if (!listings || listings.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  grid.innerHTML = listings.map(renderListingCard).join("");

  // Add click handlers
  grid.querySelectorAll(".listing-card").forEach(card => {
    card.addEventListener("click", () => {
      const listingId = card.dataset.listingId;
      window.location.href = `marketplace-detail.html?id=${listingId}`;
    });
  });
}

// Render pagination
function renderPagination(pagination) {
  const paginationEl = document.getElementById("pagination");
  paginationInfo = pagination;

  if (pagination.totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  let html = "";

  // Previous button
  html += `
    <button class="pagination-btn" ${pagination.page === 1 ? "disabled" : ""} 
            data-page="${pagination.page - 1}">
      <i class="fas fa-chevron-left"></i>
    </button>
  `;

  // Page numbers
  const maxPages = 5;
  let startPage = Math.max(1, pagination.page - Math.floor(maxPages / 2));
  let endPage = Math.min(pagination.totalPages, startPage + maxPages - 1);
  
  if (endPage - startPage < maxPages - 1) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }

  if (startPage > 1) {
    html += `<button class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      html += `<span class="pagination-info">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="pagination-btn ${i === pagination.page ? "active" : ""}" 
              data-page="${i}">
        ${i}
      </button>
    `;
  }

  if (endPage < pagination.totalPages) {
    if (endPage < pagination.totalPages - 1) {
      html += `<span class="pagination-info">...</span>`;
    }
    html += `<button class="pagination-btn" data-page="${pagination.totalPages}">${pagination.totalPages}</button>`;
  }

  // Next button
  html += `
    <button class="pagination-btn" ${pagination.page === pagination.totalPages ? "disabled" : ""} 
            data-page="${pagination.page + 1}">
      <i class="fas fa-chevron-right"></i>
    </button>
  `;

  // Info
  html += `
    <span class="pagination-info">
      Halaman ${pagination.page} dari ${pagination.totalPages} 
      (${pagination.total} barang)
    </span>
  `;

  paginationEl.innerHTML = html;

  // Add click handlers
  paginationEl.querySelectorAll(".pagination-btn:not(:disabled)").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.dataset.page);
      if (page && page !== currentFilters.page) {
        currentFilters.page = page;
        loadListings();
      }
    });
  });
}

// Load listings dengan current filters
async function loadListings() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  loadingIndicator.classList.remove("hidden");

  const data = await fetchListings(currentFilters);
  renderListings(data.listings);
  renderPagination(data.pagination);
}

// Apply filters
function applyFilters() {
  currentFilters.keyword = document.getElementById("searchKeyword")?.value.trim() || 
                          document.getElementById("mainSearchInput")?.value.trim() || "";
  currentFilters.category = document.getElementById("filterCategory")?.value || "";
  currentFilters.city = document.getElementById("filterCity")?.value.trim() || "";
  currentFilters.district = document.getElementById("filterDistrict")?.value.trim() || "";
  currentFilters.village = document.getElementById("filterVillage")?.value.trim() || "";
  currentFilters.sort = document.getElementById("sortSelect")?.value || "newest";
  currentFilters.page = 1; // Reset to first page

  loadListings();
}

// Reset filters
function resetFilters() {
  currentFilters = {
    keyword: "",
    category: "",
    city: "",
    district: "",
    village: "",
    status: "active",
    sort: "newest",
    page: 1,
    limit: 20
  };

  // Reset form inputs
  if (document.getElementById("searchKeyword")) {
    document.getElementById("searchKeyword").value = "";
  }
  if (document.getElementById("mainSearchInput")) {
    document.getElementById("mainSearchInput").value = "";
  }
  if (document.getElementById("filterCategory")) {
    document.getElementById("filterCategory").value = "";
  }
  if (document.getElementById("filterCity")) {
    document.getElementById("filterCity").value = "";
  }
  if (document.getElementById("filterDistrict")) {
    document.getElementById("filterDistrict").value = "";
  }
  if (document.getElementById("filterVillage")) {
    document.getElementById("filterVillage").value = "";
  }
  if (document.getElementById("sortSelect")) {
    document.getElementById("sortSelect").value = "newest";
  }

  loadListings();
}

// Toggle filters sidebar (mobile)
function toggleFiltersSidebar() {
  const sidebar = document.getElementById("filtersSidebar");
  sidebar.classList.toggle("open");
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Load initial listings
  loadListings();

  // Filter sidebar toggle (mobile)
  const toggleBtn = document.getElementById("toggleFiltersBtn");
  const closeBtn = document.getElementById("closeFiltersBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleFiltersSidebar);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", toggleFiltersSidebar);
  }

  // Apply filters button
  const applyBtn = document.getElementById("applyFiltersBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", applyFilters);
  }

  // Reset filters button
  const resetBtn = document.getElementById("resetFiltersBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetFilters);
  }

  // Search input (main search bar)
  const mainSearchInput = document.getElementById("mainSearchInput");
  if (mainSearchInput) {
    let searchTimeout;
    mainSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 500); // Debounce 500ms
    });
  }

  // Search input (filter sidebar)
  const filterSearchInput = document.getElementById("searchKeyword");
  if (filterSearchInput) {
    let searchTimeout;
    filterSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 500);
    });
  }

  // Sort select
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", applyFilters);
  }

  // Filter inputs (auto-apply on change)
  ["filterCategory", "filterCity", "filterDistrict", "filterVillage"].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", applyFilters);
    }
  });
});

