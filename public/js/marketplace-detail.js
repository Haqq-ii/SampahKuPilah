// marketplace-detail.js - Product Detail Page Logic

const USER_STORAGE_KEY = "sampahKuPilahUser";

// Supabase configuration (dari environment atau default)
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_STORAGE_BUCKET = 'marketplace-images'; // Default bucket name

// Get user from localStorage
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// Get listing ID from URL
function getListingIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// Escape HTML untuk prevent XSS
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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

  // If already a valid URL string (data URL or http URL)
  if (typeof img === 'string') {
    const trimmed = img.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    // Might be JSON string, try parse
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeImage(parsed); // Recursive
      } catch (e) {
        // Not JSON, might be path
        return trimmed.length > 0 ? trimmed : null;
      }
    }
    
    // Plain string (might be path)
    return trimmed.length > 0 ? trimmed : null;
  }

  // If object
  if (typeof img === 'object' && img !== null) {
    // Object with base64 (from old format)
    if (img.base64 && img.mimeType) {
      return `data:${img.mimeType};base64,${img.base64}`;
    }
    // Object with URL
    if (img.url) return img.url;
    if (img.src) return img.src;
    // Object with path
    if (img.path) {
      const path = img.path.startsWith('/') ? img.path.slice(1) : img.path;
      if (SUPABASE_URL) {
        return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${path}`;
      }
      return path;
    }
    // Unknown object format
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

  // If array, normalize each item
  if (Array.isArray(images)) {
    return images
      .map(normalizeImage)
      .filter(url => url !== null && url.length > 0);
  }

  // If string, try parse as JSON
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return parseImages(parsed); // Recursive
    } catch (e) {
      // Not JSON, treat as single image
      const normalized = normalizeImage(images);
      return normalized ? [normalized] : [];
    }
  }

  // If single object
  if (typeof images === 'object' && images !== null) {
    const normalized = normalizeImage(images);
    return normalized ? [normalized] : [];
  }

  return [];
}

// Fetch listing detail
async function fetchListingDetail(id) {
  try {
    const response = await fetch(`/api/marketplace/listings/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("Error fetching listing:", err);
    if (window.notification) {
      window.notification.error("Gagal memuat data produk. Silakan coba lagi.");
    }
    return null;
  }
}

// Render product images
function renderImages(images) {
  console.log('[renderImages] Raw images data:', images);
  
  const mainImage = document.getElementById("mainImage");
  const thumbnails = document.getElementById("imageThumbnails");

  if (!mainImage || !thumbnails) {
    console.error('[renderImages] Missing DOM elements: mainImage or imageThumbnails');
    return;
  }

  // Parse images array
  const parsedImages = parseImages(images);
  console.log('[renderImages] Parsed images:', parsedImages);

  if (!parsedImages || parsedImages.length === 0) {
    console.warn('[renderImages] No images found');
    mainImage.innerHTML = '<i class="fas fa-image"></i><span>Gambar tidak tersedia</span>';
    thumbnails.innerHTML = "";
    return;
  }

  // parsedImages already contains normalized URLs
  const validImages = parsedImages;

  console.log('[renderImages] Valid images URLs:', validImages);

  if (validImages.length === 0) {
    console.warn('[renderImages] No valid image URLs after conversion');
    mainImage.innerHTML = '<i class="fas fa-image"></i><span>Gambar tidak tersedia</span>';
    thumbnails.innerHTML = "";
    return;
  }

  // Main image - #mainImage should be a <div> container
  const firstImageUrl = validImages[0];
  const urlPreview = firstImageUrl.length > 100 ? firstImageUrl.substring(0, 100) + '...' : firstImageUrl;
  console.log('[renderImages] Rendering main image. URL preview:', urlPreview);
  console.log('[renderImages] URL starts with:', firstImageUrl.substring(0, 20));
  
  // Clear container first
  mainImage.innerHTML = "";
  
  const mainImg = document.createElement("img");
  mainImg.src = firstImageUrl;
  mainImg.alt = "Product image";
  mainImg.style.width = "100%";
  mainImg.style.height = "100%";
  mainImg.style.objectFit = "cover";
  mainImg.style.display = "block";
  
  mainImg.onerror = (e) => {
    console.error('[renderImages] Failed to load main image');
    console.error('[renderImages] URL type:', typeof firstImageUrl);
    console.error('[renderImages] URL length:', firstImageUrl.length);
    console.error('[renderImages] URL preview:', urlPreview);
    console.error('[renderImages] Error:', e);
    // Show placeholder
    mainImage.innerHTML = '<i class="fas fa-image"></i><span>Gambar tidak tersedia</span>';
  };
  
  mainImg.onload = () => {
    console.log('[renderImages] ✅ Main image loaded successfully');
  };
  
  mainImage.appendChild(mainImg);

  // Thumbnails
  if (validImages.length > 1) {
    thumbnails.innerHTML = validImages.map((imgUrl, index) => `
      <div class="thumbnail ${index === 0 ? 'active' : ''}" data-index="${index}">
        <img src="${escapeHtml(imgUrl)}" alt="Thumbnail ${index + 1}" onerror="console.error('Failed to load thumbnail:', '${escapeHtml(imgUrl)}'); this.parentElement.style.display='none'">
      </div>
    `).join("");

    // Add click handlers for thumbnails
    thumbnails.querySelectorAll(".thumbnail").forEach(thumb => {
      thumb.addEventListener("click", () => {
        const index = parseInt(thumb.dataset.index);
        const selectedImageUrl = validImages[index];
        const urlPreview = selectedImageUrl.length > 100 ? selectedImageUrl.substring(0, 100) + '...' : selectedImageUrl;
        console.log('[renderImages] Thumbnail clicked, switching to:', urlPreview);
        
        // Clear and create new image
        mainImage.innerHTML = "";
        const newMainImg = document.createElement("img");
        newMainImg.src = selectedImageUrl;
        newMainImg.alt = "Product image";
        newMainImg.style.width = "100%";
        newMainImg.style.height = "100%";
        newMainImg.style.objectFit = "cover";
        newMainImg.style.display = "block";
        newMainImg.onerror = (e) => {
          console.error('[renderImages] Failed to load selected image:', urlPreview);
          mainImage.innerHTML = '<i class="fas fa-image"></i><span>Gambar tidak tersedia</span>';
        };
        newMainImg.onload = () => {
          console.log('[renderImages] ✅ Selected image loaded');
        };
        mainImage.appendChild(newMainImg);
        
        // Update active thumbnail
        thumbnails.querySelectorAll(".thumbnail").forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");
      });
    });
    console.log('[renderImages] Thumbnails rendered:', validImages.length - 1);
  } else {
    thumbnails.innerHTML = "";
  }
}

// Render product detail
function renderProductDetail(listing) {
  const loadingIndicator = document.getElementById("loadingIndicator");
  const productDetail = document.getElementById("productDetail");
  const errorState = document.getElementById("errorState");

  loadingIndicator.classList.add("hidden");
  errorState.classList.add("hidden");
  productDetail.classList.remove("hidden");

  // Title
  document.getElementById("productTitle").textContent = listing.title || "-";

  // Status badge
  const statusBadge = document.getElementById("productStatus");
  const status = listing.status || "active";
  statusBadge.textContent = status === "active" ? "Tersedia" : status === "sold" ? "Terjual" : status;
  statusBadge.className = `product-status-badge status-${status}`;

  // Price
  const priceEl = document.getElementById("productPrice");
  if (listing.price && listing.price > 0) {
    priceEl.textContent = `Rp ${parseInt(listing.price).toLocaleString("id-ID")}`;
    priceEl.classList.remove("free");
  } else {
    priceEl.textContent = "Gratis";
    priceEl.classList.add("free");
  }

  // Category
  document.getElementById("productCategory").textContent = listing.category || "-";

  // Location
  const locationParts = [
    listing.location_province,
    listing.location_city,
    listing.location_district,
    listing.location_village
  ].filter(Boolean);
  document.getElementById("productLocation").textContent = 
    locationParts.length > 0 ? locationParts.join(", ") : "Lokasi tidak tersedia";

  // Seller
  const sellerName = listing.seller?.name || listing.seller_email?.split("@")[0] || "-";
  document.getElementById("productSeller").textContent = sellerName;

  // Tags
  const tagsEl = document.getElementById("productTags");
  const tagsContainer = document.getElementById("productTagsContainer");
  if (listing.tags && listing.tags.length > 0) {
    tagsEl.innerHTML = listing.tags.map(tag => 
      `<span class="tag">${escapeHtml(tag)}</span>`
    ).join("");
    if (tagsContainer) tagsContainer.classList.remove("hidden");
  } else {
    tagsEl.innerHTML = "";
    if (tagsContainer) tagsContainer.classList.add("hidden");
  }

  // Description
  document.getElementById("productDescription").textContent = listing.description || "Tidak ada deskripsi";

  // Images - ensure images is included in response
  console.log('[renderProductDetail] Listing data:', listing);
  console.log('[renderProductDetail] Listing images:', listing.images);
  renderImages(listing.images);

  // Action buttons
  renderActionButtons(listing);
}

// Render action buttons based on user role
function renderActionButtons(listing) {
  const actionsEl = document.getElementById("productActions");
  const user = getStoredUser();
  const isOwner = user && listing.seller_email && 
    user.email.toLowerCase() === listing.seller_email.toLowerCase();
  const isAvailable = listing.status === "active";

  let html = "";

  if (!user) {
    html = `
      <a href="login.html" class="btn btn-primary" style="width: 100%;">
        <i class="fas fa-sign-in-alt"></i> Login untuk Membeli
      </a>
    `;
  } else if (isOwner) {
    html = `
      <button class="btn btn-secondary" style="width: 100%;" disabled>
        <i class="fas fa-info-circle"></i> Ini adalah produk Anda
      </button>
      <a href="marketplace-orders.html?role=seller" class="btn btn-secondary" style="width: 100%; margin-top: var(--spacing-3);">
        <i class="fas fa-shopping-cart"></i> Lihat Pesanan
      </a>
      <button class="btn btn-secondary" id="deleteButton" style="width: 100%; margin-top: var(--spacing-3); background: rgba(244, 67, 54, 0.1); color: #c62828; border-color: rgba(244, 67, 54, 0.3);">
        <i class="fas fa-trash"></i> Hapus Produk
      </button>
    `;
  } else if (!isAvailable) {
    html = `
      <button class="btn btn-secondary" style="width: 100%;" disabled>
        <i class="fas fa-times-circle"></i> Produk Tidak Tersedia
      </button>
    `;
  } else {
    html = `
      <button class="btn btn-primary" id="buyButton" style="width: 100%;">
        <i class="fas fa-shopping-cart"></i> Ajukan Pembelian
      </button>
    `;
  }

  actionsEl.innerHTML = html;

  // Add buy button handler
  const buyButton = document.getElementById("buyButton");
  if (buyButton) {
    buyButton.addEventListener("click", handleBuyButton);
  }

  // Add delete button handler
  const deleteButton = document.getElementById("deleteButton");
  if (deleteButton) {
    deleteButton.addEventListener("click", handleDeleteButton);
  }
}

// Handle delete button click
async function handleDeleteButton() {
  const listingId = getListingIdFromURL();
  const user = getStoredUser();

  if (!user || !user.email) {
    window.location.href = "login.html";
    return;
  }

  if (!listingId) {
    if (window.notification) {
      window.notification.error("ID produk tidak valid");
    }
    return;
  }

  // Konfirmasi hapus
  const confirmed = confirm("Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.");
  if (!confirmed) {
    return;
  }

  const deleteButton = document.getElementById("deleteButton");
  if (deleteButton) {
    deleteButton.disabled = true;
    deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus...';
  }

  try {
    const response = await fetch(`/api/marketplace/listings/${listingId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": user.email
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Gagal menghapus produk");
    }

    if (window.notification) {
      window.notification.success("Produk berhasil dihapus! Redirecting...");
    }

    // Redirect ke marketplace
    setTimeout(() => {
      window.location.href = "marketplace.html";
    }, 1500);
  } catch (err) {
    console.error("Error deleting listing:", err);
    if (window.notification) {
      window.notification.error(err.message || "Gagal menghapus produk. Silakan coba lagi.");
    }
    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.innerHTML = '<i class="fas fa-trash"></i> Hapus Produk';
    }
  }
}

// Handle buy button click
async function handleBuyButton() {
  const listingId = getListingIdFromURL();
  const user = getStoredUser();

  if (!user || !user.email) {
    window.location.href = "login.html";
    return;
  }

  if (!listingId) {
    if (window.notification) {
      window.notification.error("ID produk tidak valid");
    }
    return;
  }

  const buyButton = document.getElementById("buyButton");
  if (buyButton) {
    buyButton.disabled = true;
    buyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    const response = await fetch("/api/marketplace/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": user.email
      },
      body: JSON.stringify({
        listing_id: listingId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Gagal membuat order");
    }

    if (window.notification) {
      window.notification.success("Pembelian berhasil diajukan! Redirecting...");
    }

    // Redirect to order detail
    setTimeout(() => {
      window.location.href = `marketplace-order-detail.html?id=${data.order.id}`;
    }, 1500);
  } catch (err) {
    console.error("Error creating order:", err);
    if (window.notification) {
      window.notification.error(err.message || "Gagal mengajukan pembelian. Silakan coba lagi.");
    }
    if (buyButton) {
      buyButton.disabled = false;
      buyButton.innerHTML = '<i class="fas fa-shopping-cart"></i> Ajukan Pembelian';
    }
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const listingId = getListingIdFromURL();

  if (!listingId) {
    document.getElementById("loadingIndicator").classList.add("hidden");
    document.getElementById("errorState").classList.remove("hidden");
    return;
  }

  const listing = await fetchListingDetail(listingId);

  if (!listing) {
    document.getElementById("loadingIndicator").classList.add("hidden");
    document.getElementById("errorState").classList.remove("hidden");
    return;
  }

  renderProductDetail(listing);
});

