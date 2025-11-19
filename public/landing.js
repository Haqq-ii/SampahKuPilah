const USER_STORAGE_KEY = "sampahKuPilahUser";
// ✅ Security Fix: API key dipindahkan ke server (server.js)
// Tidak ada lagi API key di client-side untuk keamanan
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
function toggleAuthElements(isLoggedIn) {
  document
    .querySelectorAll('[data-auth="guest"]')
    .forEach((el) => el.classList.toggle("hidden", isLoggedIn));
  document
    .querySelectorAll('[data-auth="user"]')
    .forEach((el) => el.classList.toggle("hidden", !isLoggedIn));
}

function updateAvatar(user) {
  const avatarCircle = document.getElementById("avatarCircle");
  const avatarInitials = document.getElementById("avatarInitials");
  const avatarImage = document.getElementById("avatarImage");
  
  if (!avatarCircle || !avatarInitials || !avatarImage) return;
  
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

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
function configureDetectionCTA() {
  const cta = document.getElementById("startDetectionBtn");
  if (!cta) return () => {};
  const applyState = (session) => {
    if (session) {
      cta.setAttribute("href", "welcome.html");
      cta.classList.remove("needs-login");
    } else {
      cta.setAttribute("href", "login.html");
      cta.classList.add("needs-login");
    }
  };
  cta.addEventListener("click", (event) => {
    const session = getStoredUser();
    if (!session) {
      event.preventDefault();
      if (window.notification) {
        window.notification.warning("Silakan login terlebih dahulu untuk menggunakan fitur deteksi.");
      } else {
        alert("Silakan login terlebih dahulu untuk menggunakan fitur deteksi.");
      }
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    }
  });
  return applyState;
}
document.addEventListener("DOMContentLoaded", () => {
  const applyDetectionState = configureDetectionCTA();
  const applySessionState = () => {
    const session = getStoredUser();
    toggleAuthElements(Boolean(session));
    applyDetectionState(session);
    if (session) {
      updateAvatar(session);
    }
  };
  applySessionState();
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem(USER_STORAGE_KEY);
      window.location.href = "index.html";
    });
  }
  window.addEventListener("storage", (event) => {
    if (event.key === USER_STORAGE_KEY) {
      applySessionState();
    }
  });
  initAIChat();
});
function initAIChat() {
  const toggleButton = document.getElementById("aiChatToggle");
  const overlay = document.getElementById("aiChatOverlay");
  const closeButton = document.getElementById("aiChatClose");
  const form = document.getElementById("aiChatForm");
  const input = document.getElementById("aiChatInput");
  const submit = document.getElementById("aiChatSubmit");
  const messages = document.getElementById("aiChatMessages");
  if (!toggleButton || !overlay || !form || !input || !submit || !messages) {
    return;
  }
  const conversation = [
    {
      role: "system",
      content:
        "You are an upbeat assistant that helps people learn about waste sorting, sustainability, and the SampahKuPilah platform. Answer in Indonesian unless the user writes in another language.",
    },
  ];
  let isOpen = false;
  let isLoading = false;
  // ✅ Security Fix: Tidak perlu validasi API key di client
  // Server akan handle API key validation
  const focusInput = () => {
    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) {
        input.focus();
      }
    });
  };
  const setOverlayState = (open) => {
    isOpen = open;
    overlay.classList.toggle("ai-chat-overlay--active", open);
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    toggleButton.setAttribute("aria-expanded", open ? "true" : "false");
    toggleButton.classList.toggle("ai-chat-toggle--active", open);
    if (open) {
      focusInput();
    }
  };
  const appendMessage = (role, text) => {
    const wrapper = document.createElement("div");
    wrapper.className = `ai-chat-message ai-chat-message--${role}`;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    wrapper.appendChild(paragraph);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  };
  const setLoading = (state) => {
    isLoading = state;
    submit.disabled = state;
    input.disabled = state;
    if (!state) {
      focusInput();
    }
  };
  const trimConversation = () => {
    const MAX_MESSAGES = 12;
    if (conversation.length > MAX_MESSAGES) {
      conversation.splice(1, conversation.length - MAX_MESSAGES);
    }
  };
  toggleButton.addEventListener("click", () => {
    setOverlayState(!isOpen);
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      setOverlayState(false);
    }
  });
  if (closeButton) {
    closeButton.addEventListener("click", () => setOverlayState(false));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      setOverlayState(false);
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userText = input.value.trim();
    if (!userText || isLoading) {
      return;
    }
    appendMessage("user", userText);
    conversation.push({ role: "user", content: userText });
    trimConversation();
    input.value = "";
    
    try {
      setLoading(true);
      
      // ✅ Security Fix: Gunakan server endpoint, bukan direct API call
      const response = await fetch("/api/openai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: conversation }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Permintaan gagal (${response.status})`
        );
      }

      const data = await response.json();
      const assistantMessage = data?.message?.trim();
      
      if (assistantMessage) {
        conversation.push({ role: "assistant", content: assistantMessage });
        trimConversation();
        appendMessage("assistant", assistantMessage);
      } else {
        appendMessage(
          "system",
          "Maaf, asisten tidak memberikan balasan. Silakan coba lagi dalam beberapa saat."
        );
      }
    } catch (error) {
      console.error("Gagal menghubungi API OpenAI:", error);
      appendMessage(
        "system",
        error?.message || "Terjadi kesalahan saat menghubungkan ke layanan AI."
      );
    } finally {
      setLoading(false);
    }
  });
}
