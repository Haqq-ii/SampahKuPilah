import OpenAI from "openai";

export const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
export const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export function isOpenAIKeyPlaceholder(key) {
  if (!key) return false;
  const lower = key.toLowerCase();
  return (
    lower.includes("your_") ||
    lower.includes("example") ||
    lower.includes("placeholder") ||
    key.length < 20
  );
}

export function getOpenAIKeyStatus() {
  if (!openaiApiKey) {
    return {
      ok: false,
      error: "missing_api_key",
      message:
        "OpenAI API key tidak dikonfigurasi. Pastikan OPENAI_API_KEY sudah diset di file .env",
    };
  }

  if (isOpenAIKeyPlaceholder(openaiApiKey)) {
    return {
      ok: false,
      error: "invalid_api_key",
      message:
        "OpenAI API key tidak valid atau masih placeholder. Edit file .env dengan API key yang valid",
    };
  }

  return { ok: true };
}
