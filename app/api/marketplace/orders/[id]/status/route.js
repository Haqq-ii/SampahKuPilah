import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import { normalizeEmail, supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function PUT(req, { params }) {
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
    const { status, cod_location, cod_time } = body;
    if (!status) {
      return jsonResponse(
        {
          error: "validation_error",
          message: "Status wajib diisi",
        },
        400
      );
    }

    const validStatuses = ["pending", "deal", "done", "canceled"];
    if (!validStatuses.includes(status)) {
      return jsonResponse(
        {
          error: "invalid_status",
          message: `Status harus salah satu dari: ${validStatuses.join(", ")}`,
        },
        400
      );
    }

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

    const normalizedEmail = normalizeEmail(userEmail);
    if (
      order.buyer_email !== normalizedEmail &&
      order.seller_email !== normalizedEmail
    ) {
      return jsonResponse(
        {
          error: "forbidden",
          message: "Tidak memiliki akses untuk update order ini",
        },
        403
      );
    }

    if (status === "done" && order.seller_email !== normalizedEmail) {
      return jsonResponse(
        {
          error: "forbidden",
          message: "Hanya penjual yang bisa menandai order sebagai selesai",
        },
        403
      );
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (cod_location) updateData.cod_location = cod_location.trim();
    if (cod_time) updateData.cod_time = cod_time;

    const { data: updatedOrder, error: updateError } = await supabase
      .from("marketplace_orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating order:", updateError);
      return jsonResponse(
        {
          error: "database_error",
          message: updateError.message,
        },
        500
      );
    }

    if (status === "done") {
      await supabase
        .from("marketplace_listings")
        .update({ status: "sold", updated_at: new Date().toISOString() })
        .eq("id", order.listing_id);

      const sellerStats = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_email", order.seller_email)
        .single();

      if (sellerStats.data) {
        await supabase
          .from("user_stats")
          .update({
            total_items_sold: (sellerStats.data.total_items_sold || 0) + 1,
            points_seller: (sellerStats.data.points_seller || 0) + 10,
            total_points:
              (sellerStats.data.points_seller || 0) +
              10 +
              (sellerStats.data.points_buyer || 0),
            updated_at: new Date().toISOString(),
          })
          .eq("user_email", order.seller_email);
      } else {
        await supabase.from("user_stats").insert({
          user_email: order.seller_email,
          total_items_sold: 1,
          points_seller: 10,
          total_points: 10,
        });
      }

      const buyerStats = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_email", order.buyer_email)
        .single();

      if (buyerStats.data) {
        await supabase
          .from("user_stats")
          .update({
            total_items_bought: (buyerStats.data.total_items_bought || 0) + 1,
            points_buyer: (buyerStats.data.points_buyer || 0) + 5,
            total_points:
              (buyerStats.data.points_seller || 0) +
              (buyerStats.data.points_buyer || 0) +
              5,
            updated_at: new Date().toISOString(),
          })
          .eq("user_email", order.buyer_email);
      } else {
        await supabase.from("user_stats").insert({
          user_email: order.buyer_email,
          total_items_bought: 1,
          points_buyer: 5,
          total_points: 5,
        });
      }

      console.log("Order marked as done, stats updated");
    }

    return jsonResponse({
      order: updatedOrder,
      message: "Status order berhasil diupdate",
    });
  } catch (err) {
    console.error("Exception updating order:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
