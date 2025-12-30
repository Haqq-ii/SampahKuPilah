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
          instructions: [
            "1. Pastikan SUPABASE_URL dan SUPABASE_SERVICE_KEY sudah diisi di file .env",
            "2. Restart server setelah mengupdate .env",
            "3. Cek console untuk pesan error koneksi",
          ],
        },
        503
      );
    }

    const { error, count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Supabase test error:", error);
      return jsonResponse(
        {
          connected: false,
          error: error.message,
          hint:
            error.code === "PGRST116"
              ? "Tabel users mungkin belum dibuat atau kosong (ini normal untuk pertama kali)"
              : "Cek struktur tabel dan permissions di Supabase Dashboard",
        },
        500
      );
    }

    return jsonResponse({
      connected: true,
      message: "Supabase connection successful!",
      tables: {
        users: {
          accessible: true,
          recordCount: count || 0,
        },
      },
      nextSteps: [
        "1. Test endpoint /api/supabase/test/detections untuk cek tabel detections",
        "2. Coba registrasi user baru untuk test insert",
        "3. Coba deteksi sampah untuk test save detection",
      ],
    });
  } catch (err) {
    console.error("Supabase test exception:", err);
    return jsonResponse(
      {
        connected: false,
        error: err.message,
        type: err.name,
      },
      500
    );
  }
}
