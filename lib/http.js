export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email",
};

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
