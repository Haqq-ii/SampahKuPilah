import { supabaseUrl } from "./supabase.js";

export function generateOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

export function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MSG-${timestamp}-${random}`;
}

export function normalizeListingImages(listing) {
  if (!listing) return listing;
  const normalized = { ...listing };

  if (normalized.images) {
    if (typeof normalized.images === "string") {
      try {
        normalized.images = JSON.parse(normalized.images);
      } catch {
        normalized.images = normalized.images.trim()
          ? [normalized.images.trim()]
          : [];
      }
    }
    if (!Array.isArray(normalized.images)) {
      normalized.images = [];
    }
  } else {
    normalized.images = [];
  }

  return normalized;
}

export function buildImageUrls(images = []) {
  const imageUrls = [];

  if (!Array.isArray(images) || images.length === 0) return imageUrls;

  for (const img of images) {
    if (typeof img === "string") {
      if (
        img.startsWith("http://") ||
        img.startsWith("https://") ||
        img.startsWith("data:")
      ) {
        imageUrls.push(img);
      } else if (img.trim().length > 0) {
        imageUrls.push(img.trim());
      }
      continue;
    }

    if (typeof img === "object" && img !== null) {
      if (img.url) {
        imageUrls.push(img.url);
      } else if (img.base64 && img.mimeType) {
        imageUrls.push(`data:${img.mimeType};base64,${img.base64}`);
      } else if (img.path && supabaseUrl) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/marketplace-images/${img.path}`;
        imageUrls.push(publicUrl);
      }
    }
  }

  return imageUrls;
}
