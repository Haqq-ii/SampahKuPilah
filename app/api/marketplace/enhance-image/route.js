import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { decodeBase64, enhanceImageBuffer } from "@/lib/image";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  try {
    const body = (await readJson(req)) || {};
    const { base64, mimeType } = body;

    if (!base64 || !mimeType) {
      return jsonResponse(
        {
          error: "validation_error",
          message: "base64 dan mimeType diperlukan",
        },
        400
      );
    }

    const imageBuffer = decodeBase64(base64);

    try {
      const enhanced = await enhanceImageBuffer(imageBuffer);
      return jsonResponse({
        success: true,
        enhanced: {
          base64: enhanced.base64,
          mimeType: enhanced.mimeType,
          width: enhanced.width,
          height: enhanced.height,
          originalWidth: enhanced.originalWidth,
          originalHeight: enhanced.originalHeight,
          sizeReduction: enhanced.sizeReduction,
        },
      });
    } catch (sharpError) {
      console.error("Sharp processing error:", sharpError);
      return jsonResponse({
        success: false,
        error: "enhancement_failed",
        message: "Gagal melakukan enhancement, menggunakan gambar asli",
        original: {
          base64,
          mimeType,
        },
      });
    }
  } catch (err) {
    console.error("Exception enhancing image:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
