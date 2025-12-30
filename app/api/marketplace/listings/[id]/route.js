import { jsonResponse, optionsResponse } from "@/lib/http";
import {
  findUserByEmailSupabase,
  normalizeEmail,
  supabase,
} from "@/lib/supabase";
import { normalizeListingImages } from "@/lib/marketplace";

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

    const { id } = params;

    const { data, error } = await supabase
      .from("marketplace_listings")
      .select("*, images, seller_id")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return jsonResponse(
          {
            error: "not_found",
            message: "Listing tidak ditemukan",
          },
          404
        );
      }
      console.error("Error fetching listing:", error);
      return jsonResponse(
        {
          error: "database_error",
          message: error.message,
        },
        500
      );
    }

    const listing = normalizeListingImages(data);

    let seller = null;
    if (listing.seller_email) {
      const sellerData = await findUserByEmailSupabase(listing.seller_email);
      if (sellerData) {
        seller = {
          email: sellerData.email,
          name: sellerData.name || sellerData.email.split("@")[0],
          picture: sellerData.picture || null,
        };
      }
    }

    return jsonResponse({
      ...listing,
      seller,
    });
  } catch (err) {
    console.error("Exception fetching listing:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}

export async function DELETE(req, { params }) {
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

    const { data: listing, error: listingError } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", id)
      .single();

    if (listingError || !listing) {
      return jsonResponse(
        {
          error: "not_found",
          message: "Listing tidak ditemukan",
        },
        404
      );
    }

    if (listing.seller_email !== normalizeEmail(userEmail)) {
      return jsonResponse(
        {
          error: "forbidden",
          message: "Anda tidak memiliki izin untuk menghapus listing ini",
        },
        403
      );
    }

    const { data: activeOrders, error: ordersError } = await supabase
      .from("marketplace_orders")
      .select("id")
      .eq("listing_id", id)
      .in("status", ["pending", "deal"]);

    if (ordersError) {
      console.error("Error checking orders:", ordersError);
    }

    if (activeOrders && activeOrders.length > 0) {
      return jsonResponse(
        {
          error: "cannot_delete",
          message:
            "Tidak bisa menghapus listing yang masih memiliki order aktif (pending/deal). Silakan batalkan order terlebih dahulu.",
        },
        400
      );
    }

    const { error: deleteError } = await supabase
      .from("marketplace_listings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting listing:", deleteError);
      return jsonResponse(
        {
          error: "database_error",
          message: deleteError.message,
        },
        500
      );
    }

    console.log("Listing deleted:", id);
    return jsonResponse({
      success: true,
      message: "Listing berhasil dihapus",
    });
  } catch (err) {
    console.error("Exception deleting listing:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
