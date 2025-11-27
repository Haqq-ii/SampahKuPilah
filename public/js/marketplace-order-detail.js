// marketplace-order-detail.js - Order Detail & Chat Logic

const USER_STORAGE_KEY = "sampahKuPilahUser";

// State
let currentOrder = null;
let currentListing = null;
let currentUser = null;
let messagePollInterval = null;

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
  currentUser = user;
  return true;
}

// Get order ID from URL
function getOrderIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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

// Escape HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Fetch order detail
async function fetchOrderDetail(id) {
  const user = getStoredUser();
  if (!user) return null;

  try {
    const response = await fetch(`/api/marketplace/orders/${id}?email=${encodeURIComponent(user.email)}`, {
      headers: {
        "x-user-email": user.email
      }
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error fetching order:", err);
    return null;
  }
}

// Fetch messages
async function fetchMessages(orderId) {
  const user = getStoredUser();
  if (!user) return [];

  try {
    const response = await fetch(`/api/marketplace/messages/${orderId}`, {
      headers: {
        "x-user-email": user.email
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.messages || [];
  } catch (err) {
    console.error("Error fetching messages:", err);
    return [];
  }
}

// Send message
async function sendMessage(orderId, content) {
  const user = getStoredUser();
  if (!user) return false;

  try {
    const response = await fetch("/api/marketplace/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": user.email
      },
      body: JSON.stringify({
        order_id: orderId,
        content: content.trim()
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Gagal mengirim pesan");
    }

    return true;
  } catch (err) {
    console.error("Error sending message:", err);
    if (window.notification) {
      window.notification.error(err.message || "Gagal mengirim pesan");
    }
    return false;
  }
}

// Render order info
function renderOrderInfo(order) {
  document.getElementById("orderId").textContent = order.order_id || order.id;
  
  const statusBadge = document.getElementById("orderStatus");
  const status = order.status || "pending";
  statusBadge.textContent = getStatusLabel(status);
  statusBadge.className = `order-status-badge ${getStatusBadgeClass(status)}`;

  document.getElementById("orderDate").textContent = formatDate(order.created_at);

  const isBuyer = currentUser.email.toLowerCase() === order.buyer_email.toLowerCase();
  const partyEmail = isBuyer ? order.seller_email : order.buyer_email;
  document.getElementById("orderParty").textContent = partyEmail;
  
  // Update label
  const partyLabel = document.getElementById("orderPartyLabel");
  if (partyLabel) {
    partyLabel.textContent = isBuyer ? "Penjual:" : "Pembeli:";
  }

  // COD Location
  if (order.cod_location) {
    const codLocationEl = document.getElementById("codLocation");
    const codLocationItem = document.getElementById("codLocationItem");
    if (codLocationEl) codLocationEl.textContent = order.cod_location;
    if (codLocationItem) codLocationItem.classList.remove("hidden");
  }

  // COD Time
  if (order.cod_time) {
    const codTimeEl = document.getElementById("codTime");
    const codTimeItem = document.getElementById("codTimeItem");
    if (codTimeEl) codTimeEl.textContent = formatDate(order.cod_time);
    if (codTimeItem) codTimeItem.classList.remove("hidden");
  }
}

// Render listing info
function renderListingInfo(listing) {
  const listingInfo = document.getElementById("listingInfo");
  if (!listing) {
    listingInfo.innerHTML = "<p>Informasi produk tidak tersedia</p>";
    return;
  }

  listingInfo.innerHTML = `
    <div class="listing-preview">
      ${listing.images && listing.images.length > 0 
        ? `<img src="${escapeHtml(listing.images[0])}" alt="${escapeHtml(listing.title)}" onerror="this.style.display='none'">`
        : '<i class="fas fa-image"></i>'
      }
    </div>
    <h4>${escapeHtml(listing.title)}</h4>
    <p class="listing-category">${escapeHtml(listing.category)}</p>
    <a href="marketplace-detail.html?id=${listing.id}" class="btn btn-secondary" style="width: 100%; margin-top: var(--spacing-3);">
      <i class="fas fa-eye"></i> Lihat Detail Produk
    </a>
  `;
}

// Render action buttons
function renderActionButtons(order) {
  const actionsSection = document.getElementById("orderActionsSection");
  const isSeller = currentUser.email.toLowerCase() === order.seller_email.toLowerCase();
  const isDone = order.status === "done";
  const isCanceled = order.status === "canceled";

  if (!isSeller || isDone || isCanceled) {
    actionsSection.innerHTML = "";
    return;
  }

  let html = '<div class="order-actions-card"><h3><i class="fas fa-cog"></i> Aksi</h3>';

  if (order.status === "pending") {
    html += `
      <button class="btn btn-primary" id="approveOrderBtn" style="width: 100%; margin-bottom: var(--spacing-2);">
        <i class="fas fa-check"></i> Setujui Pesanan
      </button>
    `;
  }

  if (order.status === "deal" || order.status === "pending") {
    html += `
      <button class="btn btn-success" id="markAsDoneBtn" style="width: 100%;">
        <i class="fas fa-check-circle"></i> Tandai Terjual
      </button>
    `;
  }

  html += '</div>';
  actionsSection.innerHTML = html;

  // Add event listeners
  const approveBtn = document.getElementById("approveOrderBtn");
  if (approveBtn) {
    approveBtn.addEventListener("click", () => updateOrderStatus("deal"));
  }

  const markDoneBtn = document.getElementById("markAsDoneBtn");
  if (markDoneBtn) {
    markDoneBtn.addEventListener("click", handleMarkAsDone);
  }
}

// Update order status
async function updateOrderStatus(status, codLocation = null, codTime = null) {
  if (!currentOrder) return;

  const updateBtn = event?.target;
  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    const response = await fetch(`/api/marketplace/orders/${currentOrder.id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": currentUser.email
      },
      body: JSON.stringify({
        status: status,
        cod_location: codLocation,
        cod_time: codTime
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Gagal update status");
    }

    if (window.notification) {
      window.notification.success("Status pesanan berhasil diupdate!");
    }

    // Reload order detail
    setTimeout(() => {
      location.reload();
    }, 1000);
  } catch (err) {
    console.error("Error updating order status:", err);
    if (window.notification) {
      window.notification.error(err.message || "Gagal update status");
    }
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.innerHTML = updateBtn.dataset.originalText || "Update Status";
    }
  }
}

// Handle mark as done
function handleMarkAsDone() {
  if (!confirm("Apakah Anda yakin barang sudah terjual? Status pesanan akan diubah menjadi 'Selesai' dan poin akan ditambahkan.")) {
    return;
  }
  updateOrderStatus("done");
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

// Render message
function renderMessage(message) {
  const isOwnMessage = message.sender_email.toLowerCase() === currentUser.email.toLowerCase();
  const messageDate = formatDate(message.created_at);

  return `
    <div class="chat-message ${isOwnMessage ? "own-message" : "other-message"}">
      <div class="message-header">
        <span class="message-sender">${isOwnMessage ? "Anda" : (message.sender_email || "User")}</span>
        <span class="message-time">${messageDate}</span>
      </div>
      <div class="message-content">${escapeHtml(message.content)}</div>
    </div>
  `;
}

// Render messages
function renderMessages(messages) {
  const chatMessages = document.getElementById("chatMessages");
  const chatStatus = document.getElementById("chatStatus");

  if (!messages || messages.length === 0) {
    chatMessages.innerHTML = '<div class="chat-empty">Belum ada pesan. Mulai percakapan!</div>';
    chatStatus.textContent = "Tidak ada pesan";
    return;
  }

  chatStatus.textContent = `${messages.length} pesan`;
  chatMessages.innerHTML = messages.map(renderMessage).join("");
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Load messages
async function loadMessages() {
  if (!currentOrder) return;
  const messages = await fetchMessages(currentOrder.id);
  renderMessages(messages);
}

// Handle send message
async function handleSendMessage() {
  const chatInput = document.getElementById("chatInput");
  const content = chatInput.value.trim();

  if (!content) {
    return;
  }

  if (!currentOrder) {
    if (window.notification) {
      window.notification.error("Order tidak ditemukan");
    }
    return;
  }

  const sendBtn = document.getElementById("sendMessageBtn");
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  const success = await sendMessage(currentOrder.id, content);

  if (success) {
    chatInput.value = "";
    await loadMessages();
  }

  sendBtn.disabled = false;
  sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim';
}

// Start message polling
function startMessagePolling() {
  if (messagePollInterval) {
    clearInterval(messagePollInterval);
  }
  messagePollInterval = setInterval(() => {
    if (currentOrder) {
      loadMessages();
    }
  }, 3000); // Poll every 3 seconds
}

// Stop message polling
function stopMessagePolling() {
  if (messagePollInterval) {
    clearInterval(messagePollInterval);
    messagePollInterval = null;
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  if (!checkAuth()) {
    return;
  }

  const orderId = getOrderIdFromURL();
  if (!orderId) {
    document.getElementById("loadingIndicator").classList.add("hidden");
    document.getElementById("errorState").classList.remove("hidden");
    return;
  }

  // Fetch order detail
  const orderData = await fetchOrderDetail(orderId);
  if (!orderData) {
    document.getElementById("loadingIndicator").classList.add("hidden");
    document.getElementById("errorState").classList.remove("hidden");
    return;
  }

  currentOrder = orderData;
  currentListing = orderData.listing;

  // Render order info
  renderOrderInfo(currentOrder);
  renderListingInfo(currentListing);
  renderActionButtons(currentOrder);

  // Load messages
  await loadMessages();

  // Start polling
  startMessagePolling();

  // Show content
  document.getElementById("loadingIndicator").classList.add("hidden");
  document.getElementById("orderDetailContainer").classList.remove("hidden");

  // Chat input handlers
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendMessageBtn");

  if (sendBtn) {
    sendBtn.addEventListener("click", handleSendMessage);
  }

  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", stopMessagePolling);
});

