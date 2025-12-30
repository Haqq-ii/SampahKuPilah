import bcrypt from "bcrypt";
import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import {
  createUserSupabase,
  findUserByEmailSupabase,
  normalizeEmail,
  supabase,
} from "@/lib/supabase";

export const runtime = "nodejs";

const IS_VERCEL = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

const rateLimitStore = new Map();

const normalizeInputEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

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

  record.count += 1;
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
  };
};

const getClientIdentifier = (req) => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
};

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(`register:${clientId}`, 5, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return jsonResponse(
        {
          message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(
            rateLimit.retryAfter / 60
          )} menit.`,
          retryAfter: rateLimit.retryAfter,
        },
        429
      );
    }

    const body = (await readJson(req)) || {};
    const { email: rawEmail, password } = body;

    const emailValidation = validateEmail(rawEmail);
    if (!emailValidation.valid) {
      return jsonResponse({ message: emailValidation.error }, 400);
    }

    const email = normalizeInputEmail(rawEmail);
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return jsonResponse(
        {
          message: passwordValidation.errors.join(", "),
        },
        400
      );
    }

    let existingUser = null;
    if (supabase) {
      existingUser = await findUserByEmailSupabase(email);
    }

    if (existingUser) {
      return jsonResponse({ message: "Email sudah terdaftar" }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { email, passwordHash, provider: "local" };

    if (supabase) {
      const created = await createUserSupabase(newUser);
      if (!created && IS_VERCEL) {
        console.error("Failed to create user in Supabase on Vercel");
        return jsonResponse(
          {
            message:
              "Gagal membuat akun. Pastikan Supabase dikonfigurasi dengan benar.",
          },
          500
        );
      }
    } else if (IS_VERCEL) {
      console.error("Supabase not configured on Vercel");
      return jsonResponse(
        {
          message: "Database tidak tersedia. Pastikan Supabase dikonfigurasi.",
        },
        500
      );
    }

    rateLimitStore.delete(`register:${clientId}`);
    return jsonResponse({ message: "Pendaftaran berhasil" });
  } catch (error) {
    console.error("Registration error:", error);
    return jsonResponse({ message: "Terjadi kesalahan server" }, 500);
  }
}
