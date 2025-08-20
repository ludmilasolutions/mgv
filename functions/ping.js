
// v1 function (CommonJS) with CORS
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": process.env.PANEL_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  return { statusCode: 200, headers, body: "pong" };
};
