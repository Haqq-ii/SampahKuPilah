import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import {
  createUserSupabase,
  findUserByEmailSupabase,
  normalizeEmail,
  supabase,
} from "@/lib/supabase";

export const runtime = "nodejs";

const IS_VERCEL = process.env.VERCEL === "1" || process.env.VERCEL_ENV;

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(req) {
  try {
    const user = (await readJson(req)) || {};
    const email = normalizeEmail(user.email);

    let existingUser = null;
    if (supabase) {
      existingUser = await findUserByEmailSupabase(email);
    }

    if (!existingUser) {
      if (supabase) {
        const created = await createUserSupabase({
          email,
          provider: "google",
          name: user.name || null,
          picture: user.picture || null,
        });
        if (!created && IS_VERCEL) {
          console.error("Failed to create Google user in Supabase on Vercel");
          return jsonResponse(
            {
              message:
                "Gagal menyimpan user. Pastikan Supabase dikonfigurasi dengan benar.",
            },
            500
          );
        }
      } else if (IS_VERCEL) {
        console.error("Supabase not configured on Vercel");
        return jsonResponse(
          {
            message: "Database tidak tersedia. Pastikan Supabase dikonfigurasi.",
          },
          500
        );
      }
    }

    return jsonResponse({ message: "Google user disimpan!" });
  } catch (error) {
    console.error("Error saving Google user:", error);
    return jsonResponse({ message: "Terjadi kesalahan server" }, 500);
  }
}
