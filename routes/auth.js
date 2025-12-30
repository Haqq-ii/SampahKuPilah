// routes/auth.js - Authentication Routes
import express from "express";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const IS_VERCEL = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

// Helper functions
const normalizeEmail = (v) => typeof v === "string" ? v.trim().toLowerCase() : "";

const validateEmail = (email) => {
    if (!email || typeof email !== "string") {
        return { valid: false, error: "Email wajib diisi" };
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: "Format email tidak valid" };
    }

    if (trimmed.length > 254) {
        return { valid: false, error: "Email terlalu panjang" };
    }

    const [localPart] = trimmed.split("@");
    if (localPart.length > 64) {
        return { valid: false, error: "Email tidak valid" };
    }

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

    if (password.length < 8) {
        errors.push("Password minimal 8 karakter");
    }

    if (!/[A-Z]/.test(password)) {
        errors.push("Password harus mengandung huruf besar (A-Z)");
    }

    if (!/[a-z]/.test(password)) {
        errors.push("Password harus mengandung huruf kecil (a-z)");
    }

    if (!/[0-9]/.test(password)) {
        errors.push("Password harus mengandung angka (0-9)");
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

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

// Rate limiting store
const rateLimitStore = new Map();

const checkRateLimit = (identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const now = Date.now();
    const key = identifier;

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxAttempts - 1 };
    }

    const record = rateLimitStore.get(key);

    if (now > record.resetAt) {
        record.count = 1;
        record.resetAt = now + windowMs;
        return { allowed: true, remaining: maxAttempts - 1 };
    }

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

// Register endpoint
router.post("/register", async (req, res) => {
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

        let existingUser = null;
        if (supabase) {
            existingUser = await findUserByEmailSupabase(email);
        }

        if (existingUser) {
            return res.status(409).json({ message: "Email sudah terdaftar" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = { email, passwordHash, provider: "local" };

        if (supabase) {
            const created = await createUserSupabase(newUser);
            if (!created) {
                if (IS_VERCEL) {
                    console.error("Failed to create user in Supabase on Vercel");
                    return res.status(500).json({ message: "Gagal membuat akun. Pastikan Supabase dikonfigurasi dengan benar." });
                }
            } else {
                console.log("✅ User created in Supabase:", email);
            }
        } else {
            if (IS_VERCEL) {
                console.error("Supabase not configured on Vercel");
                return res.status(500).json({ message: "Database tidak tersedia. Pastikan Supabase dikonfigurasi." });
            }
        }

        rateLimitStore.delete(`register:${clientId}`);
        res.json({ message: "Pendaftaran berhasil" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
});

// Login endpoint
router.post("/login", async (req, res) => {
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

        let user = null;
        if (supabase) {
            user = await findUserByEmailSupabase(email);
        }

        if (!user) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

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

// Save Google user endpoint
router.post("/save-google-user", async (req, res) => {
    try {
        const user = req.body;
        const email = normalizeEmail(user.email);

        let existingUser = null;
        if (supabase) {
            existingUser = await findUserByEmailSupabase(email);
        }

        if (!existingUser) {
            if (supabase) {
                const created = await createUserSupabase({
                    email: email,
                    provider: "google",
                    name: user.name || null,
                    picture: user.picture || null
                });
                if (!created) {
                    if (IS_VERCEL) {
                        console.error("Failed to create Google user in Supabase on Vercel");
                        return res.status(500).json({ message: "Gagal menyimpan user. Pastikan Supabase dikonfigurasi dengan benar." });
                    }
                } else {
                    console.log("✅ Google user created in Supabase:", email);
                }
            } else {
                if (IS_VERCEL) {
                    console.error("Supabase not configured on Vercel");
                    return res.status(500).json({ message: "Database tidak tersedia. Pastikan Supabase dikonfigurasi." });
                }
            }
        }

        res.json({ message: "Google user disimpan!" });
    } catch (error) {
        console.error("Error saving Google user:", error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
});

export default router;
