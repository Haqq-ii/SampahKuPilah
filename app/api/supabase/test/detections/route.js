import { jsonResponse, optionsResponse } from "@/lib/http";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    if (!supabase) {
      return jsonResponse(
        {
          connected: false,
          message: "Supabase not configured",
        },
        503
      );
    }

    const { error, count } = await supabase
      .from("detections")
      .select("*", { count: "exact", head: true });

    if (error) {
      return jsonResponse(
        {
          connected: false,
          error: error.message,
          hint: "Pastikan tabel 'detections' sudah dibuat di Supabase",
        },
        500
      );
    }

    return jsonResponse({
      connected: true,
      message: "Tabel detections accessible!",
      detections: {
        accessible: true,
        recordCount: count || 0,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        connected: false,
        error: err.message,
      },
      500
    );
  }
}
