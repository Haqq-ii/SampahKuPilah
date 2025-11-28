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
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

// === Supabase Setup ===
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("✅ Supabase connected:", supabaseUrl);
  } catch (error) {
    console.error("❌ Error connecting to Supabase:", error.message);
    console.warn("⚠️  Database operations will use JSON file fallback");
  }
} else {
  console.warn("⚠️  Supabase not configured (SUPABASE_URL or SUPABASE_SERVICE_KEY missing)");
  console.warn("   Database operations will use JSON file fallback");
  console.warn("   Add Supabase credentials to .env file to enable database features");
}

// Helper function untuk mendapatkan atau membuat auth.users.id dari email
// Menggunakan Supabase Admin API dengan service_role key
async function getOrCreateAuthUserId(email) {
  if (!supabase || !supabaseUrl || !supabaseServiceKey) return null;
  
  try {
    const normalizedEmail = normalizeEmail(email);
    
    // Coba dapatkan user dari auth.users menggunakan Admin API
    // Supabase Admin API: GET /auth/v1/admin/users dengan filter email
    const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse.ok) {
      const listData = await listResponse.json();
      if (listData && listData.users && Array.isArray(listData.users)) {
        const user = listData.users.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
        if (user && user.id) {
          console.log(`✅ Found auth user for: ${normalizedEmail}, id: ${user.id}`);
          return user.id;
        }
      }
    } else {
      const errorText = await listResponse.text();
      console.warn("Error listing auth users:", errorText.substring(0, 200));
    }
    
    // Jika tidak ditemukan, create user di auth.users
    // Menggunakan Supabase Admin API: POST /auth/v1/admin/users
    const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        email_confirm: true, // Auto-confirm email
        user_metadata: {}
      })
    });
    
    if (createResponse.ok) {
      const createData = await createResponse.json();
      if (createData && createData.user && createData.user.id) {
        console.log(`✅ Created auth user for: ${normalizedEmail}, id: ${createData.user.id}`);
        return createData.user.id;
      }
    } else {
      const errorText = await createResponse.text();
      console.error("Error creating auth user:", errorText.substring(0, 200));
    }
    
    // Jika gagal, return null dan akan menggunakan users.id sebagai fallback
    console.warn(`⚠️  Could not get/create auth user for: ${normalizedEmail}`);
    return null;
  } catch (err) {
    console.error("Error getting/creating auth user ID:", err.message);
    return null;
  }
}

// === Helper Functions ===
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8");

const normalizeEmail = (v) => typeof v === "string" ? v.trim().toLowerCase() : "";
const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
const writeUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2), "utf-8");
const findUserByEmail = (users, email) => users.find((u) => normalizeEmail(u.email) === normalizeEmail(email));

// === Supabase Helper Functions ===
// Fungsi untuk mencari user by email di Supabase
async function findUserByEmailSupabase(email) {
  if (!supabase) return null;
  
  try {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .single();
    
    if (error) {
      // PGRST116 = not found (ini normal, bukan error)
      if (error.code !== "PGRST116") {
        console.error("Error finding user in Supabase:", error);
      }
      return null;
    }
    
    return data;
  } catch (err) {
    console.error("Exception finding user in Supabase:", err);
    return null;
  }
}

// Fungsi untuk membuat user baru di Supabase
async function createUserSupabase(userData) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from("users")
      .insert({
        email: normalizeEmail(userData.email),
        password_hash: userData.passwordHash || null,
        provider: userData.provider || "local",
        name: userData.name || null,
        picture: userData.picture || null
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating user in Supabase:", error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error("Exception creating user in Supabase:", err);
    return null;
  }
}

// Fungsi untuk menyimpan hasil deteksi ke Supabase
async function saveDetectionSupabase(userEmail, detectionData) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from("detections")
      .insert({
        user_email: normalizeEmail(userEmail),
        category: detectionData.category || detectionData.bin || "abu-abu",
        bin_name: detectionData.bin_name || detectionData.dominant_class || "Residu",
        confidence: detectionData.confidence || 0.8,
        reason: detectionData.reason || "Auto-detected",
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error saving detection to Supabase:", error);
      return null;
    }
    
    console.log("✅ Detection saved to Supabase:", data.id);
    return data;
  } catch (err) {
    console.error("Exception saving detection to Supabase:", err);
    return null;
  }
}

// Fungsi untuk mengambil riwayat deteksi dari Supabase
async function getDetectionsSupabase(userEmail, limit = 50) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from("detections")
      .select("*")
      .eq("user_email", normalizeEmail(userEmail))
      .order("created_at", { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error("Error fetching detections from Supabase:", error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error("Exception fetching detections from Supabase:", err);
    return [];
  }
}

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

    // ✨ Cek user di Supabase dulu, fallback ke JSON
    let existingUser = null;
    if (supabase) {
      existingUser = await findUserByEmailSupabase(email);
    }
    
    // Jika tidak ada di Supabase, cek di JSON file (untuk backward compatibility)
    if (!existingUser) {
      const users = readUsers();
      existingUser = findUserByEmail(users, email);
    }

    if (existingUser) {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { email, passwordHash, provider: "local" };

    // ✨ Simpan ke Supabase jika tersedia, fallback ke JSON
    if (supabase) {
      // Pertama, create user di auth.users menggunakan Admin API
      let authUserId = null;
      try {
        authUserId = await getOrCreateAuthUserId(email);
        if (authUserId) {
          console.log(`✅ Auth user created/found for: ${email}, id: ${authUserId}`);
        }
      } catch (authErr) {
        console.warn("Failed to create auth user, will continue with users table:", authErr.message);
      }
      
      // Kemudian create user di tabel users
      const created = await createUserSupabase(newUser);
      if (!created) {
        // Fallback ke JSON jika Supabase error
        console.warn("Failed to create user in Supabase, falling back to JSON file");
        const users = readUsers();
        users.push(newUser);
        writeUsers(users);
      } else {
        console.log("✅ User created in Supabase:", email);
        // Jika authUserId berhasil dibuat, kita bisa update users table dengan auth_user_id jika ada kolom tersebut
        // Tapi untuk sekarang, kita akan menggunakan authUserId langsung saat create listing/order
      }
    } else {
      // Jika Supabase tidak tersedia, pakai JSON file
      const users = readUsers();
      users.push(newUser);
      writeUsers(users);
    }

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
    
    // ✨ Cari user di Supabase dulu, fallback ke JSON
    let user = null;
    if (supabase) {
      user = await findUserByEmailSupabase(email);
    }
    
    // Jika tidak ada di Supabase, cek di JSON file (untuk backward compatibility)
    if (!user) {
      const users = readUsers();
      user = findUserByEmail(users, email);
    }

    if (!user) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    // Handle password hash field name (Supabase pakai password_hash, JSON pakai passwordHash)
    const passwordHash = user.password_hash || user.passwordHash || "";
    const ok = await bcrypt.compare(password, passwordHash);
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

app.post("/save-google-user", async (req, res) => {
  try {
    const user = req.body;
    const email = normalizeEmail(user.email);
    
    // ✨ Cek user di Supabase dulu, fallback ke JSON
    let existingUser = null;
    if (supabase) {
      existingUser = await findUserByEmailSupabase(email);
    }
    
    // Jika tidak ada di Supabase, cek di JSON file
    if (!existingUser) {
      const users = readUsers();
      existingUser = findUserByEmail(users, email);
    }
    
    // Jika user belum ada, simpan ke Supabase atau JSON
    if (!existingUser) {
      if (supabase) {
        const created = await createUserSupabase({
          email: email,
          provider: "google",
          name: user.name || null,
          picture: user.picture || null
        });
        if (!created) {
          // Fallback ke JSON jika Supabase error
          const users = readUsers();
          users.push(user);
          writeUsers(users);
        } else {
          console.log("✅ Google user created in Supabase:", email);
        }
      } else {
        const users = readUsers();
        users.push(user);
        writeUsers(users);
      }
    }
    
    res.json({ message: "Google user disimpan!" });
  } catch (error) {
    console.error("Error saving Google user:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
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

    // ✨ Simpan deteksi ke Supabase (opsional - tidak akan error jika tidak ada userEmail)
    const userEmail = req.body.userEmail || req.headers["x-user-email"];
    if (userEmail && supabase) {
      // Simpan di background (tidak blocking response)
      saveDetectionSupabase(userEmail, {
        category: color,
        bin_name: binName,
        confidence: conf,
        reason: parsed.reason
      }).catch(err => {
        // Log error tapi tidak block response
        console.warn("Failed to save detection to Supabase (non-blocking):", err.message);
      });
    }

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

// === Supabase Test Endpoint (untuk verifikasi koneksi) ===
app.get("/api/supabase/test", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        connected: false,
        message: "Supabase not configured",
        instructions: [
          "1. Pastikan SUPABASE_URL dan SUPABASE_SERVICE_KEY sudah diisi di file .env",
          "2. Restart server setelah mengupdate .env",
          "3. Cek console untuk pesan error koneksi"
        ]
      });
    }

    // Test koneksi dengan query sederhana ke tabel users
    const { data, error, count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Supabase test error:", error);
      return res.status(500).json({
        connected: false,
        error: error.message,
        hint: error.code === "PGRST116" 
          ? "Tabel users mungkin belum dibuat atau kosong (ini normal untuk pertama kali)"
          : "Cek struktur tabel dan permissions di Supabase Dashboard"
      });
    }

    return res.json({
      connected: true,
      message: "✅ Supabase connection successful!",
      tables: {
        users: {
          accessible: true,
          recordCount: count || 0
        }
      },
      nextSteps: [
        "1. Test endpoint /api/supabase/test/detections untuk cek tabel detections",
        "2. Coba registrasi user baru untuk test insert",
        "3. Coba deteksi sampah untuk test save detection"
      ]
    });
  } catch (err) {
    console.error("Supabase test exception:", err);
    return res.status(500).json({
      connected: false,
      error: err.message,
      type: err.name
    });
  }
});

// Test endpoint untuk tabel detections
app.get("/api/supabase/test/detections", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        connected: false,
        message: "Supabase not configured"
      });
    }

    const { data, error, count } = await supabase
      .from("detections")
      .select("*", { count: "exact", head: true });

    if (error) {
      return res.status(500).json({
        connected: false,
        error: error.message,
        hint: "Pastikan tabel 'detections' sudah dibuat di Supabase"
      });
    }

    return res.json({
      connected: true,
      message: "✅ Tabel detections accessible!",
      detections: {
        accessible: true,
        recordCount: count || 0
      }
    });
  } catch (err) {
    return res.status(500).json({
      connected: false,
      error: err.message
    });
  }
});

// Endpoint untuk mengambil riwayat deteksi user dari Supabase
app.get("/api/detections", async (req, res) => {
  try {
    const userEmail = req.query.email || req.headers["x-user-email"];
    
    if (!userEmail) {
      return res.status(400).json({ 
        error: "email_required", 
        message: "Email user diperlukan (query parameter atau header x-user-email)" 
      });
    }

    if (!supabase) {
      return res.status(503).json({ 
        error: "database_not_available",
        message: "Supabase not configured. Using localStorage fallback.",
        detections: []
      });
    }

    const detections = await getDetectionsSupabase(userEmail, 50);
    
    return res.json({ 
      detections: detections || [],
      count: detections?.length || 0,
      source: "supabase"
    });
  } catch (err) {
    console.error("Error fetching detections:", err);
    return res.status(500).json({ 
      error: "server_error",
      message: err.message,
      detections: []
    });
  }
});

// === Marketplace Helper Functions ===
// Fungsi untuk generate order_id unik
function generateOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

// Fungsi untuk generate message_id unik
function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MSG-${timestamp}-${random}`;
}

// === Marketplace Endpoints ===
// GET /api/marketplace/listings - Ambil daftar listing dengan filter & sort
app.get("/api/marketplace/listings", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured",
        listings: []
      });
    }

    // Parse query parameters
    const {
      keyword,
      category,
      city,
      district,
      village,
      status = "active",
      sort = "newest",
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build query - ensure images column and seller_id are always selected
    let query = supabase
      .from("marketplace_listings")
      .select("*, images, seller_id", { count: "exact" }); // Explicitly include images and seller_id

    // Filter status
    if (status) {
      query = query.eq("status", status);
    }

    // Filter kategori
    if (category) {
      query = query.eq("category", category);
    }

    // Filter lokasi
    if (req.query.province) {
      query = query.eq("location_province", req.query.province);
    }
    if (city) {
      query = query.eq("location_city", city);
    }
    if (district) {
      query = query.eq("location_district", district);
    }
    if (village) {
      query = query.eq("location_village", village);
    }

    // Keyword search (full-text search pada search_text)
    if (keyword && keyword.trim()) {
      query = query.textSearch("search_text", keyword.trim(), {
        type: "websearch",
        config: "indonesian"
      });
    }

    // Sort
    switch (sort) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "price_low":
        query = query.order("price", { ascending: true, nullsLast: true });
        break;
      case "price_high":
        query = query.order("price", { ascending: false, nullsLast: true });
        break;
      case "relevance":
        // Jika ada keyword, relevance sudah di-handle oleh textSearch
        // Fallback ke newest
        query = query.order("created_at", { ascending: false });
        break;
      case "location":
        // Sort by location (city first, then district, then village)
        query = query
          .order("location_city", { ascending: true })
          .order("location_district", { ascending: true })
          .order("location_village", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching listings:", error);
      return res.status(500).json({
        error: "database_error",
        message: error.message,
        listings: []
      });
    }

    // Parse images for each listing (handle JSON string from Supabase)
    const listings = (data || []).map(listing => {
      if (listing.images) {
        if (typeof listing.images === 'string') {
          try {
            listing.images = JSON.parse(listing.images);
          } catch (e) {
            // If not JSON, treat as single image
            listing.images = listing.images.trim() ? [listing.images.trim()] : [];
          }
        }
        // Ensure it's an array
        if (!Array.isArray(listing.images)) {
          listing.images = [];
        }
      } else {
        listing.images = [];
      }
      return listing;
    });

    return res.json({
      listings: listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    });
  } catch (err) {
    console.error("Exception fetching listings:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message,
      listings: []
    });
  }
});

// DELETE /api/marketplace/listings/:id - Hapus listing (hanya owner)
app.delete("/api/marketplace/listings/:id", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { id } = req.params;
    const userEmail = req.headers["x-user-email"];
    
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan"
      });
    }

    // Ambil listing untuk validasi ownership
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        error: "not_found",
        message: "Listing tidak ditemukan"
      });
    }

    // Validasi: hanya owner yang bisa hapus
    if (listing.seller_email !== normalizeEmail(userEmail)) {
      return res.status(403).json({
        error: "forbidden",
        message: "Anda tidak memiliki izin untuk menghapus listing ini"
      });
    }

    // Cek apakah ada order yang masih pending/deal (tidak bisa hapus jika ada order aktif)
    const { data: activeOrders, error: ordersError } = await supabase
      .from("marketplace_orders")
      .select("id")
      .eq("listing_id", id)
      .in("status", ["pending", "deal"]);

    if (ordersError) {
      console.error("Error checking orders:", ordersError);
    }

    if (activeOrders && activeOrders.length > 0) {
      return res.status(400).json({
        error: "cannot_delete",
        message: "Tidak bisa menghapus listing yang masih memiliki order aktif (pending/deal). Silakan batalkan order terlebih dahulu."
      });
    }

    // Hapus listing (cascade akan menghapus order yang sudah done/canceled)
    const { error: deleteError } = await supabase
      .from("marketplace_listings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting listing:", deleteError);
      return res.status(500).json({
        error: "database_error",
        message: deleteError.message
      });
    }

    console.log("✅ Listing deleted:", id);
    return res.json({
      success: true,
      message: "Listing berhasil dihapus"
    });
  } catch (err) {
    console.error("Exception deleting listing:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// GET /api/marketplace/listings/:id - Ambil detail listing
app.get("/api/marketplace/listings/:id", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { id } = req.params;

    // Ensure images column and seller_id are always selected
    const { data, error } = await supabase
      .from("marketplace_listings")
      .select("*, images, seller_id") // Explicitly include images and seller_id
      .eq("id", id)
      .single();
    
    // Parse images if it's a JSON string
    if (data && data.images) {
      if (typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          // If not JSON, treat as single image
          data.images = data.images.trim() ? [data.images.trim()] : [];
        }
      }
      // Ensure it's an array
      if (!Array.isArray(data.images)) {
        data.images = [];
      }
    } else if (data) {
      data.images = [];
    }

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          error: "not_found",
          message: "Listing tidak ditemukan"
        });
      }
      console.error("Error fetching listing:", error);
      return res.status(500).json({
        error: "database_error",
        message: error.message
      });
    }

    // Ambil info seller (dari tabel users)
    let seller = null;
    if (data.seller_email) {
      const sellerData = await findUserByEmailSupabase(data.seller_email);
      if (sellerData) {
        seller = {
          email: sellerData.email,
          name: sellerData.name || sellerData.email.split("@")[0],
          picture: sellerData.picture || null
        };
      }
    }

    return res.json({
      ...data,
      seller: seller
    });
  } catch (err) {
    console.error("Exception fetching listing:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// POST /api/marketplace/enhance-image - Enhance gambar dengan Sharp
app.post("/api/marketplace/enhance-image", async (req, res) => {
  try {
    const { base64, mimeType, filename } = req.body;

    if (!base64 || !mimeType) {
      return res.status(400).json({
        error: "validation_error",
        message: "base64 dan mimeType diperlukan"
      });
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64, 'base64');

    // Enhance image dengan Sharp
    let enhancedBuffer;
    try {
      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      
      // Determine optimal dimensions (max 1920x1920, maintain aspect ratio)
      const maxDimension = 1920;
      let width = metadata.width;
      let height = metadata.height;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          width = maxDimension;
          height = Math.round((metadata.height / metadata.width) * maxDimension);
        } else {
          height = maxDimension;
          width = Math.round((metadata.width / metadata.height) * maxDimension);
        }
      }

      // Enhance image: resize, improve quality, optimize
      enhancedBuffer = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .modulate({
          brightness: 1.05,  // Slightly brighter
          saturation: 1.1,   // Slightly more vibrant
        })
        .sharpen({          // Sharpen for better clarity
          sigma: 1,
          flat: 1,
          jagged: 2
        })
        .normalize()        // Normalize colors
        .jpeg({             // Convert to JPEG for better compression
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      // Convert enhanced buffer to base64
      const enhancedBase64 = enhancedBuffer.toString('base64');
      const enhancedMimeType = 'image/jpeg';

      return res.json({
        success: true,
        enhanced: {
          base64: enhancedBase64,
          mimeType: enhancedMimeType,
          width: width,
          height: height,
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          sizeReduction: `${Math.round((1 - (enhancedBuffer.length / imageBuffer.length)) * 100)}%`
        }
      });
    } catch (sharpError) {
      console.error("Sharp processing error:", sharpError);
      // Fallback: return original if enhancement fails
      return res.json({
        success: false,
        error: "enhancement_failed",
        message: "Gagal melakukan enhancement, menggunakan gambar asli",
        original: {
          base64: base64,
          mimeType: mimeType
        }
      });
    }
  } catch (err) {
    console.error("Exception enhancing image:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// POST /api/marketplace/upload-image - Upload gambar ke Supabase Storage
app.post("/api/marketplace/upload-image", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const userEmail = req.headers["x-user-email"];
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan"
      });
    }

    const { base64, mimeType, filename, enhance = false } = req.body;

    if (!base64 || !mimeType) {
      return res.status(400).json({
        error: "validation_error",
        message: "base64 dan mimeType diperlukan"
      });
    }

    let finalBase64 = base64;
    let finalMimeType = mimeType;
    let finalBuffer;

    // Enhance image jika diminta
    if (enhance) {
      try {
        const imageBuffer = Buffer.from(base64, 'base64');
        const metadata = await sharp(imageBuffer).metadata();
        
        const maxDimension = 1920;
        let width = metadata.width;
        let height = metadata.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            width = maxDimension;
            height = Math.round((metadata.height / metadata.width) * maxDimension);
          } else {
            height = maxDimension;
            width = Math.round((metadata.width / metadata.height) * maxDimension);
          }
        }

        finalBuffer = await sharp(imageBuffer)
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .modulate({
            brightness: 1.05,
            saturation: 1.1,
          })
          .sharpen({
            sigma: 1,
            flat: 1,
            jagged: 2
          })
          .normalize()
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true
          })
          .toBuffer();

        finalBase64 = finalBuffer.toString('base64');
        finalMimeType = 'image/jpeg';
      } catch (enhanceError) {
        console.warn("Image enhancement failed, using original:", enhanceError.message);
        // Fallback to original
        finalBuffer = Buffer.from(base64, 'base64');
      }
    } else {
      finalBuffer = Buffer.from(base64, 'base64');
    }

    // Generate unique filename
    const fileExt = finalMimeType.split('/')[1] || 'jpg';
    const sanitizedFilename = (filename || `image-${Date.now()}`)
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 100);
    const storagePath = `listings/${Date.now()}-${sanitizedFilename}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('marketplace-images')
      .upload(storagePath, finalBuffer, {
        contentType: finalMimeType,
        upsert: false
      });

    if (uploadError) {
      console.error("Error uploading to Supabase Storage:", uploadError);
      // Fallback: return data URL if storage upload fails
      const dataUrl = `data:${finalMimeType};base64,${finalBase64}`;
      return res.json({
        url: dataUrl,
        path: null,
        isDataUrl: true,
        enhanced: enhance
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('marketplace-images')
      .getPublicUrl(storagePath);

    return res.json({
      url: urlData.publicUrl,
      path: storagePath,
      isDataUrl: false,
      enhanced: enhance
    });
  } catch (err) {
    console.error("Exception uploading image:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// POST /api/marketplace/enhance-listing - AI Enhancement untuk listing
app.post("/api/marketplace/enhance-listing", async (req, res) => {
  console.log("🔍 Enhancement endpoint called");
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    
    if (!apiKey) {
      return res.status(500).json({
        error: "missing_api_key",
        message: "OpenAI API key tidak dikonfigurasi"
      });
    }

    const {
      title,
      description,
      category,
      tags = [],
      price = 0
    } = req.body;

    // Validasi minimal
    if (!title || !description || !category) {
      return res.status(400).json({
        error: "validation_error",
        message: "Title, description, dan category wajib diisi untuk enhancement"
      });
    }

    // Prepare prompts untuk AI
    const titlePrompt = `Kamu adalah copywriter profesional untuk marketplace daur ulang di Indonesia.
Buatkan judul yang menarik, SEO-friendly, dan persuasif untuk produk berikut:

Kategori: ${category}
Judul asli: ${title}
Deskripsi: ${description}
${tags.length > 0 ? `Tag: ${tags.join(', ')}` : ''}

Buatkan 1 judul yang:
- Maksimal 60 karakter
- Menarik perhatian pembeli
- Mengandung kata kunci penting
- Sesuai dengan konteks Indonesia
- Tidak berlebihan atau clickbait

Jawab HANYA dengan judul yang dihasilkan, tanpa penjelasan tambahan.`;

    const descriptionPrompt = `Kamu adalah copywriter profesional untuk marketplace daur ulang di Indonesia.
Tuliskan deskripsi produk yang menarik, informatif, dan persuasif berdasarkan informasi berikut:

Kategori: ${category}
Judul: ${title}
Deskripsi asli: ${description}
${tags.length > 0 ? `Tag: ${tags.join(', ')}` : ''}
${price > 0 ? `Harga: Rp ${parseInt(price).toLocaleString('id-ID')}` : 'Harga: Gratis'}

Buatkan deskripsi yang:
- Maksimal 500 karakter
- Menjelaskan kondisi, ukuran, dan detail produk dengan jelas
- Menyebutkan manfaat dan nilai produk
- Menggunakan bahasa yang ramah dan profesional
- Sesuai dengan konteks Indonesia
- Tidak berlebihan atau menipu

Jawab HANYA dengan deskripsi yang dihasilkan, tanpa penjelasan tambahan.`;

    const tagsPrompt = `Berdasarkan informasi produk berikut, buatkan 3-5 tag yang relevan untuk memudahkan pencarian:

Kategori: ${category}
Judul: ${title}
Deskripsi: ${description}
${tags.length > 0 ? `Tag yang sudah ada: ${tags.join(', ')}` : ''}

Buatkan tag yang:
- Relevan dengan produk
- Populer untuk pencarian
- Maksimal 1-2 kata per tag
- Dalam bahasa Indonesia atau bahasa umum

Jawab dalam format JSON array: ["tag1", "tag2", "tag3"]
HANYA return JSON array, tanpa penjelasan tambahan.`;

    // Call OpenAI untuk enhancement
    const [titleResponse, descriptionResponse, tagsResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah copywriter profesional untuk marketplace." },
          { role: "user", content: titlePrompt }
        ],
        temperature: 0.7,
        max_tokens: 100
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah copywriter profesional untuk marketplace." },
          { role: "user", content: descriptionPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah ahli SEO dan tagging untuk marketplace." },
          { role: "user", content: tagsPrompt }
        ],
        temperature: 0.8,
        max_tokens: 150
      })
    ]);

    // Extract results
    const enhancedTitle = titleResponse.choices?.[0]?.message?.content?.trim() || title;
    const enhancedDescription = descriptionResponse.choices?.[0]?.message?.content?.trim() || description;
    
    // Parse tags (handle JSON array response)
    let enhancedTags = [...tags];
    try {
      const tagsContent = tagsResponse.choices?.[0]?.message?.content?.trim() || '[]';
      const parsedTags = JSON.parse(tagsContent);
      if (Array.isArray(parsedTags)) {
        // Merge dengan existing tags, remove duplicates
        enhancedTags = [...new Set([...tags, ...parsedTags])];
      }
    } catch (e) {
      // If parsing fails, try to extract tags from text
      const tagsText = tagsResponse.choices?.[0]?.message?.content?.trim() || '';
      const extractedTags = tagsText
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      if (extractedTags.length > 0) {
        enhancedTags = [...new Set([...tags, ...extractedTags])];
      }
    }

    // Limit tags to max 10
    enhancedTags = enhancedTags.slice(0, 10);

    return res.json({
      success: true,
      enhanced: {
        title: enhancedTitle,
        description: enhancedDescription,
        tags: enhancedTags
      },
      original: {
        title: title,
        description: description,
        tags: tags
      }
    });
  } catch (err) {
    console.error("Error enhancing listing:", err);
    
    if (err?.status === 429) {
      return res.status(429).json({
        error: "rate_limit",
        message: "Terlalu banyak permintaan ke AI. Silakan coba lagi nanti."
      });
    }
    
    if (err?.message?.includes("API key") || err?.message?.includes("Missing credentials")) {
      return res.status(500).json({
        error: "missing_api_key",
        message: "OpenAI API key tidak valid"
      });
    }
    
    return res.status(500).json({
      error: "enhancement_error",
      message: err?.message || "Terjadi kesalahan saat melakukan enhancement"
    });
  }
});

// POST /api/marketplace/listings - Buat listing baru
app.post("/api/marketplace/listings", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const userEmail = req.headers["x-user-email"];
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan (header x-user-email)"
      });
    }

    // Validasi user exists
    const user = await findUserByEmailSupabase(userEmail);
    if (!user) {
      return res.status(404).json({
        error: "user_not_found",
        message: "User tidak ditemukan"
      });
    }

    const {
      title,
      description,
      category,
      tags = [],
      price = 0,
      images = [],
      location_province,
      location_city,
      location_district,
      location_village,
      use_ai = false
    } = req.body;

    // Process images: normalize to array of URL strings
    // Expected format: array of {base64, mimeType, filename} OR array of URL strings
    let imageUrls = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (typeof img === 'string') {
          // Already a URL string (http/https or data URL)
          if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
            imageUrls.push(img);
          } else if (img.trim().length > 0) {
            // Might be a path, try to construct URL
            imageUrls.push(img.trim());
          }
        } else if (typeof img === 'object' && img !== null) {
          // Object format: {base64, mimeType, filename} or {url, path}
          if (img.url) {
            // Already has URL
            imageUrls.push(img.url);
          } else if (img.base64 && img.mimeType) {
            // Base64 format: convert to data URL (fallback if storage upload fails)
            imageUrls.push(`data:${img.mimeType};base64,${img.base64}`);
          } else if (img.path) {
            // Storage path: construct public URL
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/marketplace-images/${img.path}`;
            imageUrls.push(publicUrl);
          }
        }
      }
    }

    // Validasi required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        error: "validation_error",
        message: "Title, description, dan category wajib diisi"
      });
    }

    // Generate search_text (akan di-update oleh trigger, tapi kita set manual juga)
    const searchText = `${title} ${description} ${tags.join(" ")}`.toLowerCase();

    // Insert listing
    // Pastikan seller_id menggunakan auth.users.id yang valid
    // Coba dapatkan atau create auth.users.id
    let sellerId = user.id;
    const authUserId = await getOrCreateAuthUserId(userEmail);
    if (authUserId) {
      sellerId = authUserId;
      console.log(`✅ Using auth.users.id for seller: ${sellerId}`);
    } else {
      console.warn(`⚠️  Auth user ID not found/created for ${userEmail}, using users.id: ${user.id}`);
      // Tetap gunakan user.id, tapi ini mungkin akan error jika foreign key strict
      sellerId = user.id;
    }
    
    const { data, error } = await supabase
      .from("marketplace_listings")
      .insert({
        seller_id: sellerId, // Gunakan auth.users.id jika tersedia
        seller_email: normalizeEmail(userEmail),
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: Array.isArray(tags) ? tags : [],
        price: parseFloat(price) || 0,
        images: imageUrls,
        location_province: location_province?.trim() || null,
        location_city: location_city?.trim() || null,
        location_district: location_district?.trim() || null,
        location_village: location_village?.trim() || null,
        status: "active",
        ai_generated: use_ai || false,
        search_text: searchText
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating listing:", error);
      return res.status(500).json({
        error: "database_error",
        message: error.message
      });
    }

    console.log("✅ Listing created:", data.id);
    return res.status(201).json({
      listing: data,
      message: "Listing berhasil dibuat"
    });
  } catch (err) {
    console.error("Exception creating listing:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// POST /api/marketplace/orders - Buat order baru (Ajukan Pembelian)
app.post("/api/marketplace/orders", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const userEmail = req.headers["x-user-email"];
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan (header x-user-email)"
      });
    }

    const buyer = await findUserByEmailSupabase(userEmail);
    if (!buyer) {
      return res.status(404).json({
        error: "user_not_found",
        message: "User tidak ditemukan"
      });
    }

    const { listing_id } = req.body;
    if (!listing_id) {
      return res.status(400).json({
        error: "validation_error",
        message: "listing_id wajib diisi"
      });
    }

    // Ambil listing (pastikan seller_id di-select)
    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("*, seller_id") // Explicitly include seller_id
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        error: "listing_not_found",
        message: "Listing tidak ditemukan"
      });
    }

    // Validasi: tidak bisa beli listing sendiri
    if (listing.seller_email === normalizeEmail(userEmail)) {
      return res.status(400).json({
        error: "invalid_action",
        message: "Tidak bisa membeli listing sendiri"
      });
    }

    // Validasi: listing harus active
    if (listing.status !== "active") {
      return res.status(400).json({
        error: "invalid_status",
        message: "Listing tidak tersedia untuk dibeli"
      });
    }

    // Generate order_id
    const orderId = generateOrderId();

    // Create order
    // Pastikan seller_id dan buyer_id menggunakan auth.users.id yang valid
    // Coba dapatkan atau create auth.users.id untuk seller dan buyer
    let sellerId = listing.seller_id;
    let buyerId = buyer.id;
    
    // Dapatkan atau create auth.users.id untuk seller
    const sellerAuthId = await getOrCreateAuthUserId(listing.seller_email);
    if (sellerAuthId) {
      sellerId = sellerAuthId;
      console.log(`✅ Using auth.users.id for seller: ${sellerId}`);
    } else if (!listing.seller_id) {
      // Jika tidak ada seller_id di listing dan gagal create auth user, return error
      return res.status(400).json({
        error: "invalid_listing",
        message: "Listing tidak memiliki seller_id yang valid dan gagal membuat auth user"
      });
    } else {
      // Gunakan listing.seller_id yang sudah ada (mungkin dari listing lama)
      console.warn(`⚠️  Using existing listing.seller_id: ${listing.seller_id}`);
      sellerId = listing.seller_id;
    }
    
    // Dapatkan atau create auth.users.id untuk buyer
    const buyerAuthId = await getOrCreateAuthUserId(userEmail);
    if (buyerAuthId) {
      buyerId = buyerAuthId;
      console.log(`✅ Using auth.users.id for buyer: ${buyerId}`);
    } else {
      console.warn(`⚠️  Auth user ID not found/created for buyer ${userEmail}, using users.id: ${buyer.id}`);
      // Tetap gunakan buyer.id, tapi ini mungkin akan error jika foreign key strict
      buyerId = buyer.id;
    }

    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .insert({
        order_id: orderId,
        listing_id: listing_id,
        seller_id: sellerId, // Gunakan auth.users.id untuk seller
        seller_email: listing.seller_email,
        buyer_id: buyerId, // Gunakan auth.users.id untuk buyer
        buyer_email: normalizeEmail(userEmail),
        status: "pending"
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return res.status(500).json({
        error: "database_error",
        message: orderError.message
      });
    }

    console.log("✅ Order created:", order.id);
    return res.status(201).json({
      order: order,
      message: "Order berhasil dibuat"
    });
  } catch (err) {
    console.error("Exception creating order:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// GET /api/marketplace/orders - Ambil daftar order user
app.get("/api/marketplace/orders", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const userEmail = req.headers["x-user-email"] || req.query.email;
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan"
      });
    }

    const { role = "buyer", status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("marketplace_orders")
      .select("*", { count: "exact" });

    // Filter berdasarkan role
    if (role === "buyer") {
      query = query.eq("buyer_email", normalizeEmail(userEmail));
    } else if (role === "seller") {
      query = query.eq("seller_email", normalizeEmail(userEmail));
    } else {
      // Both: buyer OR seller
      query = query.or(`buyer_email.eq.${normalizeEmail(userEmail)},seller_email.eq.${normalizeEmail(userEmail)}`);
    }

    // Filter status
    if (status) {
      query = query.eq("status", status);
    }

    // Sort by created_at desc
    query = query.order("created_at", { ascending: false });

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching orders:", error);
      return res.status(500).json({
        error: "database_error",
        message: error.message,
        orders: []
      });
    }

    return res.json({
      orders: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    });
  } catch (err) {
    console.error("Exception fetching orders:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message,
      orders: []
    });
  }
});

// GET /api/marketplace/orders/:id - Ambil detail order
app.get("/api/marketplace/orders/:id", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { id } = req.params;
    const userEmail = req.headers["x-user-email"] || req.query.email;

    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: "not_found",
        message: "Order tidak ditemukan"
      });
    }

    // Validasi: hanya buyer atau seller yang bisa akses
    if (userEmail) {
      const normalizedEmail = normalizeEmail(userEmail);
      if (order.buyer_email !== normalizedEmail && order.seller_email !== normalizedEmail) {
        return res.status(403).json({
          error: "forbidden",
          message: "Tidak memiliki akses ke order ini"
        });
      }
    }

    // Ambil listing info (pastikan seller_id di-select)
    const { data: listing } = await supabase
      .from("marketplace_listings")
      .select("*, seller_id") // Explicitly include seller_id
      .eq("id", order.listing_id)
      .single();

    return res.json({
      ...order,
      listing: listing || null
    });
  } catch (err) {
    console.error("Exception fetching order:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// PUT /api/marketplace/orders/:id/status - Update status order
app.put("/api/marketplace/orders/:id/status", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { id } = req.params;
    const userEmail = req.headers["x-user-email"];
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan"
      });
    }

    const { status, cod_location, cod_time } = req.body;
    if (!status) {
      return res.status(400).json({
        error: "validation_error",
        message: "Status wajib diisi"
      });
    }

    // Validasi status
    const validStatuses = ["pending", "deal", "done", "canceled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "invalid_status",
        message: `Status harus salah satu dari: ${validStatuses.join(", ")}`
      });
    }

    // Ambil order
    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: "not_found",
        message: "Order tidak ditemukan"
      });
    }

    // Validasi: hanya seller atau buyer yang terlibat bisa update
    const normalizedEmail = normalizeEmail(userEmail);
    if (order.buyer_email !== normalizedEmail && order.seller_email !== normalizedEmail) {
      return res.status(403).json({
        error: "forbidden",
        message: "Tidak memiliki akses untuk update order ini"
      });
    }

    // Validasi: hanya seller bisa update ke 'done'
    if (status === "done" && order.seller_email !== normalizedEmail) {
      return res.status(403).json({
        error: "forbidden",
        message: "Hanya penjual yang bisa menandai order sebagai selesai"
      });
    }

    // Update order
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (cod_location) updateData.cod_location = cod_location.trim();
    if (cod_time) updateData.cod_time = cod_time;

    const { data: updatedOrder, error: updateError } = await supabase
      .from("marketplace_orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating order:", updateError);
      return res.status(500).json({
        error: "database_error",
        message: updateError.message
      });
    }

    // Jika status = 'done', update listing dan user_stats
    if (status === "done") {
      // Update listing status ke 'sold'
      await supabase
        .from("marketplace_listings")
        .update({ status: "sold", updated_at: new Date().toISOString() })
        .eq("id", order.listing_id);

      // Update user_stats (tambah poin)
      // Seller: +10 poin, buyer: +5 poin
      const sellerStats = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_email", order.seller_email)
        .single();

      if (sellerStats.data) {
        await supabase
          .from("user_stats")
          .update({
            total_items_sold: (sellerStats.data.total_items_sold || 0) + 1,
            points_seller: (sellerStats.data.points_seller || 0) + 10,
            total_points: (sellerStats.data.points_seller || 0) + 10 + (sellerStats.data.points_buyer || 0),
            updated_at: new Date().toISOString()
          })
          .eq("user_email", order.seller_email);
      } else {
        // Create stats jika belum ada
        await supabase
          .from("user_stats")
          .insert({
            user_email: order.seller_email,
            total_items_sold: 1,
            points_seller: 10,
            total_points: 10
          });
      }

      const buyerStats = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_email", order.buyer_email)
        .single();

      if (buyerStats.data) {
        await supabase
          .from("user_stats")
          .update({
            total_items_bought: (buyerStats.data.total_items_bought || 0) + 1,
            points_buyer: (buyerStats.data.points_buyer || 0) + 5,
            total_points: (buyerStats.data.points_seller || 0) + (buyerStats.data.points_buyer || 0) + 5,
            updated_at: new Date().toISOString()
          })
          .eq("user_email", order.buyer_email);
      } else {
        await supabase
          .from("user_stats")
          .insert({
            user_email: order.buyer_email,
            total_items_bought: 1,
            points_buyer: 5,
            total_points: 5
          });
      }

      console.log("✅ Order marked as done, stats updated");
    }

    return res.json({
      order: updatedOrder,
      message: "Status order berhasil diupdate"
    });
  } catch (err) {
    console.error("Exception updating order:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// POST /api/marketplace/messages - Kirim pesan baru
app.post("/api/marketplace/messages", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const userEmail = req.headers["x-user-email"];
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Email user diperlukan"
      });
    }

    const { order_id, content } = req.body;
    if (!order_id || !content || !content.trim()) {
      return res.status(400).json({
        error: "validation_error",
        message: "order_id dan content wajib diisi"
      });
    }

    // Validasi order exists dan user adalah participant
    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: "order_not_found",
        message: "Order tidak ditemukan"
      });
    }

    const normalizedEmail = normalizeEmail(userEmail);
    if (order.buyer_email !== normalizedEmail && order.seller_email !== normalizedEmail) {
      return res.status(403).json({
        error: "forbidden",
        message: "Tidak memiliki akses ke order ini"
      });
    }

    // Tentukan receiver
    const receiverEmail = order.buyer_email === normalizedEmail 
      ? order.seller_email 
      : order.buyer_email;

    // Ambil user info untuk sender_id dan receiver_id
    const sender = await findUserByEmailSupabase(userEmail);
    const receiver = await findUserByEmailSupabase(receiverEmail);

    if (!sender) {
      return res.status(404).json({
        error: "user_not_found",
        message: "User tidak ditemukan"
      });
    }

    // Generate message_id
    const messageId = generateMessageId();

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from("marketplace_messages")
      .insert({
        message_id: messageId,
        order_id: order_id,
        sender_id: sender.id,
        sender_email: normalizedEmail,
        receiver_id: receiver?.id || null,
        receiver_email: receiverEmail,
        content: content.trim(),
        read: false
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message:", messageError);
      return res.status(500).json({
        error: "database_error",
        message: messageError.message
      });
    }

    console.log("✅ Message sent:", message.id);
    return res.status(201).json({
      message: message,
      success: true
    });
  } catch (err) {
    console.error("Exception sending message:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// GET /api/marketplace/messages/:order_id - Ambil semua pesan untuk order
app.get("/api/marketplace/messages/:order_id", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { order_id } = req.params;
    const userEmail = req.headers["x-user-email"] || req.query.email;

    // Validasi order exists dan user adalah participant
    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({
        error: "order_not_found",
        message: "Order tidak ditemukan"
      });
    }

    if (userEmail) {
      const normalizedEmail = normalizeEmail(userEmail);
      if (order.buyer_email !== normalizedEmail && order.seller_email !== normalizedEmail) {
        return res.status(403).json({
          error: "forbidden",
          message: "Tidak memiliki akses ke order ini"
        });
      }
    }

    // Ambil messages
    const { data: messages, error: messagesError } = await supabase
      .from("marketplace_messages")
      .select("*")
      .eq("order_id", order_id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return res.status(500).json({
        error: "database_error",
        message: messagesError.message,
        messages: []
      });
    }

    return res.json({
      messages: messages || [],
      order: order
    });
  } catch (err) {
    console.error("Exception fetching messages:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message,
      messages: []
    });
  }
});

// GET /api/marketplace/stats/:user_email - Ambil statistik user
app.get("/api/marketplace/stats/:user_email", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { user_email } = req.params;
    const normalizedEmail = normalizeEmail(user_email);

    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_email", normalizedEmail)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // User stats belum ada, return default
        return res.json({
          total_items_sold: 0,
          total_items_bought: 0,
          points_seller: 0,
          points_buyer: 0,
          total_points: 0
        });
      }
      console.error("Error fetching user stats:", error);
      return res.status(500).json({
        error: "database_error",
        message: error.message
      });
    }

    return res.json({
      total_items_sold: data.total_items_sold || 0,
      total_items_bought: data.total_items_bought || 0,
      points_seller: data.points_seller || 0,
      points_buyer: data.points_buyer || 0,
      total_points: data.total_points || 0
    });
  } catch (err) {
    console.error("Exception fetching user stats:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message
    });
  }
});

// GET /api/marketplace/leaderboard - Ambil leaderboard
app.get("/api/marketplace/leaderboard", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "database_not_available",
        message: "Supabase not configured"
      });
    }

    const { type = "all", limit = 10 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    let sellerLeaderboard = [];
    let buyerLeaderboard = [];

    if (type === "all" || type === "seller") {
      const { data: sellerData, error: sellerError } = await supabase
        .from("user_stats")
        .select("*")
        .order("points_seller", { ascending: false })
        .limit(limitNum);

      if (!sellerError && sellerData) {
        sellerLeaderboard = sellerData.map((stat, index) => ({
          rank: index + 1,
          user_email: stat.user_email,
          total_items_sold: stat.total_items_sold || 0,
          points_seller: stat.points_seller || 0
        }));
      }
    }

    if (type === "all" || type === "buyer") {
      const { data: buyerData, error: buyerError } = await supabase
        .from("user_stats")
        .select("*")
        .order("points_buyer", { ascending: false })
        .limit(limitNum);

      if (!buyerError && buyerData) {
        buyerLeaderboard = buyerData.map((stat, index) => ({
          rank: index + 1,
          user_email: stat.user_email,
          total_items_bought: stat.total_items_bought || 0,
          points_buyer: stat.points_buyer || 0
        }));
      }
    }

    return res.json({
      seller_leaderboard: sellerLeaderboard,
      buyer_leaderboard: buyerLeaderboard
    });
  } catch (err) {
    console.error("Exception fetching leaderboard:", err);
    return res.status(500).json({
      error: "server_error",
      message: err.message,
      seller_leaderboard: [],
      buyer_leaderboard: []
    });
  }
});

// GET /api/config - Expose public config to frontend
app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: supabaseUrl || "",
    // Don't expose service key for security
  });
});

// === Static Files ===
app.use(express.static(path.join(__dirname, "public")));

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 ESP32 Host: ${ESP32_HOST}`);
});
