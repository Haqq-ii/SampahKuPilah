/**
 * Notification System - Global Notification Manager
 * Menggantikan alert() dengan sistem notifikasi yang lebih user-friendly
 */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.maxNotifications = 5;
    this.defaultDuration = 3000;
    this.init();
  }

  init() {
    // Buat container untuk notifikasi
    this.container = document.createElement("div");
    this.container.id = "notification-container";
    this.container.setAttribute("aria-live", "polite");
    this.container.setAttribute("aria-atomic", "true");
    document.body.appendChild(this.container);

    // Inject CSS jika belum ada
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById("notification-styles")) return;

    const style = document.createElement("style");
    style.id = "notification-styles";
    style.textContent = `
      #notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
        pointer-events: none;
      }

      .notification {
        background: var(--color-white, #ffffff);
        color: var(--neutral-800, #2f3d36);
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
        animation: slideInRight 0.3s ease;
        border-left: 4px solid;
        font-family: var(--font-primary, "Montserrat", Arial, sans-serif);
        font-size: var(--font-size-sm, 0.875rem);
        line-height: var(--line-height-normal, 1.5);
      }

      .notification--success {
        border-left-color: var(--eco-green, #4caf50);
        background: rgba(76, 175, 80, 0.1);
      }

      .notification--error {
        border-left-color: var(--color-red, #f44336);
        background: rgba(244, 67, 54, 0.1);
      }

      .notification--warning {
        border-left-color: var(--color-yellow, #ff9800);
        background: rgba(255, 152, 0, 0.1);
      }

      .notification--info {
        border-left-color: var(--color-blue, #2196f3);
        background: rgba(33, 150, 243, 0.1);
      }

      .notification__icon {
        font-size: 20px;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .notification__content {
        flex: 1;
        word-wrap: break-word;
      }

      .notification__close {
        background: none;
        border: none;
        color: var(--neutral-600, #4f6459);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        font-size: 18px;
        line-height: 1;
        transition: background 0.2s ease, color 0.2s ease;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .notification__close:hover {
        background: rgba(0, 0, 0, 0.1);
        color: var(--neutral-800, #2f3d36);
      }

      .notification--exiting {
        animation: slideOutRight 0.3s ease forwards;
      }

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

      @media (max-width: 768px) {
        #notification-container {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }

        .notification {
          padding: 14px 16px;
          font-size: 0.875rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  show(message, type = "info", duration = null) {
    if (!message || typeof message !== "string") {
      console.warn("Notification: message harus berupa string");
      return;
    }

    // Limit jumlah notifikasi
    if (this.notifications.length >= this.maxNotifications) {
      this.remove(this.notifications[0]);
    }

    const notification = this.createNotification(message, type);
    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Auto remove setelah duration
    const removeDuration = duration !== null ? duration : this.defaultDuration;
    if (removeDuration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, removeDuration);
    }

    return notification;
  }

  createNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification notification--${type}`;
    notification.setAttribute("role", "alert");

    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };

    const icon = document.createElement("div");
    icon.className = "notification__icon";
    icon.textContent = icons[type] || icons.info;
    icon.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "notification__content";
    content.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "notification__close";
    closeBtn.innerHTML = "×";
    closeBtn.setAttribute("aria-label", "Tutup notifikasi");
    closeBtn.addEventListener("click", () => this.remove(notification));

    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeBtn);

    return notification;
  }

  remove(notification) {
    if (!notification || !notification.parentNode) return;

    notification.classList.add("notification--exiting");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, 300);
  }

  success(message, duration) {
    return this.show(message, "success", duration);
  }

  error(message, duration) {
    // Error notifications stay longer by default
    const errorDuration = duration !== null ? duration : 5000;
    return this.show(message, "error", errorDuration);
  }

  warning(message, duration) {
    return this.show(message, "warning", duration);
  }

  info(message, duration) {
    return this.show(message, "info", duration);
  }

  clear() {
    this.notifications.forEach((notification) => {
      this.remove(notification);
    });
  }
}

// Initialize global notification system
let notificationInstance = null;

function getNotification() {
  if (!notificationInstance) {
    notificationInstance = new NotificationSystem();
  }
  return notificationInstance;
}

// Export untuk module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = { NotificationSystem, getNotification };
}

// Global access
window.Notification = NotificationSystem;
window.notification = getNotification();

