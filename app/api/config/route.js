import { jsonResponse, optionsResponse } from "@/lib/http";
import { supabaseUrl } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return jsonResponse({
    supabaseUrl: supabaseUrl || "",
  });
}
