import { jsonResponse, optionsResponse } from "@/lib/http";
import { normalizeEmail, supabase } from "@/lib/supabase";

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
        },
        503
      );
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "all";
    const limit = url.searchParams.get("limit") || "10";
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    let sellerLeaderboard = [];
    let buyerLeaderboard = [];

    if (type === "all" || type === "seller") {
      const { data: sellerData, error: sellerError } = await supabase
        .from("user_stats")
        .select("*")
        .order("points_seller", { ascending: false })
        .limit(limitNum);

      if (!sellerError && sellerData) {
        const sellerEmails = sellerData
          .map((s) => normalizeEmail(s.user_email))
          .filter(Boolean);

        const usersMap = new Map();
        if (sellerEmails.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("email, name, picture")
            .in("email", sellerEmails);

          if (usersData) {
            usersData.forEach((user) => {
              usersMap.set(normalizeEmail(user.email), user);
            });
          }
        }

        sellerLeaderboard = sellerData.map((stat, index) => {
          const userInfo = usersMap.get(normalizeEmail(stat.user_email));
          const userName =
            userInfo?.name ||
            userInfo?.email?.split("@")[0] ||
            stat.user_email?.split("@")[0] ||
            "User";

          return {
            rank: index + 1,
            user_email: stat.user_email,
            user_name: userName,
            user_picture: userInfo?.picture || null,
            total_items_sold: stat.total_items_sold || 0,
            points_seller: stat.points_seller || 0,
          };
        });
      }
    }

    if (type === "all" || type === "buyer") {
      const { data: buyerData, error: buyerError } = await supabase
        .from("user_stats")
        .select("*")
        .order("points_buyer", { ascending: false })
        .limit(limitNum);

      if (!buyerError && buyerData) {
        const buyerEmails = buyerData
          .map((b) => normalizeEmail(b.user_email))
          .filter(Boolean);

        const usersMap = new Map();
        if (buyerEmails.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("email, name, picture")
            .in("email", buyerEmails);

          if (usersData) {
            usersData.forEach((user) => {
              usersMap.set(normalizeEmail(user.email), user);
            });
          }
        }

        buyerLeaderboard = buyerData.map((stat, index) => {
          const userInfo = usersMap.get(normalizeEmail(stat.user_email));
          const userName =
            userInfo?.name ||
            userInfo?.email?.split("@")[0] ||
            stat.user_email?.split("@")[0] ||
            "User";

          return {
            rank: index + 1,
            user_email: stat.user_email,
            user_name: userName,
            user_picture: userInfo?.picture || null,
            total_items_bought: stat.total_items_bought || 0,
            points_buyer: stat.points_buyer || 0,
          };
        });
      }
    }

    return jsonResponse({
      seller_leaderboard: sellerLeaderboard,
      buyer_leaderboard: buyerLeaderboard,
    });
  } catch (err) {
    console.error("Exception fetching leaderboard:", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err.message,
        seller_leaderboard: [],
        buyer_leaderboard: [],
      },
      500
    );
  }
}
