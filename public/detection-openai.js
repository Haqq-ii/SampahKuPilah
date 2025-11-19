/**
 * Multi-View Detection (tight/center/wide) untuk akurasi tinggi tanpa menambah jumlah request.
 * - Interval default 5s (aman limit)
 * - Kirim 3 crop dalam SATU request ke /classify
 * - Tetap ada stabilisasi (stableFrames) agar UI tidak berkedip
 */

export function initTrashDetection({
  video,
  canvas,
  onDecision = () => {},
  confThreshold = 0.45,
  stableFrames = 2,
  minIntervalMs = 5000, // 5 detik
  maxIntervalMs = 15000, // 15 detik adaptif
} = {}) {
  if (!video || !canvas) {
    console.error("❌ Video and canvas elements are required");
    return null;
  }

  const ctx = canvas.getContext("2d");

  // kanvas kecil untuk pengiriman (hemat token)
  const SEND_W = 320,
    SEND_H = 240;
  const canTight = document.createElement("canvas");
  const canCenter = document.createElement("canvas");
  const canWide = document.createElement("canvas");
  [canTight, canCenter, canWide].forEach((c) => {
    c.width = SEND_W;
    c.height = SEND_H;
  });
  const ctxT = canTight.getContext("2d", { willReadFrequently: true });
  const ctxC = canCenter.getContext("2d", { willReadFrequently: true });
  const ctxW = canWide.getContext("2d", { willReadFrequently: true });

  let isDetecting = false;
  let inFlight = false;
  let lastDecision = null;
  let stableCount = 0;
  let currentInterval = minIntervalMs;

  function jitter(ms, spread = 400) {
    const r = Math.floor(Math.random() * spread);
    return Math.max(0, ms - spread / 2 + r);
  }

  function dataURLBase64(cnv, quality = 0.7) {
    return new Promise((resolve) => {
      cnv.toBlob(
        (blob) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(String(fr.result).split(",")[1]);
          fr.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    });
  }

  async function ensureStream() {
    if (video.srcObject) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  }

  async function detectOnce() {
    if (!isDetecting || inFlight || video.readyState < video.HAVE_ENOUGH_DATA)
      return;

    // Sesuaikan overlay
    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    // 3 pandangan: tight(60%), center(80%), wide(90%)
    const crops = [
      { s: 0.6, ctx: ctxT, can: canTight }, // tight
      { s: 0.8, ctx: ctxC, can: canCenter }, // center
      { s: 0.9, ctx: ctxW, can: canWide }, // wide
    ];

    for (const { s, ctx: cctx } of crops) {
      const cw = vw * s,
        ch = vh * s;
      const cx = (vw - cw) / 2,
        cy = (vh - ch) / 2;
      cctx.drawImage(video, cx, cy, cw, ch, 0, 0, SEND_W, SEND_H);
    }

    const b64T = await dataURLBase64(canTight, 0.7);
    const b64C = await dataURLBase64(canCenter, 0.7);
    const b64W = await dataURLBase64(canWide, 0.7);

    inFlight = true;
    try {
      const resp = await fetch("/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [b64T, b64C, b64W] }),
      });

      if (resp.status === 429) {
        // baca cooldown dari server bila ada
        let cooldown = 10000;
        try {
          cooldown = Number((await resp.clone().json())?.cooldown_ms || 10000);
        } catch {}
        currentInterval = Math.min(
          Math.max(Math.floor(currentInterval * 1.6), cooldown),
          maxIntervalMs
        );
        console.warn(
          `⚠️ 429 — backoff ${(currentInterval / 1000).toFixed(1)}s`
        );
        return;
      }

      if (!resp.ok) {
        console.warn("❌ classify status:", resp.status);
        currentInterval = Math.min(
          Math.floor(currentInterval * 1.3),
          maxIntervalMs
        );
        return;
      }

      const result = await resp.json();
      const bin = result?.decision?.bin;
      const conf = result?.decision?.confidence ?? 0;

      if (!bin || conf < confThreshold) {
        currentInterval = Math.min(
          Math.floor(currentInterval * 1.15),
          maxIntervalMs
        );
        return;
      }

      // sukses → jadi sedikit lebih responsif
      currentInterval = Math.max(
        Math.floor(currentInterval * 0.9),
        minIntervalMs
      );

      if (lastDecision && lastDecision.bin === bin) {
        stableCount++;
      } else {
        stableCount = 1;
        lastDecision = { bin, conf };
      }

      if (stableCount >= stableFrames) {
        onDecision({
          bin,
          confidence: conf,
          dominantClass: result?.decision?.dominant_class || bin,
          allDetections: result?.detections || [],
        });
        stableCount = 0;
      }
    } catch (e) {
      console.error("💥 Detection error:", e);
      currentInterval = Math.min(
        Math.floor(currentInterval * 1.5),
        maxIntervalMs
      );
    } finally {
      inFlight = false;
    }
  }

  // single scheduler loop
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (isDetecting) await detectOnce();
      schedule();
    }, jitter(currentInterval));
  }

  const start = async () => {
    if (isDetecting) return;
    await ensureStream();
    isDetecting = true;
    currentInterval = minIntervalMs;
    console.log("🚀 Multi-View detection (tight/center/wide) start...");
    schedule();
  };

  const stop = () => {
    isDetecting = false;
    clearTimeout(timer);
    console.log("🛑 Detection stopped");
  };

  start();
  return { start, stop, isDetecting: () => isDetecting };
}
