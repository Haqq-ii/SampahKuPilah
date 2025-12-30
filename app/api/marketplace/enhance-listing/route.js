import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  console.log("Enhancement endpoint called");
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return jsonResponse(
        {
          error: "missing_api_key",
          message: "OpenAI API key tidak dikonfigurasi",
        },
        500
      );
    }

    if (!openai) {
      return jsonResponse(
        {
          error: "missing_api_key",
          message: "OpenAI API key tidak dikonfigurasi",
        },
        500
      );
    }

    const body = (await readJson(req)) || {};
    const { title, description, category, tags = [], price = 0 } = body;

    if (!title || !description || !category) {
      return jsonResponse(
        {
          error: "validation_error",
          message:
            "Title, description, dan category wajib diisi untuk enhancement",
        },
        400
      );
    }

    const titlePrompt = `Kamu adalah copywriter profesional untuk marketplace daur ulang di Indonesia.
Buatkan judul yang menarik, SEO-friendly, dan persuasif untuk produk berikut:

Kategori: ${category}
Judul asli: ${title}
Deskripsi: ${description}
${tags.length > 0 ? `Tag: ${tags.join(", ")}` : ""}

Buatkan 1 judul yang:
- Maksimal 60 karakter
- Menarik perhatian pembeli
- Mengandung kata kunci penting
- Sesuai dengan konteks Indonesia
- Tidak berlebihan atau clickbait

Jawab HANYA dengan judul yang dihasilkan, tanpa penjelasan tambahan.`;

    const descriptionPrompt = `Kamu adalah copywriter profesional untuk marketplace daur ulang di Indonesia.
Tuliskan deskripsi produk yang menarik, informatif, dan persuasif berdasarkan informasi berikut:

Kategori: ${category}
Judul: ${title}
Deskripsi asli: ${description}
${tags.length > 0 ? `Tag: ${tags.join(", ")}` : ""}
${price > 0 ? `Harga: Rp ${parseInt(price, 10).toLocaleString("id-ID")}` : "Harga: Gratis"}

Buatkan deskripsi yang:
- Maksimal 500 karakter
- Menjelaskan kondisi, ukuran, dan detail produk dengan jelas
- Menyebutkan manfaat dan nilai produk
- Menggunakan bahasa yang ramah dan profesional
- Sesuai dengan konteks Indonesia
- Tidak berlebihan atau menipu

Jawab HANYA dengan deskripsi yang dihasilkan, tanpa penjelasan tambahan.`;

    const tagsPrompt = `Berdasarkan informasi produk berikut, buatkan 3-5 tag yang relevan untuk memudahkan pencarian:

Kategori: ${category}
Judul: ${title}
Deskripsi: ${description}
${tags.length > 0 ? `Tag yang sudah ada: ${tags.join(", ")}` : ""}

Buatkan tag yang:
- Relevan dengan produk
- Populer untuk pencarian
- Maksimal 1-2 kata per tag
- Dalam bahasa Indonesia atau bahasa umum

Jawab dalam format JSON array: ["tag1", "tag2", "tag3"]
HANYA return JSON array, tanpa penjelasan tambahan.`;

    const [titleResponse, descriptionResponse, tagsResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah copywriter profesional untuk marketplace." },
          { role: "user", content: titlePrompt },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah copywriter profesional untuk marketplace." },
          { role: "user", content: descriptionPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu adalah ahli SEO dan tagging untuk marketplace." },
          { role: "user", content: tagsPrompt },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    ]);

    const enhancedTitle =
      titleResponse.choices?.[0]?.message?.content?.trim() || title;
    const enhancedDescription =
      descriptionResponse.choices?.[0]?.message?.content?.trim() || description;

    let enhancedTags = [...tags];
    try {
      const tagsContent =
        tagsResponse.choices?.[0]?.message?.content?.trim() || "[]";
      const parsedTags = JSON.parse(tagsContent);
      if (Array.isArray(parsedTags)) {
        enhancedTags = [...new Set([...tags, ...parsedTags])];
      }
    } catch {
      const tagsText =
        tagsResponse.choices?.[0]?.message?.content?.trim() || "";
      const extractedTags = tagsText
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (extractedTags.length > 0) {
        enhancedTags = [...new Set([...tags, ...extractedTags])];
      }
    }

    enhancedTags = enhancedTags.slice(0, 10);

    return jsonResponse({
      success: true,
      enhanced: {
        title: enhancedTitle,
        description: enhancedDescription,
        tags: enhancedTags,
      },
      original: {
        title,
        description,
        tags,
      },
    });
  } catch (err) {
    console.error("Error enhancing listing:", err);

    if (err?.status === 429) {
      return jsonResponse(
        {
          error: "rate_limit",
          message: "Terlalu banyak permintaan ke AI. Silakan coba lagi nanti.",
        },
        429
      );
    }

    if (err?.message?.includes("API key") || err?.message?.includes("Missing credentials")) {
      return jsonResponse(
        {
          error: "missing_api_key",
          message: "OpenAI API key tidak valid",
        },
        500
      );
    }

    return jsonResponse(
      {
        error: "enhancement_error",
        message: err?.message || "Terjadi kesalahan saat melakukan enhancement",
      },
      500
    );
  }
}
