import { jsonResponse, optionsResponse } from "@/lib/http";

export const runtime = "nodejs";

const ESP32_HOST = process.env.ESP32_HOST || "http://192.168.1.20";
const ESP32_TIMEOUT = 10000;

export function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    console.log(`Testing ESP32 connection: ${ESP32_HOST}`);
    const startTime = Date.now();

    const response = await fetch(`${ESP32_HOST}/status`, {
      method: "GET",
      signal: AbortSignal.timeout(ESP32_TIMEOUT),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      return jsonResponse(
        {
          connected: false,
          error: `ESP32 responded with status ${response.status}`,
          duration: `${duration}ms`,
        },
        response.status
      );
    }

    const data = await response.json();
    console.log(`ESP32 connection successful (${duration}ms)`);

    return jsonResponse({
      connected: true,
      esp32: data,
      duration: `${duration}ms`,
      host: ESP32_HOST,
    });
  } catch (err) {
    const errorMsg =
      err.name === "AbortError"
        ? "ESP32 timeout - tidak merespons"
        : err.message || "Gagal terhubung ke ESP32";

    console.error("ESP32 connection test failed:", errorMsg);

    return jsonResponse(
      {
        connected: false,
        error: errorMsg,
        host: ESP32_HOST,
        troubleshooting: [
          "1. Pastikan ESP32 sudah terhubung ke WiFi",
          "2. Pastikan ESP32 dan server dalam jaringan WiFi yang sama",
          "3. Cek IP Address ESP32 di Serial Monitor",
          "4. Update ESP32_HOST di file .env jika IP berubah",
          "5. Coba ping ESP32 dari terminal: ping [IP_ESP32]",
        ],
      },
      504
    );
  }
}
