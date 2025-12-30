import { jsonResponse, optionsResponse } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toString();
    const maxResults = Math.max(
      1,
      Math.min(5, parseInt(searchParams.get("maxResults") || "3", 10))
    );
    const key = process.env.YOUTUBE_API_KEY;

    if (!q) return jsonResponse({ error: "query_missing" }, 400);

    if (!key) {
      return jsonResponse({
        items: [
          {
            id: { videoId: "bM5cZFZ6XRM" },
            snippet: {
              title: "Daur Ulang Botol Plastik Menjadi Pot Bunga - DIY",
              thumbnails: {
                medium: { url: "https://i.ytimg.com/vi/bM5cZFZ6XRM/mqdefault.jpg" },
              },
            },
          },
          {
            id: { videoId: "9m1qJ3Qv8ss" },
            snippet: {
              title: "Cara Membuat Pot dari Botol Plastik Bekas",
              thumbnails: {
                medium: { url: "https://i.ytimg.com/vi/9m1qJ3Qv8ss/mqdefault.jpg" },
              },
            },
          },
          {
            id: { videoId: "o7vjW3m3o9g" },
            snippet: {
              title: "DIY: Pot Bunga dari Botol Bekas yang Estetik",
              thumbnails: {
                medium: { url: "https://i.ytimg.com/vi/o7vjW3m3o9g/mqdefault.jpg" },
              },
            },
          },
        ].slice(0, maxResults),
      });
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("key", key);

    const r = await fetch(url, { method: "GET" });
    if (!r.ok) {
      const text = await r.text();
      return jsonResponse({ error: "youtube_error", detail: text }, r.status);
    }
    const data = await r.json();
    return jsonResponse(data);
  } catch (err) {
    console.error("/api/youtube/search error:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
}
