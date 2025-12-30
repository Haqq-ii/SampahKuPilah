import { jsonResponse, optionsResponse } from "@/lib/http";
import { normalizeEmail, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(_req, { params }) {
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

    const { user_email } = params;
    const normalizedEmail = normalizeEmail(user_email);

    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_email", normalizedEmail)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return jsonResponse({
          total_items_sold: 0,
          total_items_bought: 0,
          points_seller: 0,
          points_buyer: 0,
          total_points: 0,
        });
      }
      console.error("Error fetching user stats:", error);
      return jsonResponse(
        {
          error: "database_error",
          message: error.message,
        },
        500
      );
    }

    return jsonResponse({
      total_items_sold: data.total_items_sold || 0,
      total_items_bought: data.total_items_bought || 0,
      points_seller: data.points_seller || 0,
      points_buyer: data.points_buyer || 0,
      total_points: data.total_points || 0,
    });
  } catch (err) {
    console.error("Exception fetching user stats:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
