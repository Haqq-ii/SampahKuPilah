(() => {
  const LAST_DETECTIONS_KEY = "sampahKuPilah:lastDetections";
  const DEFAULT_SEARCH_QUERY = "cara daur ulang sampah rumah tangga";
  // ✅ Security Fix: API key dipindahkan ke server (server.js)
  // Gunakan server proxy endpoint untuk YouTube API
  const YOUTUBE_SEARCH_URL = "/api/youtube/search";
  const MAX_YOUTUBE_RESULTS = 6;

  const videosGrid = document.getElementById("videosGrid");
  const videosFallback = document.getElementById("videosFallback");
  const videoSearchForm = document.getElementById("videoSearchForm");
  const videoSearchInput = document.getElementById("videoSearchInput");
  const videoSearchButton = document.getElementById("videoSearchButton");

  const capitalize = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const accentForCategory = (category) =>
    CATEGORY_ACCENTS[(category || "").toLowerCase()] || "#4caf50";

  // ✅ Security Fix: Server sudah handle API key validation
  const hasValidYouTubeKey = () => true;

  function clearVideos() {
    if (videosGrid) {
      videosGrid.innerHTML = "";
    }
  }

  function showVideoMessage(message) {
    if (!videosFallback) return;
    videosFallback.textContent = message;
    videosFallback.classList.remove("hidden");
  }

  function hideVideoMessage() {
    if (!videosFallback) return;
    videosFallback.textContent = "";
    videosFallback.classList.add("hidden");
  }

  function setVideoSearchLoading(isLoading) {
    if (videoSearchButton) {
      videoSearchButton.disabled = isLoading;
      videoSearchButton.textContent = isLoading ? "Mencari..." : "Cari";
    }
    if (videoSearchInput) {
      videoSearchInput.disabled = isLoading;
    }
  }

  function svgPlaceholder(label, accent) {
    const title = (label || "Produk Daur Ulang").replace(/"/g, "&quot;");
    const primary = encodeURIComponent(accent || "#4caf50");
    const secondary = encodeURIComponent("#dcedc8");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450' viewBox='0 0 600 450'>
      <defs>
        <linearGradient id='grad' x1='0%' x2='100%' y1='0%' y2='100%'>
          <stop offset='0%' stop-color='${primary}' stop-opacity='0.25'/>
          <stop offset='100%' stop-color='${secondary}' stop-opacity='0.45'/>
        </linearGradient>
      </defs>
      <rect width='600' height='450' fill='url(#grad)'/>
      <circle cx='520' cy='60' r='70' fill='${primary}' fill-opacity='0.12'/>
      <circle cx='80' cy='120' r='90' fill='${primary}' fill-opacity='0.18'/>
      <rect x='40' y='340' width='520' height='70' rx='18' fill='${primary}' fill-opacity='0.18'/>
      <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='Montserrat, Arial, sans-serif' font-size='32' fill='${primary}' fill-opacity='0.85'>${title}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function getRecentDetections() {
    try {
      const raw = window.localStorage.getItem(LAST_DETECTIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => (item == null ? "" : String(item).trim().toLowerCase()))
        .filter(Boolean);
    } catch (error) {
      console.warn("Tidak dapat membaca riwayat deteksi:", error);
      return [];
    }
  }

  function buildDetectionKeywords() {
    const recent = getRecentDetections();
    if (!recent.length) {
      return {
        keywords: [],
        query: DEFAULT_SEARCH_QUERY,
      };
    }

    const unique = [];
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      const item = recent[i];
      if (item && !unique.includes(item)) {
        unique.push(item);
      }
    }

    const ordered = unique.reverse();
    const query = `cara daur ulang ${ordered.join(" ")}`.trim();
    return { keywords: ordered, query };
  }

  async function fetchYouTubeVideos(keyword) {
    // ✅ Security Fix: Gunakan server proxy, bukan direct API call
    const url = new URL(YOUTUBE_SEARCH_URL, window.location.origin);
    url.searchParams.set("q", keyword);
    url.searchParams.set("maxResults", String(MAX_YOUTUBE_RESULTS));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `YouTube API status ${response.status}`
      );
    }

    const payload = await response.json();
    return Array.isArray(payload.items)
      ? payload.items
        .filter((item) => item?.id?.videoId)
        .slice(0, MAX_YOUTUBE_RESULTS)
      : [];
  }

  async function performVideoSearch(rawKeyword, { alertOnEmpty = true } = {}) {
    if (!videosGrid || !videosFallback) return;
    const keyword = (rawKeyword || "").trim();

    if (!keyword) {
      if (alertOnEmpty) {
        if (window.notification) {
          window.notification.warning("Masukkan kata kunci terlebih dahulu.");
        } else {
          window.alert("Masukkan kata kunci terlebih dahulu.");
        }
      }
      return;
    }

    clearVideos();
    hideVideoMessage();

    // ✅ Security Fix: Server sudah handle API key, tidak perlu validasi di client

    setVideoSearchLoading(true);

    try {
      const items = await fetchYouTubeVideos(keyword);
      if (!items.length) {
        showVideoMessage("Video tidak ditemukan.");
        return;
      }
      renderVideos(items);
    } catch (error) {
      console.error("Gagal memuat video YouTube:", error);
      showVideoMessage("Tidak dapat memuat video otomatis. Coba lagi nanti.");
    } finally {
      setVideoSearchLoading(false);
    }
  }

  function renderVideos(items) {
    if (!videosGrid) return;
    hideVideoMessage();
    clearVideos();
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const videoId = item?.id?.videoId;
      const title = item?.snippet?.title || "Video Tutorial Daur Ulang";
      if (!videoId) return;

      const card = document.createElement("article");
      card.className = "video-card";

      const player = document.createElement("div");
      player.className = "video-player";
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0`;
      iframe.title = title;
      iframe.loading = "lazy";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.setAttribute("allowfullscreen", "");
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      player.appendChild(iframe);

      const body = document.createElement("div");
      body.className = "video-body";
      const caption = document.createElement("p");
      caption.className = "video-title";
      caption.textContent = title;
      body.appendChild(caption);

      card.append(player, body);
      fragment.appendChild(card);
    });

    videosGrid.appendChild(fragment);
  }

  async function loadVideos() {
    if (!videosGrid || !videosFallback) return;

    console.log("🔍 loadVideos() called");
    console.log("🔍 Current URL:", window.location.href);
    console.log("🔍 Search params:", window.location.search);

    // Check if there's a search parameter in URL (priority)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search') || urlParams.get('q');

    console.log("🔍 URL Params object:", urlParams.toString());
    console.log("🔍 Search param value:", searchParam);

    let initialQuery;
    if (searchParam && searchParam.trim()) {
      // Use URL parameter as ABSOLUTE priority
      initialQuery = searchParam.trim();
      console.log("🎬 Using URL search parameter:", initialQuery);
    } else {
      // Fallback to detection history
      const { query } = buildDetectionKeywords();
      initialQuery = query || DEFAULT_SEARCH_QUERY;
      console.log("📚 Using detection history:", initialQuery);
    }

    // Always update search input to show what we're searching for
    if (videoSearchInput) {
      videoSearchInput.value = initialQuery;
    }

    console.log("🔍 Final search query:", initialQuery);
    await performVideoSearch(initialQuery, { alertOnEmpty: false });
  }

  if (videoSearchForm) {
    videoSearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const keyword = videoSearchInput ? videoSearchInput.value : "";
      performVideoSearch(keyword, { alertOnEmpty: true });
    });
  }

  loadVideos();
})();
