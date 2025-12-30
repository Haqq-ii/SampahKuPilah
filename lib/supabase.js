import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
export const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE?.trim() ||
  process.env.SUPABASE_SERVICE_KEY?.trim() ||
  "";
export const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

const supabaseKey = supabaseServiceKey || supabaseAnonKey;

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export async function findUserByEmailSupabase(email) {
  if (!supabase) return null;

  try {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        console.error("Error finding user in Supabase:", error);
      }
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception finding user in Supabase:", err);
    return null;
  }
}

export async function createUserSupabase(userData) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("users")
      .insert({
        email: normalizeEmail(userData.email),
        password_hash: userData.passwordHash || null,
        provider: userData.provider || "local",
        name: userData.name || null,
        picture: userData.picture || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating user in Supabase:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception creating user in Supabase:", err);
    return null;
  }
}

export async function getOrCreateAuthUserId(email) {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  try {
    const normalizedEmail = normalizeEmail(email);
    const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      if (listData?.users && Array.isArray(listData.users)) {
        const user = listData.users.find(
          (u) => u.email && u.email.toLowerCase() === normalizedEmail
        );
        if (user?.id) {
          console.log(`Found auth user for ${normalizedEmail}: ${user.id}`);
          return user.id;
        }
      }
    } else {
      const errorText = await listResponse.text();
      console.warn("Error listing auth users:", errorText.substring(0, 200));
    }

    const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: {},
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      if (createData?.user?.id) {
        console.log(`Created auth user for ${normalizedEmail}: ${createData.user.id}`);
        return createData.user.id;
      }
    } else {
      const errorText = await createResponse.text();
      console.error("Error creating auth user:", errorText.substring(0, 200));
    }

    console.warn(`Auth user ID not found/created for ${normalizedEmail}`);
    return null;
  } catch (err) {
    console.error("Error getting/creating auth user ID:", err.message);
    return null;
  }
}

export async function saveDetectionSupabase(userEmail, detectionData) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("detections")
      .insert({
        user_email: normalizeEmail(userEmail),
        category: detectionData.category || detectionData.bin || "abu-abu",
        bin_name: detectionData.bin_name || detectionData.dominant_class || "Residu",
        confidence: detectionData.confidence || 0.8,
        reason: detectionData.reason || "Auto-detected",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving detection to Supabase:", error);
      return null;
    }

    console.log("Detection saved to Supabase:", data.id);
    return data;
  } catch (err) {
    console.error("Exception saving detection to Supabase:", err);
    return null;
  }
}

export async function getDetectionsSupabase(userEmail, limit = 50) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("detections")
      .select("*")
      .eq("user_email", normalizeEmail(userEmail))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching detections from Supabase:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Exception fetching detections from Supabase:", err);
    return [];
  }
}
