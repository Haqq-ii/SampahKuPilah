import bcrypt from "bcrypt";
import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { findUserByEmailSupabase, normalizeEmail, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const rateLimitStore = new Map();

const checkRateLimit = (identifier, maxAttempts = 10, windowMs = 15 * 60 * 1000) => {
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
    const rateLimit = checkRateLimit(`login:${clientId}`, 10, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      return jsonResponse(
        {
          message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(
            rateLimit.retryAfter / 60
          )} menit.`,
          retryAfter: rateLimit.retryAfter,
        },
        429
      );
    }

    const body = (await readJson(req)) || {};
    const { email: rawEmail, password } = body;
    const email = normalizeEmail(rawEmail);

    let user = null;
    if (supabase) {
      user = await findUserByEmailSupabase(email);
    }

    if (!user) {
      return jsonResponse({ message: "Email atau password salah" }, 401);
    }

    const passwordHash = user.password_hash || user.passwordHash || "";
    const ok = await bcrypt.compare(password || "", passwordHash);
    if (!ok) {
      return jsonResponse({ message: "Email atau password salah" }, 401);
    }

    rateLimitStore.delete(`login:${clientId}`);
    return jsonResponse({ message: "Login berhasil", user: { email } });
  } catch (error) {
    console.error("Login error:", error);
    return jsonResponse({ message: "Terjadi kesalahan server" }, 500);
  }
}
