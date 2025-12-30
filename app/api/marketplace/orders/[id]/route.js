import { jsonResponse, optionsResponse } from "@/lib/http";
import { normalizeEmail, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req, { params }) {
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

    const { id } = params;
    const url = new URL(req.url);
    const userEmail = url.searchParams.get("email") || req.headers.get("x-user-email");

    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return jsonResponse(
        {
          error: "not_found",
          message: "Order tidak ditemukan",
        },
        404
      );
    }

    if (userEmail) {
      const normalizedEmail = normalizeEmail(userEmail);
      if (
        order.buyer_email !== normalizedEmail &&
        order.seller_email !== normalizedEmail
      ) {
        return jsonResponse(
          {
            error: "forbidden",
            message: "Tidak memiliki akses ke order ini",
          },
          403
        );
      }
    }

    const { data: listing } = await supabase
      .from("marketplace_listings")
      .select("*, seller_id")
      .eq("id", order.listing_id)
      .single();

    return jsonResponse({
      ...order,
      listing: listing || null,
    });
  } catch (err) {
    console.error("Exception fetching order:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
