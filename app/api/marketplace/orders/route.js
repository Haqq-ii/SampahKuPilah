import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import {
  findUserByEmailSupabase,
  getOrCreateAuthUserId,
  normalizeEmail,
  supabase,
} from "@/lib/supabase";
import { generateOrderId } from "@/lib/marketplace";

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
          message: "Email user diperlukan (header x-user-email)",
        },
        401
      );
    }

    const buyer = await findUserByEmailSupabase(userEmail);
    if (!buyer) {
      return jsonResponse(
        {
          error: "user_not_found",
          message: "User tidak ditemukan",
        },
        404
      );
    }

    const body = (await readJson(req)) || {};
    const { listing_id } = body;
    if (!listing_id) {
      return jsonResponse(
        {
          error: "validation_error",
          message: "listing_id wajib diisi",
        },
        400
      );
    }

    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("*, seller_id")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return jsonResponse(
        {
          error: "listing_not_found",
          message: "Listing tidak ditemukan",
        },
        404
      );
    }

    if (listing.seller_email === normalizeEmail(userEmail)) {
      return jsonResponse(
        {
          error: "invalid_action",
          message: "Tidak bisa membeli listing sendiri",
        },
        400
      );
    }

    if (listing.status !== "active") {
      return jsonResponse(
        {
          error: "invalid_status",
          message: "Listing tidak tersedia untuk dibeli",
        },
        400
      );
    }

    const orderId = generateOrderId();

    let sellerId = listing.seller_id;
    let buyerId = buyer.id;

    const sellerAuthId = await getOrCreateAuthUserId(listing.seller_email);
    if (sellerAuthId) {
      sellerId = sellerAuthId;
      console.log(`Using auth.users.id for seller: ${sellerId}`);
    } else if (!listing.seller_id) {
      return jsonResponse(
        {
          error: "invalid_listing",
          message:
            "Listing tidak memiliki seller_id yang valid dan gagal membuat auth user",
        },
        400
      );
    } else {
      console.warn(`Using existing listing.seller_id: ${listing.seller_id}`);
      sellerId = listing.seller_id;
    }

    const buyerAuthId = await getOrCreateAuthUserId(userEmail);
    if (buyerAuthId) {
      buyerId = buyerAuthId;
      console.log(`Using auth.users.id for buyer: ${buyerId}`);
    } else {
      console.warn(
        `Auth user ID not found/created for buyer ${userEmail}, using users.id: ${buyer.id}`
      );
      buyerId = buyer.id;
    }

    const { data: order, error: orderError } = await supabase
      .from("marketplace_orders")
      .insert({
        order_id: orderId,
        listing_id,
        seller_id: sellerId,
        seller_email: listing.seller_email,
        buyer_id: buyerId,
        buyer_email: normalizeEmail(userEmail),
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return jsonResponse(
        {
          error: "database_error",
          message: orderError.message,
        },
        500
      );
    }

    console.log("Order created:", order.id);
    return jsonResponse(
      {
        order,
        message: "Order berhasil dibuat",
      },
      201
    );
  } catch (err) {
    console.error("Exception creating order:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}

export async function GET(req) {
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

    const url = new URL(req.url);
    const userEmail = url.searchParams.get("email") || req.headers.get("x-user-email");
    if (!userEmail) {
      return jsonResponse(
        {
          error: "unauthorized",
          message: "Email user diperlukan",
        },
        401
      );
    }

    const role = url.searchParams.get("role") || "buyer";
    const status = url.searchParams.get("status");
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "20";
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("marketplace_orders")
      .select("*", { count: "exact" });

    if (role === "buyer") {
      query = query.eq("buyer_email", normalizeEmail(userEmail));
    } else if (role === "seller") {
      query = query.eq("seller_email", normalizeEmail(userEmail));
    } else {
      query = query.or(
        `buyer_email.eq.${normalizeEmail(userEmail)},seller_email.eq.${normalizeEmail(
          userEmail
        )}`
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    query = query.order("created_at", { ascending: false });
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching orders:", error);
      return jsonResponse(
        {
          error: "database_error",
          message: error.message,
          orders: [],
        },
        500
      );
    }

    return jsonResponse({
      orders: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error("Exception fetching orders:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
        orders: [],
      },
      500
    );
  }
}
