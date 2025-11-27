// marketplace-orders.js - Orders List Logic

const USER_STORAGE_KEY = "sampahKuPilahUser";

// State
let currentRole = "buyer";
let currentStatus = "";
let currentPage = 1;

// Get user from localStorage
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

// Check auth
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

// Fetch orders
async function fetchOrders(role, status = "", page = 1) {
  const user = getStoredUser();
  if (!user) return { orders: [], pagination: {} };

  const params = new URLSearchParams({
    role: role,
    page: page.toString(),
    limit: "20"
  });
  if (status) params.append("status", status);

  try {
    const response = await fetch(`/api/marketplace/orders?${params.toString()}`, {
      headers: {
        "x-user-email": user.email
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error fetching orders:", err);
    if (window.notification) {
      window.notification.error("Gagal memuat pesanan. Silakan coba lagi.");
    }
    return { orders: [], pagination: {} };
  }
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Get status badge class
function getStatusBadgeClass(status) {
  const statusMap = {
    pending: "status-pending",
    deal: "status-deal",
    done: "status-done",
    canceled: "status-canceled"
  };
  return statusMap[status] || "";
}

// Get status label
function getStatusLabel(status) {
  const statusMap = {
    pending: "Menunggu",
    deal: "Disetujui",
    done: "Selesai",
    canceled: "Dibatalkan"
  };
  return statusMap[status] || status;
}

// Render order card
function renderOrderCard(order) {
  const orderDate = formatDate(order.created_at);
  const statusClass = getStatusBadgeClass(order.status);
  const statusLabel = getStatusLabel(order.status);

  return `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-header">
        <div class="order-info">
          <h3 class="order-id">${order.order_id || order.id}</h3>
          <span class="order-date">${orderDate}</span>
        </div>
        <span class="order-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="order-content">
        <div class="order-meta">
          <div class="meta-item">
            <i class="fas fa-user"></i>
            <span>${currentRole === "buyer" ? "Penjual" : "Pembeli"}:</span>
            <strong>${currentRole === "buyer" ? order.seller_email : order.buyer_email}</strong>
          </div>
          ${order.cod_location ? `
            <div class="meta-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>Lokasi COD:</span>
              <strong>${order.cod_location}</strong>
            </div>
          ` : ""}
          ${order.cod_time ? `
            <div class="meta-item">
              <i class="fas fa-clock"></i>
              <span>Waktu COD:</span>
              <strong>${formatDate(order.cod_time)}</strong>
            </div>
          ` : ""}
        </div>
      </div>
      <div class="order-actions">
        <a href="marketplace-order-detail.html?id=${order.id}" class="btn btn-primary">
          <i class="fas fa-eye"></i> Lihat Detail
        </a>
      </div>
    </div>
  `;
}

// Render orders list
function renderOrders(orders) {
  const ordersList = document.getElementById("ordersList");
  const emptyState = document.getElementById("emptyState");
  const loadingIndicator = document.getElementById("loadingIndicator");

  loadingIndicator.classList.add("hidden");

  if (!orders || orders.length === 0) {
    ordersList.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  ordersList.innerHTML = orders.map(renderOrderCard).join("");
}

// Render pagination
function renderPagination(pagination) {
  const paginationEl = document.getElementById("pagination");

  if (pagination.totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  let html = "";

  // Previous
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
    if (startPage > 2) html += `<span class="pagination-info">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="pagination-btn ${i === pagination.page ? "active" : ""}" 
              data-page="${i}">${i}</button>
    `;
  }

  if (endPage < pagination.totalPages) {
    if (endPage < pagination.totalPages - 1) {
      html += `<span class="pagination-info">...</span>`;
    }
    html += `<button class="pagination-btn" data-page="${pagination.totalPages}">${pagination.totalPages}</button>`;
  }

  // Next
  html += `
    <button class="pagination-btn" ${pagination.page === pagination.totalPages ? "disabled" : ""} 
            data-page="${pagination.page + 1}">
      <i class="fas fa-chevron-right"></i>
    </button>
  `;

  paginationEl.innerHTML = html;

  // Add click handlers
  paginationEl.querySelectorAll(".pagination-btn:not(:disabled)").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.dataset.page);
      if (page && page !== currentPage) {
        currentPage = page;
        loadOrders();
      }
    });
  });
}

// Load orders
async function loadOrders() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  loadingIndicator.classList.remove("hidden");

  const data = await fetchOrders(currentRole, currentStatus, currentPage);
  renderOrders(data.orders);
  renderPagination(data.pagination);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth()) {
    return;
  }

  // Get role from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roleFromUrl = urlParams.get("role");
  if (roleFromUrl === "seller" || roleFromUrl === "buyer") {
    currentRole = roleFromUrl;
  }

  // Update active tab
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.dataset.role === currentRole) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const role = btn.dataset.role;
      if (role !== currentRole) {
        currentRole = role;
        currentPage = 1;
        document.querySelectorAll(".tab-btn").forEach(b => {
          b.classList.toggle("active", b === btn);
        });
        loadOrders();
      }
    });
  });

  // Status filter
  const statusFilter = document.getElementById("statusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      currentStatus = statusFilter.value;
      currentPage = 1;
      loadOrders();
    });
  }

  // Load initial orders
  loadOrders();
});

