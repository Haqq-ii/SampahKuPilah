// leaderboard.js - Leaderboard Logic

let currentType = "all";

// Fetch leaderboard
async function fetchLeaderboard(type = "all") {
  try {
    const response = await fetch(`/api/marketplace/leaderboard?type=${type}&limit=20`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    if (window.notification) {
      window.notification.error("Gagal memuat leaderboard. Silakan coba lagi.");
    }
    return { seller_leaderboard: [], buyer_leaderboard: [] };
  }
}

// Render ranking item
function renderRankingItem(item, index) {
  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
  const rankClass = index < 3 ? "top-rank" : "";

  return `
    <div class="ranking-item ${rankClass}">
      <div class="ranking-number">
        ${medal || (index + 1)}
      </div>
      <div class="ranking-info">
        <div class="ranking-email">${escapeHtml(item.user_email)}</div>
        <div class="ranking-stats">
          ${item.total_items_sold !== undefined 
            ? `<span><i class="fas fa-box"></i> ${item.total_items_sold} terjual</span>`
            : `<span><i class="fas fa-shopping-bag"></i> ${item.total_items_bought} dibeli</span>`
          }
        </div>
      </div>
      <div class="ranking-points">
        <span class="points-value">
          ${item.points_seller !== undefined ? item.points_seller : item.points_buyer}
        </span>
        <span class="points-label">poin</span>
      </div>
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render leaderboard
function renderLeaderboard(data) {
  const loadingIndicator = document.getElementById("loadingIndicator");
  const sellerSection = document.getElementById("sellerLeaderboard");
  const buyerSection = document.getElementById("buyerLeaderboard");
  const emptyState = document.getElementById("emptyState");
  const sellerList = document.getElementById("sellerList");
  const buyerList = document.getElementById("buyerList");

  loadingIndicator.classList.add("hidden");

  const hasSeller = data.seller_leaderboard && data.seller_leaderboard.length > 0;
  const hasBuyer = data.buyer_leaderboard && data.buyer_leaderboard.length > 0;

  if (!hasSeller && !hasBuyer) {
    sellerSection.classList.add("hidden");
    buyerSection.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  // Render seller leaderboard
  if (hasSeller) {
    sellerSection.classList.remove("hidden");
    sellerList.innerHTML = data.seller_leaderboard.map((item, index) => 
      renderRankingItem(item, index)
    ).join("");
  } else {
    sellerSection.classList.add("hidden");
  }

  // Render buyer leaderboard
  if (hasBuyer) {
    buyerSection.classList.remove("hidden");
    buyerList.innerHTML = data.buyer_leaderboard.map((item, index) => 
      renderRankingItem(item, index)
    ).join("");
  } else {
    buyerSection.classList.add("hidden");
  }
}

// Load leaderboard
async function loadLeaderboard() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  loadingIndicator.classList.remove("hidden");

  const data = await fetchLeaderboard(currentType);
  renderLeaderboard(data);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      if (type !== currentType) {
        currentType = type;
        document.querySelectorAll(".tab-btn").forEach(b => {
          b.classList.toggle("active", b === btn);
        });

        // Show/hide sections based on type
        const sellerSection = document.getElementById("sellerLeaderboard");
        const buyerSection = document.getElementById("buyerLeaderboard");

        if (type === "seller") {
          sellerSection.classList.remove("hidden");
          buyerSection.classList.add("hidden");
        } else if (type === "buyer") {
          sellerSection.classList.add("hidden");
          buyerSection.classList.remove("hidden");
        } else {
          sellerSection.classList.remove("hidden");
          buyerSection.classList.remove("hidden");
        }

        loadLeaderboard();
      }
    });
  });

  // Load initial leaderboard
  loadLeaderboard();
});

