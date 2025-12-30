import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  try {
    const body = (await readJson(req)) || {};
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse(
        {
          error: "messages_required",
          message: "Array messages diperlukan",
        },
        400
      );
    }

    if (messages.length > 50) {
      return jsonResponse(
        {
          error: "too_many_messages",
          message: "Terlalu banyak pesan dalam satu request",
        },
        400
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

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices?.[0]?.message?.content?.trim();

    return jsonResponse({
      message: assistantMessage || "Maaf, tidak ada respons dari AI.",
    });
  } catch (err) {
    if (err?.status === 429) {
      return jsonResponse(
        {
          error: "rate_limit",
          message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
        },
        429
      );
    }
    console.error("AI Chat error:", err);
    return jsonResponse(
      {
        error: "internal_error",
        message: "Terjadi kesalahan saat menghubungkan ke layanan AI.",
      },
      500
    );
  }
}
