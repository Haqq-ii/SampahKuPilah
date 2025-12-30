import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import {
  findUserByEmailSupabase,
  normalizeEmail,
  supabase,
} from "@/lib/supabase";
import { generateMessageId } from "@/lib/marketplace";

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
    const { order_id, content } = body;
    if (!order_id || !content || !content.trim()) {
      return jsonResponse(
        {
          error: "validation_error",
          message: "order_id dan content wajib diisi",
        },
        400
      );
    }

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

    const receiverEmail =
      order.buyer_email === normalizedEmail
        ? order.seller_email
        : order.buyer_email;

    const sender = await findUserByEmailSupabase(userEmail);
    const receiver = await findUserByEmailSupabase(receiverEmail);

    if (!sender) {
      return jsonResponse(
        {
          error: "user_not_found",
          message: "User tidak ditemukan",
        },
        404
      );
    }

    const messageId = generateMessageId();

    const { data: message, error: messageError } = await supabase
      .from("marketplace_messages")
      .insert({
        message_id: messageId,
        order_id,
        sender_id: sender.id,
        sender_email: normalizedEmail,
        receiver_id: receiver?.id || null,
        receiver_email: receiverEmail,
        content: content.trim(),
        read: false,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message:", messageError);
      return jsonResponse(
        {
          error: "database_error",
          message: messageError.message,
        },
        500
      );
    }

    console.log("Message sent:", message.id);
    return jsonResponse(
      {
        message,
        success: true,
      },
      201
    );
  } catch (err) {
    console.error("Exception sending message:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
