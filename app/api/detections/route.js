import { jsonResponse, optionsResponse } from "@/lib/http";
import { getDetectionsSupabase, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const userEmail = url.searchParams.get("email") || req.headers.get("x-user-email");

    if (!userEmail) {
      return jsonResponse(
        {
          error: "email_required",
          message: "Email user diperlukan (query parameter atau header x-user-email)",
        },
        400
      );
    }

    if (!supabase) {
      return jsonResponse(
        {
          error: "database_not_available",
          message: "Supabase not configured. Using localStorage fallback.",
          detections: [],
        },
        503
      );
    }

    const detections = await getDetectionsSupabase(userEmail, 50);

    return jsonResponse({
      detections: detections || [],
      count: detections?.length || 0,
      source: "supabase",
    });
  } catch (err) {
    console.error("Error fetching detections:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
        detections: [],
      },
      500
    );
  }
}
