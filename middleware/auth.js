// middleware/auth.js - Authentication Middleware
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const normalizeEmail = (v) => typeof v === "string" ? v.trim().toLowerCase() : "";

/**
 * Middleware untuk memverifikasi user sudah login
 * Mengecek header x-user-email dan memvalidasi user ada di database
 */
export const requireAuth = async (req, res, next) => {
  try {
    const userEmail = req.headers["x-user-email"] || req.body?.userEmail || req.query?.email;
    
    if (!userEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Autentikasi diperlukan. Silakan login terlebih dahulu."
      });
    }

    const normalizedEmail = normalizeEmail(userEmail);
    
    // Validasi user di Supabase
    if (supabase) {
      const { data: user, error } = await supabase
        .from("users")
        .select("email, name, picture, provider")
        .eq("email", normalizedEmail)
        .single();
      
      if (error || !user) {
        return res.status(401).json({
          error: "unauthorized",
          message: "User tidak ditemukan. Silakan login kembali."
        });
      }
      
      // Attach user data ke request untuk digunakan di route handler
      req.user = user;
    } else {
      // Fallback jika Supabase tidak tersedia (development only)
      console.warn("⚠️ Supabase not configured, skipping user validation");
      req.user = { email: normalizedEmail };
    }
    
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({
      error: "server_error",
      message: "Terjadi kesalahan saat memverifikasi autentikasi"
    });
  }
};

/**
 * Middleware untuk autentikasi opsional
 * Jika ada user email, validasi. Jika tidak ada, lanjutkan tanpa user.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const userEmail = req.headers["x-user-email"] || req.body?.userEmail || req.query?.email;
    
    if (!userEmail) {
      req.user = null;
      return next();
    }

    const normalizedEmail = normalizeEmail(userEmail);
    
    if (supabase) {
      const { data: user } = await supabase
        .from("users")
        .select("email, name, picture, provider")
        .eq("email", normalizedEmail)
        .single();
      
      req.user = user || null;
    } else {
      req.user = { email: normalizedEmail };
    }
    
    next();
  } catch (err) {
    console.error("Optional auth middleware error:", err);
    req.user = null;
    next();
  }
};
