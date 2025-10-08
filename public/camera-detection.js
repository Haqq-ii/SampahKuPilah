// Camera Detection and Waste Classification System
class WasteDetectionSystem {
  constructor() {
    this.camera = null;
    this.stream = null;
    this.isDetecting = false;
    this.detectionInterval = null;
    this.detectionHistory = [];

    // Sample waste data for simulation
    this.wasteDatabase = {
      "Botol Plastik": {
        type: "Anorganik",
        bin: "inorganic",
        icon: "fas fa-wine-bottle",
        confidence: 0.95,
      },
      "Kaleng Aluminium": {
        type: "Anorganik",
        bin: "inorganic",
        icon: "fas fa-beer",
        confidence: 0.92,
      },
      Kertas: {
        type: "Anorganik",
        bin: "inorganic",
        icon: "fas fa-file",
        confidence: 0.89,
      },
      Kardus: {
        type: "Anorganik",
        bin: "inorganic",
        icon: "fas fa-box",
        confidence: 0.87,
      },
      "Sisa Makanan": {
        type: "Organik",
        bin: "organic",
        icon: "fas fa-apple-alt",
        confidence: 0.94,
      },
      "Daun Kering": {
        type: "Organik",
        bin: "organic",
        icon: "fas fa-leaf",
        confidence: 0.91,
      },
      "Kulit Buah": {
        type: "Organik",
        bin: "organic",
        icon: "fas fa-banana",
        confidence: 0.88,
      },
      Baterai: {
        type: "B3",
        bin: "hazardous",
        icon: "fas fa-battery-quarter",
        confidence: 0.96,
      },
      "Lampu Neon": {
        type: "B3",
        bin: "hazardous",
        icon: "fas fa-lightbulb",
        confidence: 0.93,
      },
      "Obat Kadaluarsa": {
        type: "B3",
        bin: "hazardous",
        icon: "fas fa-pills",
        confidence: 0.9,
      },
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadDetectionHistory();
  }

  bindEvents() {
    const startBtn = document.getElementById("startCamera");
    const stopBtn = document.getElementById("stopCamera");

    startBtn.addEventListener("click", () => this.startCamera());
    stopBtn.addEventListener("click", () => this.stopCamera());
  }

  async startCamera() {
    try {
      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment", // Use back camera if available
        },
      });

      const video = document.getElementById("cameraFeed");
      video.srcObject = this.stream;
      video.style.display = "block";

      // Hide placeholder and show overlay
      document.querySelector(".camera-placeholder").style.display = "none";
      document.querySelector(".detection-overlay").style.display = "block";

      // Update button states
      document.getElementById("startCamera").disabled = true;
      document.getElementById("stopCamera").disabled = false;

      // Start detection simulation
      this.startDetection();

      this.showNotification("Kamera berhasil diaktifkan!", "success");
    } catch (error) {
      console.error("Error accessing camera:", error);
      this.showNotification(
        "Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.",
        "error"
      );

      // Fallback to simulated camera for demo
      this.startSimulatedCamera();
    }
  }

  startSimulatedCamera() {
    const video = document.getElementById("cameraFeed");
    const placeholder = document.querySelector(".camera-placeholder");

    // Create a canvas for simulation
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.objectFit = "cover";

    const ctx = canvas.getContext("2d");

    // Draw a simulated camera feed
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height
    );
    gradient.addColorStop(0, "#2e7d32");
    gradient.addColorStop(0.5, "#1b5e20");
    gradient.addColorStop(1, "#0d3b0d");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some text
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Simulasi Kamera", canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText("Demo Mode", canvas.width / 2, canvas.height / 2 + 20);

    video.parentNode.replaceChild(canvas, video);
    placeholder.style.display = "none";
    document.querySelector(".detection-overlay").style.display = "block";

    // Update button states
    document.getElementById("startCamera").disabled = true;
    document.getElementById("stopCamera").disabled = false;

    // Start detection simulation
    this.startDetection();

    this.showNotification("Mode simulasi diaktifkan untuk demo", "info");
  }

  stopCamera() {
    // Stop camera stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Stop detection
    this.stopDetection();

    // Reset UI
    const video = document.getElementById("cameraFeed");
    const placeholder = document.querySelector(".camera-placeholder");
    const overlay = document.querySelector(".detection-overlay");

    video.style.display = "none";
    placeholder.style.display = "block";
    overlay.style.display = "none";

    // Update button states
    document.getElementById("startCamera").disabled = false;
    document.getElementById("stopCamera").disabled = true;

    this.showNotification("Kamera dimatikan", "info");
  }

  startDetection() {
    this.isDetecting = true;

    // Simulate detection every 3-5 seconds
    this.detectionInterval = setInterval(() => {
      this.simulateDetection();
    }, Math.random() * 2000 + 3000); // Random interval between 3-5 seconds
  }

  stopDetection() {
    this.isDetecting = false;
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  simulateDetection() {
    if (!this.isDetecting) return;

    // Get random waste item
    const wasteItems = Object.keys(this.wasteDatabase);
    const randomWaste =
      wasteItems[Math.floor(Math.random() * wasteItems.length)];
    const wasteData = this.wasteDatabase[randomWaste];

    // Add some randomness to confidence
    const confidence = Math.max(
      0.75,
      wasteData.confidence + (Math.random() - 0.5) * 0.1
    );

    // Update detection display
    this.updateDetectionDisplay(randomWaste, wasteData.type, confidence);

    // Show recommended bin
    this.showRecommendedBin(wasteData.bin);

    // Add to history
    this.addToHistory(randomWaste, wasteData.type, wasteData.bin, confidence);

    // Show notification
    this.showNotification(`Terdeteksi: ${randomWaste}`, "success");
  }

  updateDetectionDisplay(name, type, confidence) {
    document.getElementById("detectedName").textContent = name;
    document.getElementById("detectedType").textContent = type;
    document.getElementById("detectedConfidence").textContent = `${Math.round(
      confidence * 100
    )}%`;

    // Update detection icon
    const iconElement = document.querySelector(".detection-image i");
    const wasteData = this.wasteDatabase[name];
    if (wasteData) {
      iconElement.className = wasteData.icon;
    }

    // Animate the detection card
    const detectionCard = document.querySelector(".detection-card");
    detectionCard.style.animation = "none";
    setTimeout(() => {
      detectionCard.style.animation = "slideIn 0.5s ease-out";
    }, 10);
  }

  showRecommendedBin(binType) {
    const binContainer = document.getElementById("recommendedBin");

    // Clear current bin
    binContainer.innerHTML = "";

    // Get template
    const template = document.getElementById(binType + "Bin");
    if (template) {
      const binElement = template.content.cloneNode(true);
      binContainer.appendChild(binElement);
    } else {
      // Fallback
      binContainer.innerHTML = `
                <div class="bin-placeholder">
                    <i class="fas fa-info-circle"></i>
                    <p>Bin type: ${binType}</p>
                </div>
            `;
    }
  }

  addToHistory(name, type, bin, confidence) {
    const historyItem = {
      name,
      type,
      bin,
      confidence,
      timestamp: new Date(),
    };

    this.detectionHistory.unshift(historyItem);

    // Keep only last 10 items
    if (this.detectionHistory.length > 10) {
      this.detectionHistory = this.detectionHistory.slice(0, 10);
    }

    this.updateHistoryDisplay();
    this.saveDetectionHistory();
  }

  updateHistoryDisplay() {
    const historyContainer = document.getElementById("detectionHistory");

    if (this.detectionHistory.length === 0) {
      historyContainer.innerHTML = `
                <div class="no-history">
                    <i class="fas fa-clock"></i>
                    <p>Belum ada riwayat deteksi</p>
                </div>
            `;
      return;
    }

    historyContainer.innerHTML = this.detectionHistory
      .map((item) => {
        const wasteData = this.wasteDatabase[item.name];
        const icon = wasteData ? wasteData.icon : "fas fa-question-circle";
        const timeAgo = this.getTimeAgo(item.timestamp);

        return `
                <div class="history-item">
                    <div class="history-info">
                        <div class="history-icon">
                            <i class="${icon}"></i>
                        </div>
                        <div class="history-details">
                            <h4>${item.name}</h4>
                            <p>${item.type} • ${Math.round(
          item.confidence * 100
        )}%</p>
                        </div>
                    </div>
                    <div class="history-time">${timeAgo}</div>
                </div>
            `;
      })
      .join("");
  }

  getTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes}m yang lalu`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}j yang lalu`;

    const days = Math.floor(hours / 24);
    return `${days}h yang lalu`;
  }

  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
            <i class="fas fa-${
              type === "success"
                ? "check-circle"
                : type === "error"
                ? "exclamation-circle"
                : "info-circle"
            }"></i>
            <span>${message}</span>
        `;

    // Add styles
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
              type === "success"
                ? "#4caf50"
                : type === "error"
                ? "#f44336"
                : "#2196f3"
            };
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease-out";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  saveDetectionHistory() {
    localStorage.setItem(
      "wasteDetectionHistory",
      JSON.stringify(this.detectionHistory)
    );
  }

  loadDetectionHistory() {
    const saved = localStorage.getItem("wasteDetectionHistory");
    if (saved) {
      try {
        this.detectionHistory = JSON.parse(saved).map((item) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        this.updateHistoryDisplay();
      } catch (error) {
        console.error("Error loading detection history:", error);
      }
    }
  }
}

// Add CSS animations for notifications
const style = document.createElement("style");
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the system when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.wasteDetectionSystem = new WasteDetectionSystem();
});

// Export for potential use in other scripts
window.WasteDetectionSystem = WasteDetectionSystem;

