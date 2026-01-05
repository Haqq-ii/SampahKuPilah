const LAST_DETECTIONS_KEY = "sampahKuPilah:lastDetections";
const DETECTION_HISTORY_KEY = "sampahKuPilah:detectionHistory";
const USER_STORAGE_KEY = "sampahKuPilahUser";
const MAX_DETECTION_HISTORY = 10;

// Fungsi untuk mendapatkan user dari localStorage
function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Gagal membaca sesi pengguna:", err);
    return null;
  }
}

function persistDetectionLabel(label, bin = null, confidence = null) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) return;

  try {
    // Simpan ke lastDetections (format lama untuk kompatibilitas)
    const raw = window.localStorage.getItem(LAST_DETECTIONS_KEY);
    const history = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(history) ? history.slice() : [];
    list.push(normalized);
    const recent = list.slice(-MAX_DETECTION_HISTORY);
    window.localStorage.setItem(
      LAST_DETECTIONS_KEY,
      JSON.stringify(recent)
    );

    // Simpan ke detectionHistory (format baru dengan detail)
    const historyRaw = window.localStorage.getItem(DETECTION_HISTORY_KEY);
    const detailedHistory = historyRaw ? JSON.parse(historyRaw) : [];
    const newEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      category: normalized,
      bin: bin || normalized,
      confidence: confidence || null,
      label: label
    };
    detailedHistory.push(newEntry);
    const recentDetailed = detailedHistory.slice(-MAX_DETECTION_HISTORY);
    window.localStorage.setItem(
      DETECTION_HISTORY_KEY,
      JSON.stringify(recentDetailed)
    );
  } catch (error) {
    console.warn("Tidak dapat menyimpan riwayat deteksi:", error);
  }
}

// Tambahkan logika untuk mendeteksi objek di tangan:
async function detectObjectInHand(canvas) {
  // Analisis area tengah untuk objek yang dipegang
  // Bukan hanya crop berdasarkan guide box
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Crop area yang lebih fokus pada objek di tangan
  const handObjectCrop = {
    x: centerX - canvas.width * 0.3,
    y: centerY - canvas.height * 0.3,
    width: canvas.width * 0.6,
    height: canvas.height * 0.6,
  };

  return handObjectCrop;
}
class WasteDetectionSystem {
  constructor() {
    this.stream = null;
    this.isProcessing = false;
    this.init();

  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    const startBtn = document.getElementById("startCamera");
    const stopBtn = document.getElementById("stopCamera");
    const scanBtn = document.getElementById("scanOnce");
    const uploadBtn = document.getElementById("uploadPhoto");
    const photoInput = document.getElementById("photoInput");

    startBtn.addEventListener("click", () => this.startCamera());
    stopBtn.addEventListener("click", () => this.stopCamera());
    scanBtn.addEventListener("click", () => this.scanOnce());
    uploadBtn.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", (e) => this.handleFileUpload(e));
  }

  async startCamera() {
    try {
      // Minta 1080p; kalau tidak bisa, browser akan fallback
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "environment",
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      const video = document.getElementById("cameraFeed");
      video.srcObject = this.stream;
      await video.play();

      // Coba applyConstraints lanjutan (tidak semua device mendukung)
      try {
        const track = this.stream.getVideoTracks()[0];
        await track.applyConstraints({
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" },
          ],
        });
      } catch (_) {
        /* abaikan jika tidak didukung */
      }

      video.style.display = "block";
      document.querySelector(".camera-placeholder").style.display = "none";
      document.querySelector(".detection-overlay").style.display = "block";

      this.setupDetectionCanvas();
      this.addCenterGuideBox();

      // Tunggu kamera settle
      await new Promise((r) => setTimeout(r, 500));

      document.getElementById("startCamera").disabled = true;
      document.getElementById("stopCamera").disabled = false;
      document.getElementById("scanOnce").disabled = false;
    } catch (error) {
      console.error("Error accessing camera:", error);
      if (window.notification) {
        window.notification.error("Gagal mengakses kamera. Pastikan izin sudah diberikan.");
      } else {
        alert("Gagal mengakses kamera. Pastikan izin sudah diberikan.");
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    const video = document.getElementById("cameraFeed");
    video.style.display = "none";
    video.srcObject = null;
    video.removeAttribute("poster");

    document.querySelector(".camera-placeholder").style.display = "block";
    document.querySelector(".detection-overlay").style.display = "none";

    const guide = document.getElementById("centerGuideBox");
    if (guide) guide.remove();

    document.getElementById("startCamera").disabled = false;
    document.getElementById("stopCamera").disabled = true;
    document.getElementById("scanOnce").disabled = true;
  }

  setLoading(isLoading, source = "scan") {
    this.isProcessing = isLoading;
    const scanBtn = document.getElementById("scanOnce");
    const uploadBtn = document.getElementById("uploadPhoto");
    if (scanBtn) scanBtn.disabled = isLoading;
    if (uploadBtn) uploadBtn.disabled = isLoading;

    // Update button text with proper icons
    if (isLoading) {
      if (source === "scan" && scanBtn) {
        scanBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Memproses...';
      } else if (source === "upload" && uploadBtn) {
        uploadBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Memproses...';
      }
    } else {
      if (source === "scan" && scanBtn) {
        scanBtn.innerHTML = '<i class="fas fa-camera"></i> Scan Sekali';
      } else if (source === "upload" && uploadBtn) {
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Foto';
      }
    }
  }

  async scanOnce() {
    if (this.isProcessing) {
      if (window.notification) {
        window.notification.warning("Sedang memproses deteksi, mohon tunggu...");
      } else {
        alert("Sedang memproses deteksi, mohon tunggu...");
      }
      return;
    }
    const video = document.getElementById("cameraFeed");
    if (!video.srcObject || video.readyState < video.HAVE_ENOUGH_DATA) {
      if (window.notification) {
        window.notification.warning("Kamera belum siap. Tunggu beberapa saat.");
      } else {
        alert("Kamera belum siap. Tunggu beberapa saat.");
      }
      return;
    }

    this.setLoading(true, "scan");
    try {
      // Pastikan frame terbaru sudah ter-render
      await new Promise((r) => requestAnimationFrame(r));

      // 1) Ambil burst snapshot dan pilih yang paling tajam
      const bestSnap = await this.getBestSnapshotFromVideo(video, 6, 45); // 6 frame, jeda 45ms

      // 2) Tampilkan snapshot sebagai poster video (pengguna melihat foto yang di-scan)
      this.displaySnapshotAsPoster(bestSnap, video);

      // 3) Buat multi-crop BERDASARKAN guide box (lebih relevan)
      const images = await this.createCropsFromGuideBox(bestSnap);

      // 4) Kirim ke server
      const result = await this.classifyImages(images);

      // 5) Update UI
      this.updateDetectionUI(result);
    } catch (err) {
      console.error("Error during scan:", err);
      const errorMessage = err?.message || "Gagal melakukan deteksi. Silakan coba lagi.";

      if (window.notification) {
        window.notification.error(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      this.setLoading(false, "scan");
    }
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      if (window.notification) {
        window.notification.error("Harap pilih file gambar yang valid.");
      } else {
        alert("Harap pilih file gambar yang valid.");
      }
      return;
    }
    if (this.isProcessing) {
      if (window.notification) {
        window.notification.warning("Sedang memproses deteksi, mohon tunggu...");
      } else {
        alert("Sedang memproses deteksi, mohon tunggu...");
      }
      return;
    }

    this.setLoading(true, "upload");
    try {
      const img = await this.loadImage(file);

      // pastikan area tampil
      const video = document.getElementById("cameraFeed");
      video.style.display = "block";
      document.querySelector(".camera-placeholder").style.display = "none";
      document.querySelector(".detection-overlay").style.display = "block";
      this.setupDetectionCanvas();
      this.addCenterGuideBox();

      // Agar pipeline sama, konversi gambar ke canvas snapshot
      const snap = document.createElement("canvas");
      snap.width = img.width;
      snap.height = img.height;
      snap.getContext("2d").drawImage(img, 0, 0);

      const images = await this.createCropsFromGuideBox(snap);
      const result = await this.classifyImages(images);

      this.updateDetectionUI(result);
      this.displayUploadedImage(img);
    } catch (error) {
      console.error("Error processing upload:", error);
      const errorMessage = error?.message || "Gagal memproses gambar. Silakan coba lagi.";

      if (window.notification) {
        window.notification.error(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      this.setLoading(false, "upload");
      event.target.value = "";
    }
  }

  // ======== BURST & SHARPNESS ========
  async getBestSnapshotFromVideo(video, nFrames = 5, delayMs = 40) {
    // Coba still full-res jika tersedia
    const still = await this.captureStillFromTrack();
    if (still) return still;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const tmp = document.createElement("canvas");
    tmp.width = vw;
    tmp.height = vh;
    const ctx = tmp.getContext("2d", { willReadFrequently: true });

    let bestCanvas = null;
    let bestScore = -Infinity;

    for (let i = 0; i < nFrames; i++) {
      ctx.drawImage(video, 0, 0, vw, vh);
      const score = this.sharpnessVarianceOfLaplacian(
        ctx.getImageData(0, 0, vw, vh)
      );
      if (score > bestScore) {
        bestScore = score;
        // salin ke canvas baru (jangan pakai referensi yang sama)
        bestCanvas = document.createElement("canvas");
        bestCanvas.width = vw;
        bestCanvas.height = vh;
        bestCanvas.getContext("2d").drawImage(tmp, 0, 0);
      }
      // jeda kecil agar autofocus/exposure bisa berubah
      if (i < nFrames - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return bestCanvas;
  }

  // Variance of Laplacian (approx) – cukup bagus untuk ranking ketajaman
  sharpnessVarianceOfLaplacian(imageData) {
    const { data, width, height } = imageData;
    // grayscale cepat
    const gray = new Float32Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    // kernel Laplacian 3x3: [0,1,0;1,-4,1;0,1,0]
    let sum = 0,
      sumSq = 0,
      count = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const lap =
          gray[i - width] +
          gray[i + width] +
          gray[i - 1] +
          gray[i + 1] -
          4 * gray[i];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance;
  }

  async captureStillFromTrack() {
    try {
      const track = this.stream?.getVideoTracks?.()[0];
      if (!track || typeof ImageCapture === "undefined") return null;
      const ic = new ImageCapture(track);
      const blob = await ic.takePhoto();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext("2d").drawImage(bmp, 0, 0);
      bmp.close?.();
      return c;
    } catch {
      return null;
    }
  }

  // ======== CROPPING DARI GUIDE BOX ========
  setupDetectionCanvas() {
    let canvas = document.getElementById("detectionCanvas");
    const container = document.querySelector(".video-container");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "detectionCanvas";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "10";
      container.appendChild(canvas);
    }
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return canvas;
  }

  addCenterGuideBox() {
    const container = document.querySelector(".video-container");
    if (!container || document.getElementById("centerGuideBox")) return;

    const box = document.createElement("div");
    box.id = "centerGuideBox";
    box.style.position = "absolute";
    box.style.top = "50%";
    box.style.left = "50%";
    box.style.width = "40%";
    box.style.height = "40%";
    box.style.transform = "translate(-50%, -50%)";
    box.style.border = "3px solid rgba(0,255,0,0.8)";
    box.style.borderRadius = "10px";
    box.style.zIndex = "12";
    box.style.pointerEvents = "none";
    box.style.boxShadow = "0 0 25px rgba(0,255,0,0.3)";
    container.appendChild(box);
  }

  // Ambil crops mengacu pada posisi guide box (lebih fokus pada objek tengah)
  async createCropsFromGuideBox(sourceCanvas) {
    const SEND_W = 640;
    const SEND_H = 480;

    const sW = sourceCanvas.width;
    const sH = sourceCanvas.height;

    // Di createCropsFromGuideBox(), tambahkan crop khusus untuk objek di tangan:
    const variants = [
      { scale: 1.0, name: "tight" }, // area guide box
      { scale: 1.5, name: "medium" }, // area lebih luas
      { scale: 2.2, name: "wide" }, // area sangat luas
      { scale: 2.8, name: "hand-object" }, // khusus untuk objek di tangan
    ];

    const out = [];
    for (const v of variants) {
      const crop = this.calculateCrop(sW, sH, v.scale, v.name);
      const base64 = await this.createCropImage(
        sourceCanvas,
        crop,
        SEND_W,
        SEND_H
      );
      out.push(base64);
    }

    return out;
  }

  calculateCrop(sourceW, sourceH, scale, type) {
    if (type === "hand-object") {
      // Crop khusus untuk objek di tangan - area lebih fokus
      const centerX = sourceW / 2;
      const centerY = sourceH / 2;
      const cropSize = Math.min(sourceW, sourceH) * 0.4; // 40% dari sisi terpendek

      return {
        x: centerX - cropSize / 2,
        y: centerY - cropSize / 2,
        width: cropSize,
        height: cropSize,
      };
    }

    // Crop normal berdasarkan guide box
    const boxScale = 0.4;
    const boxW = sourceW * boxScale;
    const boxH = sourceH * boxScale;
    const boxX = (sourceW - boxW) / 2;
    const boxY = (sourceH - boxH) / 2;

    const w = Math.min(sourceW, boxW * scale);
    const h = Math.min(sourceH, boxH * scale);
    const x = Math.max(0, (sourceW - w) / 2);
    const y = Math.max(0, (sourceH - h) / 2);

    return { x, y, w, h };
  }

  async createCropImage(sourceCanvas, crop, targetW, targetH, quality = 0.95) {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    // Jaga rasio target
    const targetRatio = targetW / targetH;
    let cropW = crop.w;
    let cropH = crop.w / targetRatio;

    if (cropH > crop.h) {
      cropH = crop.h;
      cropW = crop.h * targetRatio;
    }

    const cropX = Math.max(0, crop.x + (crop.w - cropW) / 2);
    const cropY = Math.max(0, crop.y + (crop.h - cropH) / 2);

    // Clamp crop area ke dalam bounds
    const finalCropX = Math.max(0, Math.min(cropX, sourceCanvas.width - cropW));
    const finalCropY = Math.max(
      0,
      Math.min(cropY, sourceCanvas.height - cropH)
    );
    const finalCropW = Math.min(cropW, sourceCanvas.width - finalCropX);
    const finalCropH = Math.min(cropH, sourceCanvas.height - finalCropY);

    ctx.drawImage(
      sourceCanvas,
      finalCropX,
      finalCropY,
      finalCropW,
      finalCropH,
      0,
      0,
      targetW,
      targetH
    );

    return await this.canvasToBase64(canvas, quality);
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  displaySnapshotAsPoster(snapshotCanvas, video) {
    // Tampilkan snapshot sebagai poster video agar pengguna melihat foto yang di-scan
    const posterCanvas = document.createElement("canvas");
    const ctx = posterCanvas.getContext("2d");

    // Sesuaikan dengan ukuran video container
    const container = document.querySelector(".video-container");
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    posterCanvas.width = containerWidth;
    posterCanvas.height = containerHeight;

    // Hitung scaling untuk mempertahankan aspect ratio
    const scale = Math.min(
      containerWidth / snapshotCanvas.width,
      containerHeight / snapshotCanvas.height
    );

    const scaledWidth = snapshotCanvas.width * scale;
    const scaledHeight = snapshotCanvas.height * scale;
    const x = (containerWidth - scaledWidth) / 2;
    const y = (containerHeight - scaledHeight) / 2;

    // Background hitam
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    // Gambar snapshot di tengah
    ctx.drawImage(snapshotCanvas, x, y, scaledWidth, scaledHeight);

    // Set sebagai poster
    video.poster = posterCanvas.toDataURL("image/jpeg", 0.9);
    video.style.display = "block";
  }

  displayUploadedImage(img) {
    const video = document.getElementById("cameraFeed");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = video.clientWidth || 640;
    canvas.height = video.clientHeight || 480;

    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    video.poster = canvas.toDataURL("image/jpeg");
    video.style.display = "block";
    document.querySelector(".camera-placeholder").style.display = "none";
  }

  canvasToBase64(canvas, quality = 0.95) {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    });
  }

  async classifyImages(images) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    try {
      // Ambil user email untuk disimpan ke Supabase
      const user = getStoredUser();
      const userEmail = user?.email || null;

      const res = await fetch("/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail || "" // Tambahkan header untuk userEmail
        },
        body: JSON.stringify({
          images,
          userEmail: userEmail // Tambahkan userEmail di body juga
        }),
        signal: controller.signal,
      });

      const text = await res.text();
      let errorData;

      try {
        errorData = JSON.parse(text);
      } catch {
        // Jika response bukan JSON, buat error message dari text
        throw new Error(text || `Server error: ${res.status}`);
      }

      if (!res.ok) {
        // Cek apakah error response memiliki message
        const errorMessage = errorData?.message || errorData?.error || `Server error: ${res.status}`;

        // Handle specific error types
        if (errorData?.error === "missing_api_key") {
          throw new Error("OpenAI API key tidak ditemukan. Silakan hubungi administrator untuk mengkonfigurasi API key.");
        } else if (errorData?.error === "openai_rate_limit") {
          throw new Error("Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba lagi.");
        } else if (errorData?.error === "cooldown" || errorData?.error === "server_busy") {
          throw new Error("Server sedang sibuk. Silakan tunggu beberapa saat.");
        }

        throw new Error(errorMessage);
      }

      return errorData;
    } catch (err) {
      // Handle AbortError (timeout)
      if (err.name === "AbortError") {
        throw new Error("Request timeout. Silakan coba lagi atau gunakan gambar yang lebih kecil.");
      }

      // Re-throw error yang sudah di-format
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  updateDetectionUI(result) {
    const decision = result?.decision;
    if (!decision) {
      console.warn("No decision in result");
      this.renderUnknownBin();
      return;
    }

    const { bin, confidence, dominant_class, reason } = decision;

    const nameEl = document.getElementById("detectedName");
    const typeEl = document.getElementById("detectedType");
    const confEl = document.getElementById("detectedConfidence");

    if (nameEl) nameEl.textContent = dominant_class || "Tidak Dikenali";
    if (typeEl) typeEl.textContent = bin ? bin.toUpperCase() : "-";
    if (confEl)
      confEl.textContent =
        typeof confidence === "number"
          ? `${Math.round(confidence * 100)}%`
          : "-";

    const reasonEl = document.getElementById("detectedReason");
    if (reasonEl && reason) reasonEl.textContent = reason;

    const binContainer = document.getElementById("recommendedBin");
    const templateId = this.mapBinToTemplate(bin);
    binContainer.innerHTML = "";
    const template = document.getElementById(templateId);
    if (template) {
      const clone = template.content.cloneNode(true);
      binContainer.appendChild(clone);
    } else {
      this.renderUnknownBin();
    }

    const labelSource =
      dominant_class ||
      (Array.isArray(result?.detections)
        ? result.detections.find((item) => item?.label)?.label
        : null) ||
      bin;
    persistDetectionLabel(labelSource, bin, confidence);

    console.log("✅ Detection result:", decision);

    // 📚 Display Education Card (Fun Fact)
    this.displayEducationCard(decision);

    // 🎬 Display Cinema Ticket (Video Tutorial Link)
    this.displayCinemaTicket(decision);

    // 🔊 Voice feedback - announce detection result
    if (window.themeManager) {
      window.themeManager.announceDetection(decision);
    }


  }

  displayEducationCard(decision) {
    const educationCard = document.getElementById("educationCard");
    const funFactText = document.getElementById("funFactText");
    const recyclingTipsContainer = document.getElementById("recyclingTipsContainer");
    const recyclingAdviceText = document.getElementById("recyclingAdviceText");

    // Ambil fun_fact dan recycling_advice dari decision
    const funFact = decision?.fun_fact;
    const recyclingAdvice = decision?.recycling_advice;

    let hasContent = false;

    // Tampilkan Fun Fact jika ada
    if (funFact && funFact.trim()) {
      funFactText.textContent = funFact;
      hasContent = true;
    } else {
      funFactText.textContent = ""; // Clear content if no fun fact
    }

    // Tampilkan Recycling Tips jika ada
    if (recyclingAdvice && recyclingAdvice.trim()) {
      recyclingAdviceText.textContent = recyclingAdvice;
      recyclingTipsContainer.style.display = "flex";
      hasContent = true;
    } else {
      recyclingTipsContainer.style.display = "none";
      recyclingAdviceText.textContent = ""; // Clear content if no advice
    }

    // Tampilkan atau sembunyikan card
    if (hasContent) {
      educationCard.style.display = "block";

      // Tambahkan animasi fade-in
      educationCard.style.opacity = "0";
      setTimeout(() => {
        educationCard.style.transition = "opacity 0.5s ease-in";
        educationCard.style.opacity = "1";
      }, 100);
    } else {
      educationCard.style.display = "none";
    }
  }

  displayCinemaTicket(decision) {
    const cinemaTicket = document.getElementById("cinemaTicket");
    const cinemaLink = document.getElementById("cinemaLink");
    const cinemaDescription = document.getElementById("cinemaDescription");

    // Ambil youtube_query dari decision
    const youtubeQuery = decision?.youtube_query;
    const dominantClass = decision?.dominant_class;

    if (youtubeQuery && youtubeQuery.trim()) {
      // Build URL to katalog page with search parameter
      // Add timestamp to prevent caching issues
      const timestamp = Date.now();
      const searchUrl = `katalog.html?search=${encodeURIComponent(youtubeQuery)}&t=${timestamp}`;

      console.log("🎬 Cinema Ticket - YouTube Query:", youtubeQuery);
      console.log("🎬 Cinema Ticket - Generated URL:", searchUrl);

      // Update link
      cinemaLink.href = searchUrl;

      // Update description
      if (dominantClass) {
        cinemaDescription.textContent = `Lihat tutorial kreatif untuk ${dominantClass}`;
      } else {
        cinemaDescription.textContent = "Lihat cara kreatif mengolah sampah ini";
      }

      // Show ticket with animation
      cinemaTicket.style.display = "block";
      cinemaTicket.style.opacity = "0";
      setTimeout(() => {
        cinemaTicket.style.transition = "opacity 0.5s ease-in";
        cinemaTicket.style.opacity = "1";
      }, 200);
    } else {
      // Hide if no youtube query
      cinemaTicket.style.display = "none";
    }
  }



  renderUnknownBin() {
    const binContainer = document.getElementById("recommendedBin");
    if (!binContainer) return;
    const template = document.getElementById("unknownBin");
    binContainer.innerHTML = "";
    if (template) {
      binContainer.appendChild(template.content.cloneNode(true));
    } else {
      binContainer.innerHTML = `<p>Tidak ada rekomendasi</p>`;
    }
  }

  mapBinToTemplate(bin) {
    if (!bin) return "unknownBin";
    switch (bin.toLowerCase()) {
      case "hijau":
        return "organicBin";
      case "kuning":
        return "inorganicBin";
      case "merah":
        return "hazardousBin";
      case "biru":
        return "paperBin";
      case "abu-abu":
        return "residualBin";
      default:
        return "unknownBin";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.wasteDetectionSystem = new WasteDetectionSystem();
});

