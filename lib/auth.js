import jwt from "jsonwebtoken";
import { normalizeEmail } from "./supabase.js";

const JWT_SECRET = process.env.JWT_SECRET?.trim() || "";

export function signJwt(payload, options = {}) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyJwt(token) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.verify(token, JWT_SECRET);
}

export function extractBearerToken(headers) {
  const authHeader = headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export function getJwtEmail(headers) {
  if (!JWT_SECRET) return null;
  const token = extractBearerToken(headers);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const email = payload?.email || payload?.userEmail || payload?.sub || "";
    return normalizeEmail(email);
  } catch {
    return null;
  }
}

export function getUserEmailFromRequest(req, body = null) {
  const headerEmail = req.headers.get("x-user-email");
  if (headerEmail) return normalizeEmail(headerEmail);

  const jwtEmail = getJwtEmail(req.headers);
  if (jwtEmail) return jwtEmail;

  if (body?.userEmail) return normalizeEmail(body.userEmail);

  const url = new URL(req.url);
  const queryEmail = url.searchParams.get("email");
  if (queryEmail) return normalizeEmail(queryEmail);

  return null;
}
