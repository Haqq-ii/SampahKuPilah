import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { decodeBase64, enhanceImageBuffer } from "@/lib/image";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  try {
    if (!supabase) {
      return jsonResponse(
        {
          error: "database_not_available",
          message: "Supabase not configured",
        },
        503
      );
    }

    const userEmail = req.headers.get("x-user-email");
    if (!userEmail) {
      return jsonResponse(
        {
          error: "unauthorized",
          message: "Email user diperlukan",
        },
        401
      );
    }

    const body = (await readJson(req)) || {};
    const { base64, mimeType, filename, enhance = false } = body;

    if (!base64 || !mimeType) {
      return jsonResponse(
        {
          error: "validation_error",
          message: "base64 dan mimeType diperlukan",
        },
        400
      );
    }

    let finalBase64 = base64;
    let finalMimeType = mimeType;
    let finalBuffer;

    if (enhance) {
      try {
        const imageBuffer = decodeBase64(base64);
        const enhanced = await enhanceImageBuffer(imageBuffer);
        finalBuffer = enhanced.buffer;
        finalBase64 = enhanced.base64;
        finalMimeType = enhanced.mimeType;
      } catch (enhanceError) {
        console.warn(
          "Image enhancement failed, using original:",
          enhanceError.message
        );
        finalBuffer = decodeBase64(base64);
      }
    } else {
      finalBuffer = decodeBase64(base64);
    }

    const fileExt = finalMimeType.split("/")[1] || "jpg";
    const sanitizedFilename = (filename || `image-${Date.now()}`)
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 100);
    const storagePath = `listings/${Date.now()}-${sanitizedFilename}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("marketplace-images")
      .upload(storagePath, finalBuffer, {
        contentType: finalMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading to Supabase Storage:", uploadError);
      const dataUrl = `data:${finalMimeType};base64,${finalBase64}`;
      return jsonResponse({
        url: dataUrl,
        path: null,
        isDataUrl: true,
        enhanced: enhance,
      });
    }

    const { data: urlData } = supabase.storage
      .from("marketplace-images")
      .getPublicUrl(storagePath);

    return jsonResponse({
      url: urlData.publicUrl,
      path: storagePath,
      isDataUrl: false,
      enhanced: enhance,
    });
  } catch (err) {
    console.error("Exception uploading image:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
