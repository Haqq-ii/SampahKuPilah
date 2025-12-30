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

    const { order_id } = params;
    const url = new URL(req.url);
    const userEmail = url.searchParams.get("email") || req.headers.get("x-user-email");

    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return jsonResponse(
        {
          error: "order_not_found",
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

    const { data: messages, error: messagesError } = await supabase
      .from("marketplace_messages")
      .select("*")
      .eq("order_id", order_id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return jsonResponse(
        {
          error: "database_error",
          message: messagesError.message,
          messages: [],
        },
        500
      );
    }

    return jsonResponse({
      messages: messages || [],
      order,
    });
  } catch (err) {
    console.error("Exception fetching messages:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
        messages: [],
      },
      500
    );
  }
}
