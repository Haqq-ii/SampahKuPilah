import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "manifest.webmanifest");
  const file = await readFile(filePath);

  return new Response(file, {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}
