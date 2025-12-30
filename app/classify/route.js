import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { getOpenAIKeyStatus, openai } from "@/lib/openai";
import { saveDetectionSupabase, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

let classifyBusy = false;
let lastClassifyAt = 0;
const CLASSIFY_COOLDOWN_MS = 5000;

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  try {
    const keyStatus = getOpenAIKeyStatus();
    if (!keyStatus.ok) {
      return jsonResponse(
        {
          error: keyStatus.error,
          message: keyStatus.message,
        },
        500
      );
    }

    if (!openai) {
      return jsonResponse(
        {
          error: "missing_api_key",
          message: "OpenAI API key tidak dikonfigurasi.",
        },
        500
      );
    }

    const body = (await readJson(req)) || {};
    const { imageBase64, images } = body;

    let imageUrls = [];
    if (Array.isArray(images) && images.length > 0) {
      imageUrls = images
        .filter((b64) => typeof b64 === "string" && b64.length > 16)
        .map((b64) => `data:image/jpeg;base64,${b64}`);
    } else if (typeof imageBase64 === "string" && imageBase64.length > 16) {
      imageUrls = [`data:image/jpeg;base64,${imageBase64}`];
    }

    if (imageUrls.length === 0) {
      return jsonResponse(
        { error: "imageBase64 or images[] is required" },
        400
      );
    }

    const now = Date.now();
    const elapsed = now - lastClassifyAt;
    if (elapsed < CLASSIFY_COOLDOWN_MS) {
      const wait = CLASSIFY_COOLDOWN_MS - elapsed;
      return jsonResponse({ error: "cooldown", cooldown_ms: wait }, 429);
    }
    if (classifyBusy) {
      return jsonResponse(
        { error: "server_busy", cooldown_ms: CLASSIFY_COOLDOWN_MS },
        429
      );
    }

    classifyBusy = true;
    lastClassifyAt = Date.now();

    const prompt = `
Kamu adalah sistem klasifikasi sampah untuk konteks Indonesia.
Kamu akan menerima hingga EMPAT gambar dari frame yang sama:
- "tight": crop ketat area tengah (60%)
- "center": crop tengah (80%)
- "wide": crop lebar (90%)
- "hand-object": crop khusus objek di tangan

FOKUS PADA OBJEK YANG DIPEGANG TANGAN, bukan tangan itu sendiri.
Analisis objek yang paling dominan dan jelas terlihat.

Prioritas klasifikasi:
1) "merah" (B3): baterai, powerbank, lampu neon, elektronik kecil
2) "hijau" (organik): sisa makanan, sayur, buah, daun, tisu kotor
3) "biru" (kertas): kertas & kardus (bersih atau sedikit kotor)
4) "kuning" (anorganik): plastik, logam, kaca, kemasan
5) "abu-abu" (residu): popok, pembalut, foam, serpihan campuran

ATURAN KHUSUS:
- Jika ada objek jelas di tangan -> klasifikasi objek tersebut
- Jika objek di tangan adalah kertas -> "biru" (meskipun ada tangan)
- Jika hanya tangan tanpa objek -> "abu-abu"
- Abaikan tangan, fokus pada objek yang dipegang

Berikan respons dalam format JSON SAJA tanpa markdown:
{
  "category": "hijau" | "merah" | "biru" | "kuning" | "abu-abu",
  "confidence": 0.0 - 1.0,
  "bin_name": "Nama Tong (mis: Organik)",
  "bin_color": "Warna (mis: hijau)",
  "dominant_class": "Nama benda spesifik (mis: Botol Plastik, Kulit Pisang)",
  "reason": "Alasan singkat mengapa masuk kategori ini",
  "fun_fact": "Satu fakta unik/menarik tentang sampah ini (maks 1 kalimat)",
  "recycling_advice": "Saran singkat cara mengolah/membuang (maks 2 kalimat singkat)",
  "youtube_query": "Keyword pencarian video tutorial kreatif (mis: 'kerajinan botol plastik bekas', 'cara daur ulang kardus')"
}
`;

    const userContent = imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 250,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed = {
      category: "abu-abu",
      reason: "tidak jelas",
      confidence: 0.7,
      fun_fact: null,
      recycling_advice: null,
    };

    try {
      let jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];

      if (jsonStr) {
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;

        if (openBraces > closeBraces) {
          if (!jsonStr.endsWith('"') && !jsonStr.endsWith("}")) {
            jsonStr += '"';
          }
          jsonStr += "}".repeat(openBraces - closeBraces);
        }

        const o = JSON.parse(jsonStr);
        if (typeof o.category === "string") parsed.category = o.category;
        if (typeof o.reason === "string") parsed.reason = o.reason;
        if (typeof o.confidence === "number") {
          parsed.confidence = Math.max(0, Math.min(1, o.confidence));
        }
        if (typeof o.fun_fact === "string") parsed.fun_fact = o.fun_fact;
        if (typeof o.recycling_advice === "string")
          parsed.recycling_advice = o.recycling_advice;
        if (typeof o.youtube_query === "string")
          parsed.youtube_query = o.youtube_query;
        if (typeof o.dominant_class === "string")
          parsed.dominant_class = o.dominant_class;
      }
    } catch (err) {
      console.warn("JSON parsing error:", err.message);
      console.warn("Raw response:", raw);
    }

    const color = (parsed.category || "abu-abu").toLowerCase();
    const conf = parsed.confidence ?? 0.85;

    const binMap = {
      hijau: "Organik",
      kuning: "Anorganik",
      merah: "B3",
      biru: "Kertas",
      "abu-abu": "Residu",
    };
    const binName = binMap[color] || "Residu";

    const decision = {
      dominant_class: parsed.dominant_class || binName,
      bin: color,
      confidence: conf,
      reason: parsed.reason,
      fun_fact: parsed.fun_fact,
      recycling_advice: parsed.recycling_advice,
      youtube_query: parsed.youtube_query,
    };

    console.log("AI response (raw):", raw);
    console.log("Parsed education data:", {
      fun_fact: parsed.fun_fact,
      recycling_advice: parsed.recycling_advice,
    });

    const detections = [
      {
        class: binName,
        confidence: conf,
        bbox: { x: 0.22, y: 0.22, w: 0.56, h: 0.56 },
        waste_type: binName,
        bin: color,
      },
    ];

    const userEmail = body.userEmail || req.headers.get("x-user-email");
    if (userEmail && supabase) {
      saveDetectionSupabase(userEmail, {
        category: color,
        bin_name: binName,
        confidence: conf,
        reason: parsed.reason,
      }).catch((err) => {
        console.warn(
          "Failed to save detection to Supabase (non-blocking):",
          err.message
        );
      });
    }

    return jsonResponse({ detections, decision });
  } catch (err) {
    classifyBusy = false;

    if (err?.status === 429) {
      return jsonResponse(
        {
          error: "openai_rate_limit",
          cooldown_ms: 12000,
          message: "Terlalu banyak permintaan ke OpenAI. Silakan tunggu beberapa saat.",
        },
        429
      );
    }

    if (err?.message?.includes("API key") || err?.message?.includes("Missing credentials")) {
      console.error("OPENAI_API_KEY error:", err.message);
      return jsonResponse(
        {
          error: "missing_api_key",
          message:
            "OpenAI API key tidak valid. Pastikan OPENAI_API_KEY sudah dikonfigurasi di file .env",
        },
        500
      );
    }

    console.error("Classification error:", err);
    return jsonResponse(
      {
        error: "classification_error",
        message: err?.message || "Terjadi kesalahan saat memproses deteksi sampah",
      },
      500
    );
  } finally {
    classifyBusy = false;
  }
}
