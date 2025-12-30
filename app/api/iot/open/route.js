import { jsonResponse, optionsResponse } from "@/lib/http";
import { getUserEmailFromRequest } from "@/lib/auth";
import { normalizeEmail, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ESP32_HOST = process.env.ESP32_HOST || "http://192.168.1.20";
const ESP32_TIMEOUT = 10000;

async function requireAuth(req) {
  const userEmail = getUserEmailFromRequest(req);

  if (!userEmail) {
    return {
      error: jsonResponse(
        {
          error: "unauthorized",
          message: "Autentikasi diperlukan. Silakan login terlebih dahulu.",
        },
        401
      ),
    };
  }

  const normalizedEmail = normalizeEmail(userEmail);

  if (supabase) {
    const { data: user, error } = await supabase
      .from("users")
      .select("email, name, picture, provider")
      .eq("email", normalizedEmail)
      .single();

    if (error || !user) {
      return {
        error: jsonResponse(
          {
            error: "unauthorized",
            message: "User tidak ditemukan. Silakan login kembali.",
          },
          401
        ),
      };
    }

    return { user };
  }

  console.warn("Supabase not configured, skipping user validation");
  return { user: { email: normalizedEmail } };
}

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req) {
  const startTime = Date.now();

  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const binType = url.searchParams.get("type");

    if (!binType) {
      return jsonResponse({ error: "Parameter 'type' required" }, 400);
    }

    const validTypes = ["hijau", "merah", "biru", "abu-abu", "kuning"];
    if (!validTypes.includes(binType.toLowerCase())) {
      return jsonResponse(
        {
          error: "Invalid bin type. Use: hijau, merah, biru, abu-abu, or kuning",
        },
        400
      );
    }

    console.log(
      `User ${auth.user.email} requesting to open bin: ${binType}`
    );

    const esp32Url = `${ESP32_HOST}/open?type=${encodeURIComponent(binType)}`;
    console.log(`Proxying to ESP32: ${esp32Url}`);

    const response = await fetch(esp32Url, {
      method: "GET",
      signal: AbortSignal.timeout(ESP32_TIMEOUT),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `ESP32 error (${response.status}, ${duration}ms):`,
        errorText
      );
      return jsonResponse(
        {
          error: "ESP32 error",
          detail: errorText,
          duration: `${duration}ms`,
        },
        response.status
      );
    }

    const data = await response.json();
    console.log(`ESP32 response (${duration}ms):`, data);

    return jsonResponse({
      ...data,
      duration: `${duration}ms`,
      user: auth.user.email,
    });
  } catch (err) {
    const duration = Date.now() - startTime;

    if (err.name === "AbortError") {
      console.error(`ESP32 timeout after ${duration}ms - IP: ${ESP32_HOST}`);
      return jsonResponse(
        {
          error: "ESP32 timeout",
          message: `ESP32 tidak merespons dalam ${ESP32_TIMEOUT / 1000} detik`,
          host: ESP32_HOST,
          troubleshooting: [
            "1. Pastikan ESP32 sudah terhubung ke WiFi dan server berjalan",
            "2. Pastikan ESP32 dan server dalam jaringan WiFi yang sama",
            "3. Cek IP Address ESP32 di Serial Monitor - mungkin berubah",
            "4. Update ESP32_HOST di file .env jika IP berubah",
            "5. Coba akses ESP32 langsung di browser: http://[IP_ESP32]/status",
            "6. Restart ESP32 jika perlu",
          ],
        },
        504
      );
    }

    console.error("IoT proxy error:", err.message);
    return jsonResponse(
      {
        error: "iot_connection_error",
        message: err.message || "Gagal terhubung ke ESP32",
        host: ESP32_HOST,
        type: err.name,
      },
      500
    );
  }
}
