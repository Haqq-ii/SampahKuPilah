import { jsonResponse, optionsResponse, readJson } from "@/lib/http";
import {
  findUserByEmailSupabase,
  getOrCreateAuthUserId,
  normalizeEmail,
  supabase,
} from "@/lib/supabase";
import { buildImageUrls, normalizeListingImages } from "@/lib/marketplace";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(req) {
  try {
    if (!supabase) {
      return jsonResponse(
        {
          error: "database_not_available",
          message: "Supabase not configured",
          listings: [],
        },
        503
      );
    }

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const district = searchParams.get("district");
    const village = searchParams.get("village");
    const status = searchParams.get("status") || "active";
    const sort = searchParams.get("sort") || "newest";
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";
    const province = searchParams.get("province");

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("marketplace_listings")
      .select("*, images, seller_id", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (province) {
      query = query.eq("location_province", province);
    }
    if (city) {
      query = query.eq("location_city", city);
    }
    if (district) {
      query = query.eq("location_district", district);
    }
    if (village) {
      query = query.eq("location_village", village);
    }

    if (keyword && keyword.trim()) {
      query = query.textSearch("search_text", keyword.trim(), {
        type: "websearch",
        config: "indonesian",
      });
    }

    switch (sort) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "price_low":
        query = query.order("price", { ascending: true, nullsLast: true });
        break;
      case "price_high":
        query = query.order("price", { ascending: false, nullsLast: true });
        break;
      case "relevance":
        query = query.order("created_at", { ascending: false });
        break;
      case "location":
        query = query
          .order("location_city", { ascending: true })
          .order("location_district", { ascending: true })
          .order("location_village", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching listings:", error);
      return jsonResponse(
        {
          error: "database_error",
          message: error.message,
          listings: [],
        },
        500
      );
    }

    const listings = (data || []).map((listing) =>
      normalizeListingImages(listing)
    );

    return jsonResponse({
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error("Exception fetching listings:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
        listings: [],
      },
      500
    );
  }
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

    const user = await findUserByEmailSupabase(userEmail);
    if (!user) {
      return jsonResponse(
        {
          error: "user_not_found",
          message: "User tidak ditemukan",
        },
        404
      );
    }

    const body = (await readJson(req)) || {};
    const {
      title,
      description,
      category,
      tags = [],
      price = 0,
      images = [],
      location_province,
      location_city,
      location_district,
      location_village,
      use_ai = false,
    } = body;

    const imageUrls = buildImageUrls(images);

    if (!title || !description || !category) {
      return jsonResponse(
        {
          error: "validation_error",
          message: "Title, description, dan category wajib diisi",
        },
        400
      );
    }

    const searchText = `${title} ${description} ${tags.join(" ")}`.toLowerCase();

    let sellerId = user.id;
    const authUserId = await getOrCreateAuthUserId(userEmail);
    if (authUserId) {
      sellerId = authUserId;
      console.log(`Using auth.users.id for seller: ${sellerId}`);
    } else {
      console.warn(
        `Auth user ID not found/created for ${userEmail}, using users.id: ${user.id}`
      );
      sellerId = user.id;
    }

    const { data, error } = await supabase
      .from("marketplace_listings")
      .insert({
        seller_id: sellerId,
        seller_email: normalizeEmail(userEmail),
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: Array.isArray(tags) ? tags : [],
        price: parseFloat(price) || 0,
        images: imageUrls,
        location_province: location_province?.trim() || null,
        location_city: location_city?.trim() || null,
        location_district: location_district?.trim() || null,
        location_village: location_village?.trim() || null,
        status: "active",
        ai_generated: use_ai || false,
        search_text: searchText,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating listing:", error);
      return jsonResponse(
        {
          error: "database_error",
          message: error.message,
        },
        500
      );
    }

    console.log("Listing created:", data.id);
    return jsonResponse(
      {
        listing: data,
        message: "Listing berhasil dibuat",
      },
      201
    );
  } catch (err) {
    console.error("Exception creating listing:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
      },
      500
    );
  }
}
