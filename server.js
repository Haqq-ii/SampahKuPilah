// server.js - SampahKuPilah Backend Server
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import bcrypt from "bcrypt";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Validasi dan setup OpenAI API Key
const apiKey = process.env.OPENAI_API_KEY?.trim();

if (!apiKey) {
  console.error("❌ ERROR: OPENAI_API_KEY tidak ditemukan!");
  console.error("   Pastikan file .env ada dan berisi OPENAI_API_KEY");
  console.warn("⚠️  Fitur deteksi sampah tidak akan berfungsi!");
} else {
  const isPlaceholder = apiKey.toLowerCase().includes("your_") || 
                        apiKey.toLowerCase().includes("example") ||
                        apiKey.toLowerCase().includes("placeholder") ||
                        apiKey.length < 20;
  
  if (isPlaceholder) {
    console.error("❌ ERROR: OPENAI_API_KEY masih placeholder!");
    console.error("   Edit file .env dengan API key yang valid");
    console.warn("⚠️  Fitur deteksi sampah tidak akan berfungsi!");
  } else if (!apiKey.startsWith("sk-")) {
    console.warn("⚠️  OPENAI_API_KEY format mungkin tidak valid (seharusnya dimulai dengan 'sk-')");
  }
  
  process.env.OPENAI_API_KEY = apiKey;
  console.log("🔑 OPENAI_API_KEY tersedia:", apiKey.length, "karakter");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Helper Functions ===
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8");

const normalizeEmail = (v) => typeof v === "string" ? v.trim().toLowerCase() : "";
const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
const writeUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2), "utf-8");
const findUserByEmail = (users, email) => users.find((u) => normalizeEmail(u.email) === normalizeEmail(email));

// === Rate Limiting ===
const rateLimitStore = new Map();

const checkRateLimit = (identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const key = identifier;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  const record = rateLimitStore.get(key);

  // Reset if window expired
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // Check if exceeded
  if (record.count >= maxAttempts) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
  };
};

const getClientIdentifier = (req) => (
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.headers["x-real-ip"] ||
  req.connection?.remoteAddress ||
  req.socket?.remoteAddress ||
  "unknown"
);

// Cleanup rate limit records setiap 30 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
}, 30 * 60 * 1000);

// === Validation Functions ===
const validateEmail = (email) => {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email wajib diisi" };
  }

  const trimmed = email.trim().toLowerCase();

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Format email tidak valid" };
  }

  // Check length
  if (trimmed.length > 254) {
    return { valid: false, error: "Email terlalu panjang" };
  }

  // Check local part
  const [localPart] = trimmed.split("@");
  if (localPart.length > 64) {
    return { valid: false, error: "Email tidak valid" };
  }

  // Check for invalid patterns
  if (trimmed.startsWith(".") || trimmed.endsWith(".") || trimmed.includes("..")) {
    return { valid: false, error: "Format email tidak valid" };
  }

  return { valid: true, error: null };
};

const validatePassword = (password) => {
  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Password wajib diisi"] };
  }

  const errors = [];

  // Minimal 8 karakter
  if (password.length < 8) {
    errors.push("Password minimal 8 karakter");
  }

  // Harus ada huruf besar
  if (!/[A-Z]/.test(password)) {
    errors.push("Password harus mengandung huruf besar (A-Z)");
  }

  // Harus ada huruf kecil
  if (!/[a-z]/.test(password)) {
    errors.push("Password harus mengandung huruf kecil (a-z)");
  }

  // Harus ada angka
  if (!/[0-9]/.test(password)) {
    errors.push("Password harus mengandung angka (0-9)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// === Authentication Routes ===
app.post("/register", async (req, res) => {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(`register:${clientId}`, 5, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rateLimit.retryAfter / 60)} menit.`,
        retryAfter: rateLimit.retryAfter,
      });
    }

    const { email: rawEmail, password } = req.body;

    const emailValidation = validateEmail(rawEmail);
    if (!emailValidation.valid) {
      return res.status(400).json({ message: emailValidation.error });
    }

    const email = normalizeEmail(rawEmail);
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: passwordValidation.errors.join(", "),
      });
    }

    const users = readUsers();
    if (findUserByEmail(users, email)) {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    users.push({ email, passwordHash, provider: "local" });
    writeUsers(users);

    rateLimitStore.delete(`register:${clientId}`);
    res.json({ message: "Pendaftaran berhasil" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(`login:${clientId}`, 10, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(rateLimit.retryAfter / 60)} menit.`,
        retryAfter: rateLimit.retryAfter,
      });
    }

    const { email: rawEmail, password } = req.body;
    const email = normalizeEmail(rawEmail);
    const users = readUsers();
    const user = findUserByEmail(users, email);

    if (!user) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    rateLimitStore.delete(`login:${clientId}`);
    res.json({ message: "Login berhasil", user: { email } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
});

app.post("/save-google-user", (req, res) => {
  const user = req.body;
  const users = readUsers();
  if (!findUserByEmail(users, user.email)) {
    users.push(user);
    writeUsers(users);
  }
  res.json({ message: "Google user disimpan!" });
});

// === YouTube API Proxy ===
app.get("/api/youtube/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString();
    const maxResults = Math.max(1, Math.min(5, parseInt(req.query.maxResults || "3", 10)));
    const key = process.env.YOUTUBE_API_KEY;

    if (!q) return res.status(400).json({ error: "query_missing" });

    if (!key) {
      return res.json({
        items: [
          {
            id: { videoId: "bM5cZFZ6XRM" },
            snippet: {
              title: "Daur Ulang Botol Plastik Menjadi Pot Bunga - DIY",
              thumbnails: {
                medium: { url: "https://i.ytimg.com/vi/bM5cZFZ6XRM/mqdefault.jpg" },
              },
            },
          },
          {
            id: { videoId: "9m1qJ3Qv8ss" },
            snippet: {
              title: "Cara Membuat Pot dari Botol Plastik Bekas",
              thumbnails: {
                medium: { url: "https://i.ytimg.com/vi/9m1qJ3Qv8ss/mqdefault.jpg" },
              },
            },
          },
          {
            id: { videoId: "o7vjW3m3o9g" },
            snippet: {
              title: "DIY: Pot Bunga dari Botol Bekas yang Estetik",
              thumbnails: {
                medium: { url: "https://i.ytimg.com/vi/o7vjW3m3o9g/mqdefault.jpg" },
              },
            },
          },
        ].slice(0, maxResults),
      });
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("key", key);

    const r = await fetch(url, { method: "GET" });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "youtube_error", detail: text });
    }
    const data = await r.json();
    return res.json(data);
  } catch (err) {
    console.error("/api/youtube/search error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// === OpenAI Chat Proxy ===
app.post("/api/openai/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: "messages_required", 
        message: "Array messages diperlukan" 
      });
    }

    if (messages.length > 50) {
      return res.status(400).json({ 
        error: "too_many_messages", 
        message: "Terlalu banyak pesan dalam satu request" 
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices?.[0]?.message?.content?.trim();

    return res.json({
      message: assistantMessage || "Maaf, tidak ada respons dari AI.",
    });
  } catch (err) {
    if (err?.status === 429) {
      return res.status(429).json({
        error: "rate_limit",
        message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
      });
    }
    console.error("💥 AI Chat error:", err);
    return res.status(500).json({
      error: "internal_error",
      message: "Terjadi kesalahan saat menghubungkan ke layanan AI.",
    });
  }
});

// === Waste Classification Endpoint ===
let classifyBusy = false;
let lastClassifyAt = 0;
const CLASSIFY_COOLDOWN_MS = 5000;

app.post("/classify", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    
    if (!apiKey) {
      return res.status(500).json({
        error: "missing_api_key",
        message: "OpenAI API key tidak dikonfigurasi. Pastikan OPENAI_API_KEY sudah diset di file .env"
      });
    }
    
    const isPlaceholder = apiKey.toLowerCase().includes("your_") || 
                          apiKey.toLowerCase().includes("example") ||
                          apiKey.toLowerCase().includes("placeholder") ||
                          apiKey.length < 20;
    
    if (isPlaceholder) {
      return res.status(500).json({
        error: "invalid_api_key",
        message: "OpenAI API key tidak valid atau masih placeholder. Edit file .env dengan API key yang valid"
      });
    }

    const { imageBase64, images } = req.body || {};
    let imageUrls = [];
    if (Array.isArray(images) && images.length > 0) {
      imageUrls = images
        .filter((b64) => typeof b64 === "string" && b64.length > 16)
        .map((b64) => `data:image/jpeg;base64,${b64}`);
    } else if (typeof imageBase64 === "string" && imageBase64.length > 16) {
      imageUrls = [`data:image/jpeg;base64,${imageBase64}`];
    }

    if (imageUrls.length === 0) {
      return res
        .status(400)
        .json({ error: "imageBase64 or images[] is required" });
    }

    // Global cooldown + single-flight
    const now = Date.now();
    const elapsed = now - lastClassifyAt;
    if (elapsed < CLASSIFY_COOLDOWN_MS) {
      const wait = CLASSIFY_COOLDOWN_MS - elapsed;
      return res.status(429).json({ error: "cooldown", cooldown_ms: wait });
    }
    if (classifyBusy) {
      return res
        .status(429)
        .json({ error: "server_busy", cooldown_ms: CLASSIFY_COOLDOWN_MS });
    }

    classifyBusy = true;
    lastClassifyAt = Date.now();

    const prompt = `
Kamu adalah sistem klasifikasi sampah untuk konteks Indonesia.
Kamu akan menerima hingga EMPAT gambar dari frame yang sama:
- "tight": crop ketat area tengah (60%)
- "center": crop tengah (80%) 
- "wide": crop lebar (90%)
- "hand-object": crop khusus objek di tangan

FOKUS PADA OBJEK YANG DIPEGANG TANGAN, bukan tangan itu sendiri.
Analisis objek yang paling dominan dan jelas terlihat.

Prioritas klasifikasi:
1) "merah" (B3): baterai, powerbank, lampu neon, elektronik kecil
2) "hijau" (organik): sisa makanan, sayur, buah, daun, tisu kotor
3) "biru" (kertas): kertas & kardus (bersih atau sedikit kotor)
4) "kuning" (anorganik): plastik, logam, kaca, kemasan
5) "abu-abu" (residu): popok, pembalut, foam, serpihan campuran

ATURAN KHUSUS:
- Jika ada objek jelas di tangan → klasifikasi objek tersebut
- Jika objek di tangan adalah kertas → "biru" (meskipun ada tangan)
- Jika hanya tangan tanpa objek → "abu-abu"
- Abaikan tangan, fokus pada objek yang dipegang

Jawab JSON: {"category":"biru","reason":"kertas di tangan","confidence":0.9}
`;

    // Bangun messages (multi-image)
    const userContent = imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 90,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed = { category: "abu-abu", reason: "tidak jelas", confidence: 0.7 };

    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const o = JSON.parse(m[0]);
        if (typeof o.category === "string") parsed.category = o.category;
        if (typeof o.reason === "string") parsed.reason = o.reason;
        if (typeof o.confidence === "number") {
          parsed.confidence = Math.max(0, Math.min(1, o.confidence));
        }
      }
    } catch {}

    const color = (parsed.category || "abu-abu").toLowerCase();
    const conf = parsed.confidence ?? 0.85;

    const binMap = {
      hijau: "Organik",
      kuning: "Anorganik",
      merah: "B3",
      biru: "Kertas",
      "abu-abu": "Residu",
    };
    const binName = binMap[color] || "Residu";

    const decision = {
      dominant_class: binName,
      bin: color,
      confidence: conf,
      reason: parsed.reason,
    };

    const detections = [
      {
        class: binName,
        confidence: conf,
        bbox: { x: 0.22, y: 0.22, w: 0.56, h: 0.56 },
        waste_type: binName,
        bin: color,
      },
    ];

    return res.json({ detections, decision });
  } catch (err) {
    classifyBusy = false;
    
    if (err?.status === 429) {
      return res.status(429).json({ 
        error: "openai_rate_limit", 
        cooldown_ms: 12000,
        message: "Terlalu banyak permintaan ke OpenAI. Silakan tunggu beberapa saat."
      });
    }
    
    if (err?.message?.includes("API key") || err?.message?.includes("Missing credentials")) {
      console.error("❌ OPENAI_API_KEY error:", err.message);
      return res.status(500).json({ 
        error: "missing_api_key",
        message: "OpenAI API key tidak valid. Pastikan OPENAI_API_KEY sudah dikonfigurasi di file .env"
      });
    }
    
    console.error("💥 Classification error:", err);
    return res.status(500).json({ 
      error: "classification_error",
      message: err?.message || "Terjadi kesalahan saat memproses deteksi sampah"
    });
  } finally {
    classifyBusy = false;
  }
});

// === IoT Proxy ===
const ESP32_HOST = process.env.ESP32_HOST || "http://192.168.1.20";
const ESP32_TIMEOUT = 10000;

app.get("/api/iot/status", async (req, res) => {
  try {
    console.log(`🔍 Testing ESP32 connection: ${ESP32_HOST}`);
    const startTime = Date.now();
    
    const response = await fetch(`${ESP32_HOST}/status`, {
      method: "GET",
      signal: AbortSignal.timeout(ESP32_TIMEOUT),
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        connected: false,
        error: `ESP32 responded with status ${response.status}`,
        duration: `${duration}ms`
      });
    }

    const data = await response.json();
    console.log(`✅ ESP32 connection successful (${duration}ms)`);
    
    return res.json({ 
      connected: true,
      esp32: data,
      duration: `${duration}ms`,
      host: ESP32_HOST
    });
  } catch (err) {
    const errorMsg = err.name === 'AbortError' 
      ? "ESP32 timeout - tidak merespons"
      : err.message || "Gagal terhubung ke ESP32";
    
    console.error(`❌ ESP32 connection test failed:`, errorMsg);
    
    return res.status(504).json({ 
      connected: false,
      error: errorMsg,
      host: ESP32_HOST,
      troubleshooting: [
        "1. Pastikan ESP32 sudah terhubung ke WiFi",
        "2. Pastikan ESP32 dan server dalam jaringan WiFi yang sama",
        "3. Cek IP Address ESP32 di Serial Monitor",
        "4. Update ESP32_HOST di file .env jika IP berubah",
        "5. Coba ping ESP32 dari terminal: ping [IP_ESP32]"
      ]
    });
  }
});

app.get("/api/iot/open", async (req, res) => {
  const startTime = Date.now(); // Pindahkan ke luar try block
  
  try {
    const binType = req.query.type;
    
    if (!binType) {
      return res.status(400).json({ error: "Parameter 'type' required" });
    }

    // Validasi bin type
    const validTypes = ["hijau", "merah", "biru", "abu-abu", "kuning"];
    if (!validTypes.includes(binType.toLowerCase())) {
      return res.status(400).json({ 
        error: "Invalid bin type. Use: hijau, merah, biru, abu-abu, or kuning" 
      });
    }

    // Proxy request ke ESP32
    const esp32Url = `${ESP32_HOST}/open?type=${encodeURIComponent(binType)}`;
    console.log(`📡 Proxying to ESP32: ${esp32Url}`);

    const response = await fetch(esp32Url, {
      method: "GET",
      signal: AbortSignal.timeout(ESP32_TIMEOUT), // 10 detik timeout
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ ESP32 error (${response.status}, ${duration}ms):`, errorText);
      return res.status(response.status).json({ 
        error: "ESP32 error", 
        detail: errorText,
        duration: `${duration}ms`
      });
    }

    const data = await response.json();
    console.log(`✅ ESP32 response (${duration}ms):`, data);
    
    return res.json({
      ...data,
      duration: `${duration}ms`
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    
    if (err.name === 'AbortError') {
      console.error(`⏱️ ESP32 timeout setelah ${duration}ms - IP: ${ESP32_HOST}`);
      return res.status(504).json({ 
        error: "ESP32 timeout", 
        message: `ESP32 tidak merespons dalam ${ESP32_TIMEOUT/1000} detik`,
        host: ESP32_HOST,
        troubleshooting: [
          "1. Pastikan ESP32 sudah terhubung ke WiFi dan server berjalan",
          "2. Pastikan ESP32 dan server dalam jaringan WiFi yang sama",
          "3. Cek IP Address ESP32 di Serial Monitor - mungkin berubah",
          "4. Update ESP32_HOST di file .env atau ubah di server.js",
          "5. Coba akses ESP32 langsung di browser: http://[IP_ESP32]/status",
          "6. Restart ESP32 jika perlu"
        ]
      });
    }
    
    console.error(`💥 IoT proxy error (${duration}ms):`, err.message);
    return res.status(500).json({ 
      error: "iot_connection_error", 
      message: err.message || "Gagal terhubung ke ESP32",
      host: ESP32_HOST,
      type: err.name
    });
  }
});

// === Static Files ===
app.use(express.static(path.join(__dirname, "public")));

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 ESP32 Host: ${ESP32_HOST}`);
});
