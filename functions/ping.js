// v2 API: Request -> Response
export default async (request, context) => {
  const headers = {
    "Access-Control-Allow-Origin": process.env.PANEL_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }
  return new Response("pong", { status: 200, headers });
};
