// marketplace-create.js - Create Listing Form Logic

const USER_STORAGE_KEY = "sampahKuPilahUser";

// Get user from localStorage
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// Check if user is logged in
function checkAuth() {
  const user = getStoredUser();
  if (!user || !user.email) {
    if (window.notification) {
      window.notification.warning("Anda harus login terlebih dahulu");
    }
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
    return false;
  }
  return true;
}

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1]; // Remove data:image/...;base64, prefix
      resolve({
        base64: base64,
        mimeType: file.type,
        filename: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Setup image preview
function setupImagePreview(fileInput, previewContainer, previewImg, removeBtn) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      if (window.notification) {
        window.notification.error("Harap pilih file gambar yang valid");
      }
      fileInput.value = "";
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      if (window.notification) {
        window.notification.error("Ukuran gambar maksimal 5MB");
      }
      fileInput.value = "";
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.classList.remove("hidden");
      previewContainer
        .querySelector(".image-preview-placeholder")
        .classList.add("hidden");
      removeBtn.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  // Remove image
  removeBtn.addEventListener("click", () => {
    fileInput.value = "";
    previewImg.src = "";
    previewImg.classList.add("hidden");
    previewContainer
      .querySelector(".image-preview-placeholder")
      .classList.remove("hidden");
    removeBtn.style.display = "none";
  });

  // Click container to trigger file input
  previewContainer.addEventListener("click", () => {
    fileInput.click();
  });
}

// Add image input field
function addImageInput() {
  const imageInputs = document.getElementById("imageInputs");

  const wrapper = document.createElement("div");
  wrapper.className = "image-upload-item";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.name = "image";
  fileInput.className = "form-input image-file-input";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  const previewContainer = document.createElement("div");
  previewContainer.className = "image-preview-container";

  const placeholder = document.createElement("div");
  placeholder.className = "image-preview-placeholder";
  placeholder.innerHTML =
    '<i class="fas fa-image"></i><span>Klik untuk pilih gambar</span>';

  const previewImg = document.createElement("img");
  previewImg.className = "image-preview hidden";
  previewImg.alt = "Preview";

  previewContainer.appendChild(placeholder);
  previewContainer.appendChild(previewImg);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-image";
  removeBtn.innerHTML = '<i class="fas fa-times"></i> Hapus';
  removeBtn.style.display = "none";

  wrapper.appendChild(fileInput);
  wrapper.appendChild(previewContainer);
  wrapper.appendChild(removeBtn);

  setupImagePreview(fileInput, previewContainer, previewImg, removeBtn);

  imageInputs.appendChild(wrapper);
}

// Upload single image to server (Supabase Storage or fallback to data URL)
async function uploadImage(file) {
  const user = getStoredUser();
  if (!user || !user.email) {
    throw new Error("User not authenticated");
  }

  try {
    // Convert to base64
    const fileData = await fileToBase64(file);

    // Check if enhancement is enabled
    const enhanceCheckbox = document.getElementById("enableImageEnhancement");
    const enhance = enhanceCheckbox ? enhanceCheckbox.checked : true; // Default: enabled

    // Try upload to Supabase Storage via backend
    const response = await fetch("/api/marketplace/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": user.email,
      },
      body: JSON.stringify({
        base64: fileData.base64,
        mimeType: fileData.mimeType,
        filename: fileData.filename,
        enhance: enhance,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();

    // Show notification if enhanced
    if (result.enhanced && window.notification) {
      window.notification.success("Gambar berhasil dioptimasi!");
    }

    // Return URL (either Supabase Storage URL or data URL fallback)
    return result.url;
  } catch (err) {
    console.warn("Failed to upload to storage, using data URL fallback:", err);
    // Fallback: return data URL
    const fileData = await fileToBase64(file);
    return `data:${fileData.mimeType};base64,${fileData.base64}`;
  }
}

// Collect images from form (upload to storage or use data URL)
async function collectImages() {
  const inputs = document.querySelectorAll(".image-file-input");
  const images = [];

  for (const input of inputs) {
    if (input.files && input.files[0]) {
      try {
        const imageUrl = await uploadImage(input.files[0]);
        // Store as plain URL string (not object)
        images.push(imageUrl);
      } catch (err) {
        console.error("Error processing image:", err);
        if (window.notification) {
          window.notification.error(
            `Gagal memproses gambar: ${input.files[0].name}`
          );
        }
      }
    }
  }

  return images;
}

// Parse tags from input
function parseTags(tagsInput) {
  if (!tagsInput) return [];
  return tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// Format tags for display
function formatTagsForDisplay(tags) {
  if (!Array.isArray(tags) || tags.length === 0)
    return '<span class="no-tags">Tidak ada tag</span>';
  return tags
    .map((tag) => `<span class="tag-preview">${escapeHtml(tag)}</span>`)
    .join("");
}

// Escape HTML untuk prevent XSS
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Call AI Enhancement API
async function enhanceWithAI() {
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const category = document.getElementById("category").value;
  const tags = parseTags(document.getElementById("tags").value);
  const price = parseFloat(document.getElementById("price").value) || 0;

  // Validation
  if (!title || !description || !category) {
    if (window.notification) {
      window.notification.error(
        "Judul, deskripsi, dan kategori wajib diisi untuk enhancement"
      );
    }
    return null;
  }

  try {
    const response = await fetch("/api/marketplace/enhance-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        category,
        tags,
        price,
      }),
    });

    // Check if response is OK and is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200));

      if (response.status === 404) {
        throw new Error(
          "Endpoint tidak ditemukan. Pastikan server sudah di-restart setelah update terbaru."
        );
      }

      throw new Error(
        `Server mengembalikan response yang tidak valid (${response.status}). Pastikan server sudah di-restart.`
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || `Gagal melakukan enhancement (${response.status})`
      );
    }

    return data;
  } catch (err) {
    console.error("Error enhancing listing:", err);
    if (window.notification) {
      const errorMsg =
        err.message || "Gagal melakukan enhancement. Silakan coba lagi.";
      window.notification.error(errorMsg);
    }
    return null;
  }
}

// Show enhancement preview modal
function showEnhancementPreview(enhancementData) {
  const modal = document.getElementById("enhancementModal");
  const original = enhancementData.original;
  const enhanced = enhancementData.enhanced;

  // Populate original values
  document.getElementById("originalTitle").textContent = original.title || "-";
  document.getElementById("originalDescription").textContent =
    original.description || "-";
  document.getElementById("originalTags").innerHTML = formatTagsForDisplay(
    original.tags || []
  );

  // Populate enhanced values
  document.getElementById("enhancedTitle").textContent = enhanced.title || "-";
  document.getElementById("enhancedDescription").textContent =
    enhanced.description || "-";
  document.getElementById("enhancedTags").innerHTML = formatTagsForDisplay(
    enhanced.tags || []
  );

  // Store enhancement data for later use
  modal.dataset.enhancedData = JSON.stringify(enhanced);

  // Show modal
  modal.classList.remove("hidden");
}

// Apply enhanced value to form
function applyEnhancedValue(field, value) {
  if (field === "title") {
    document.getElementById("title").value = value;
  } else if (field === "description") {
    document.getElementById("description").value = value;
  } else if (field === "tags") {
    if (Array.isArray(value)) {
      document.getElementById("tags").value = value.join(", ");
    }
  }
}

// Close enhancement modal
function closeEnhancementModal() {
  const modal = document.getElementById("enhancementModal");
  modal.classList.add("hidden");
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();

  // Pastikan user sudah login
  if (!checkAuth()) {
    return;
  }

  const user = getStoredUser();

  // ✅ Cek minimal: harus ada email
  if (!user || !user.email) {
    console.error("User object invalid:", user);
    if (window.notification) {
      window.notification.error(
        "User tidak terautentikasi. Silakan login ulang."
      );
    }
    return;
  }

  // ✅ Fallback: kalau tidak ada user.id, pakai email sebagai pengganti
  const userId = user.id || user.email;

  const submitBtn = document.getElementById("submitBtn");
  const originalText = submitBtn.innerHTML;

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

  try {
    // Collect images first (async)
    const images = await collectImages();

    // Collect form data
    const formData = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      category: document.getElementById("category").value,
      tags: parseTags(document.getElementById("tags").value),
      price: parseFloat(document.getElementById("price").value) || 0,
      images: images,
      location_province:
        document.getElementById("location_province").value || null,
      location_city: document.getElementById("location_city").value || null,
      location_district:
        document.getElementById("location_district").value || null,
      location_village:
        document.getElementById("location_village").value || null,
      use_ai: false, // Deprecated, keeping for backward compatibility

      // ✅ Kirim seller_id (gunakan userId)
      seller_id: userId,
    };

    // Validation
    if (!formData.title || !formData.description || !formData.category) {
      if (window.notification) {
        window.notification.error("Judul, deskripsi, dan kategori wajib diisi");
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }

    // ✅ Kirim juga x-user-id & x-user-email
    const response = await fetch("/api/marketplace/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId, // sekarang aman (id atau email)
        "x-user-email": user.email,
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Gagal membuat listing");
    }

    if (window.notification) {
      window.notification.success(
        "Barang berhasil dipublikasikan! Redirecting..."
      );
    }

    // Redirect to detail page
    setTimeout(() => {
      window.location.href = `marketplace-detail.html?id=${data.listing.id}`;
    }, 1500);
  } catch (err) {
    console.error("Error creating listing:", err);
    if (window.notification) {
      window.notification.error(
        err.message || "Gagal membuat listing. Silakan coba lagi."
      );
    }
  } finally {
    // Selalu restore tombol
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// Initialize location dropdowns
function initializeLocationDropdowns() {
  const provinceSelect = document.getElementById("location_province");
  const citySelect = document.getElementById("location_city");
  const districtSelect = document.getElementById("location_district");
  const villageSelect = document.getElementById("location_village");

  // Populate provinces
  const provinces = getProvinces();
  provinces.forEach((province) => {
    const option = document.createElement("option");
    option.value = province;
    option.textContent = province;
    provinceSelect.appendChild(option);
  });

  // Province change handler
  provinceSelect.addEventListener("change", () => {
    const province = provinceSelect.value;

    // Reset and disable dependent selects
    citySelect.innerHTML = '<option value="">Pilih Kota/Kabupaten</option>';
    citySelect.disabled = !province;
    districtSelect.innerHTML = '<option value="">Pilih Kecamatan</option>';
    districtSelect.disabled = true;
    villageSelect.innerHTML = '<option value="">Pilih Desa/Kelurahan</option>';
    villageSelect.disabled = true;

    if (province) {
      const cities = getCities(province);
      cities.forEach((city) => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
      });
      citySelect.disabled = false;
    }
  });

  // City change handler
  citySelect.addEventListener("change", () => {
    const province = provinceSelect.value;
    const city = citySelect.value;

    // Reset and disable dependent selects
    districtSelect.innerHTML = '<option value="">Pilih Kecamatan</option>';
    districtSelect.disabled = !city;
    villageSelect.innerHTML = '<option value="">Pilih Desa/Kelurahan</option>';
    villageSelect.disabled = true;

    if (province && city) {
      const districts = getDistricts(province, city);
      districts.forEach((district) => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
      });
      districtSelect.disabled = false;
    }
  });

  // District change handler
  districtSelect.addEventListener("change", () => {
    const province = provinceSelect.value;
    const city = citySelect.value;
    const district = districtSelect.value;

    // Reset village select
    villageSelect.innerHTML = '<option value="">Pilih Desa/Kelurahan</option>';
    villageSelect.disabled = !district;

    if (province && city && district) {
      const villages = getVillages(province, city, district);
      villages.forEach((village) => {
        const option = document.createElement("option");
        option.value = village;
        option.textContent = village;
        villageSelect.appendChild(option);
      });
      villageSelect.disabled = false;
    }
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Check auth
  if (!checkAuth()) {
    return;
  }

  // Initialize location dropdowns
  initializeLocationDropdowns();

  // Setup first image input
  const firstImageInput = document.querySelector(".image-file-input");
  const firstPreviewContainer = document.querySelector(
    ".image-preview-container"
  );
  const firstPreviewImg = document.querySelector(".image-preview");
  const firstRemoveBtn = document.querySelector(".btn-remove-image");
  if (
    firstImageInput &&
    firstPreviewContainer &&
    firstPreviewImg &&
    firstRemoveBtn
  ) {
    setupImagePreview(
      firstImageInput,
      firstPreviewContainer,
      firstPreviewImg,
      firstRemoveBtn
    );
  }

  // Form submission
  const form = document.getElementById("createListingForm");
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  // Add image button
  const addImageBtn = document.getElementById("addImageBtn");
  if (addImageBtn) {
    addImageBtn.addEventListener("click", addImageInput);
  }

  // AI Enhancement button
  const enhanceBtn = document.getElementById("enhanceBtn");
  if (enhanceBtn) {
    enhanceBtn.addEventListener("click", async () => {
      const originalText = enhanceBtn.innerHTML;
      enhanceBtn.disabled = true;
      enhanceBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Memproses...';

      if (window.notification) {
        window.notification.info("AI sedang memproses enhancement...");
      }

      const result = await enhanceWithAI();

      enhanceBtn.disabled = false;
      enhanceBtn.innerHTML = originalText;

      if (result) {
        showEnhancementPreview(result);
      }
    });
  }

  // Close enhancement modal buttons
  const closeModalBtn = document.getElementById("closeEnhancementModal");
  const cancelEnhancementBtn = document.getElementById("cancelEnhancementBtn");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeEnhancementModal);
  }
  if (cancelEnhancementBtn) {
    cancelEnhancementBtn.addEventListener("click", closeEnhancementModal);
  }

  // Accept individual items
  const acceptItemButtons = document.querySelectorAll(".btn-accept-item");
  acceptItemButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.dataset.item;
      const modal = document.getElementById("enhancementModal");
      const enhancedData = JSON.parse(modal.dataset.enhancedData || "{}");

      if (item === "title" && enhancedData.title) {
        applyEnhancedValue("title", enhancedData.title);
        if (window.notification) {
          window.notification.success("Judul enhanced telah diterapkan");
        }
      } else if (item === "description" && enhancedData.description) {
        applyEnhancedValue("description", enhancedData.description);
        if (window.notification) {
          window.notification.success("Deskripsi enhanced telah diterapkan");
        }
      } else if (item === "tags" && enhancedData.tags) {
        applyEnhancedValue("tags", enhancedData.tags);
        if (window.notification) {
          window.notification.success("Tag enhanced telah diterapkan");
        }
      }
    });
  });

  // Accept all button
  const acceptAllBtn = document.getElementById("acceptAllBtn");
  if (acceptAllBtn) {
    acceptAllBtn.addEventListener("click", () => {
      const modal = document.getElementById("enhancementModal");
      const enhancedData = JSON.parse(modal.dataset.enhancedData || "{}");

      if (enhancedData.title) {
        applyEnhancedValue("title", enhancedData.title);
      }
      if (enhancedData.description) {
        applyEnhancedValue("description", enhancedData.description);
      }
      if (enhancedData.tags) {
        applyEnhancedValue("tags", enhancedData.tags);
      }

      if (window.notification) {
        window.notification.success("Semua enhancement telah diterapkan");
      }

      closeEnhancementModal();
    });
  }

  // Regenerate button
  const regenBtn = document.getElementById("regenBtn");
  if (regenBtn) {
    regenBtn.addEventListener("click", async () => {
      const originalText = regenBtn.innerHTML;
      regenBtn.disabled = true;
      regenBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Generate Ulang...';

      const result = await enhanceWithAI();

      regenBtn.disabled = false;
      regenBtn.innerHTML = originalText;

      if (result) {
        showEnhancementPreview(result);
        if (window.notification) {
          window.notification.success("Enhancement baru telah dihasilkan");
        }
      }
    });
  }

  // Close modal on overlay click
  const modal = document.getElementById("enhancementModal");
  if (modal) {
    const overlay = modal.querySelector(".enhancement-modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", closeEnhancementModal);
    }
  }
});
