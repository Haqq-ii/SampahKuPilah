const USER_STORAGE_KEY = 'sampahKuPilahUser';
const OPENAI_API_KEY = 'REPLACE_WITH_YOUR_OPENAI_API_KEY';
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Gagal membaca sesi pengguna:', err);
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}
function toggleAuthElements(isLoggedIn) {
  document
    .querySelectorAll('[data-auth="guest"]')
    .forEach(el => el.classList.toggle('hidden', isLoggedIn));
  document
    .querySelectorAll('[data-auth="user"]')
    .forEach(el => el.classList.toggle('hidden', !isLoggedIn));
}
function configureDetectionCTA() {
  const cta = document.getElementById('startDetectionBtn');
  if (!cta) return () => {};
  const applyState = session => {
    if (session) {
      cta.setAttribute('href', 'welcome.html');
      cta.classList.remove('needs-login');
    } else {
      cta.setAttribute('href', 'login.html');
      cta.classList.add('needs-login');
    }
  };
  cta.addEventListener('click', event => {
    const session = getStoredUser();
    if (!session) {
      event.preventDefault();
      alert('Silakan login terlebih dahulu untuk menggunakan fitur deteksi.');
      window.location.href = 'login.html';
    }
  });
  return applyState;
}
document.addEventListener('DOMContentLoaded', () => {
  const applyDetectionState = configureDetectionCTA();
  const applySessionState = () => {
    const session = getStoredUser();
    toggleAuthElements(Boolean(session));
    applyDetectionState(session);
  };
  applySessionState();
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem(USER_STORAGE_KEY);
      window.location.href = 'index.html';
    });
  }
  window.addEventListener('storage', event => {
    if (event.key === USER_STORAGE_KEY) {
      applySessionState();
    }
  });
  initAIChat();
});
function initAIChat() {
  const toggleButton = document.getElementById('aiChatToggle');
  const overlay = document.getElementById('aiChatOverlay');
  const closeButton = document.getElementById('aiChatClose');
  const form = document.getElementById('aiChatForm');
  const input = document.getElementById('aiChatInput');
  const submit = document.getElementById('aiChatSubmit');
  const messages = document.getElementById('aiChatMessages');
  if (!toggleButton || !overlay || !form || !input || !submit || !messages) {
    return;
  }
  const conversation = [
    {
      role: 'system',
      content:
        'You are an upbeat assistant that helps people learn about waste sorting, sustainability, and the SampahKuPilah platform. Answer in Indonesian unless the user writes in another language.',
    },
  ];
  let isOpen = false;
  let isLoading = false;
  const hasValidKey = () =>
    Boolean(OPENAI_API_KEY && !OPENAI_API_KEY.includes('REPLACE_WITH_YOUR_OPENAI_API_KEY'));
  const focusInput = () => {
    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) {
        input.focus();
      }
    });
  };
  const setOverlayState = open => {
    isOpen = open;
    overlay.classList.toggle('ai-chat-overlay--active', open);
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggleButton.classList.toggle('ai-chat-toggle--active', open);
    if (open) {
      focusInput();
    }
  };
  const appendMessage = (role, text) => {
    const wrapper = document.createElement('div');
    wrapper.className = `ai-chat-message ai-chat-message--${role}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    wrapper.appendChild(paragraph);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  };
  const setLoading = state => {
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
  toggleButton.addEventListener('click', () => {
    setOverlayState(!isOpen);
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      setOverlayState(false);
    }
  });
  if (closeButton) {
    closeButton.addEventListener('click', () => setOverlayState(false));
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen) {
      setOverlayState(false);
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const userText = input.value.trim();
    if (!userText || isLoading) {
      return;
    }
    appendMessage('user', userText);
    conversation.push({ role: 'user', content: userText });
    trimConversation();
    input.value = '';
    if (!hasValidKey()) {
      appendMessage(
        'system',
        'Silakan buka berkas landing.js dan ganti nilai OPENAI_API_KEY dengan API key milikmu.',
      );
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: conversation,
          temperature: 0.7,
        }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          (errorPayload && errorPayload.error && errorPayload.error.message) ||
          `Permintaan gagal (${response.status})`;
        throw new Error(errorMessage);
      }
      const data = await response.json();
      const assistantMessage = data?.choices?.[0]?.message?.content?.trim();
      if (assistantMessage) {
        conversation.push({ role: 'assistant', content: assistantMessage });
        trimConversation();
        appendMessage('assistant', assistantMessage);
      } else {
        appendMessage(
          'system',
          'Maaf, asisten tidak memberikan balasan. Silakan coba lagi dalam beberapa saat.',
        );
      }
    } catch (error) {
      console.error('Gagal menghubungi API OpenAI:', error);
      appendMessage(
        'system',
        error?.message || 'Terjadi kesalahan saat menghubungkan ke layanan AI.',
      );
    } finally {
      setLoading(false);
    }
  });
}