// functions/save_catalog.js
const GITHUB_API = "https://api.github.com";

function ok(body = {}, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "OPTIONS, POST"
    },
    body: JSON.stringify(body)
  };
}
function err(statusCode = 500, message = "error", extra = {}) {
  return ok({ error: message, ...extra }, statusCode);
}

const jwt = require('jsonwebtoken');

function base64Decode(input) {
  return Buffer.from(input, "base64").toString("utf8");
}
function getPrivateKey() {
  if (process.env.GH_PRIVATE_KEY_B64) {
    return base64Decode(process.env.GH_PRIVATE_KEY_B64);
  }
  return process.env.GH_PRIVATE_KEY;
}
function makeAppJWT() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: process.env.GH_APP_ID
    },
    getPrivateKey(),
    { algorithm: "RS256" }
  );
}
async function ghInstallationToken() {
  const tokenApp = makeAppJWT();
  const r = await fetch(`${GITHUB_API}/app/installations/${process.env.GH_INSTALLATION_ID}/access_tokens`, {
    method: "POST",
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${tokenApp}`,
      "user-agent": "mgv-app/1.0"
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`installation token ${r.status}: ${text}`);
  return JSON.parse(text).token;
}
async function getCurrentSha(path, token) {
  const url = `${GITHUB_API}/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(process.env.GH_BRANCH)}`;
  const r = await fetch(url, {
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${token}`,
      "user-agent": "mgv-app/1.0"
    }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`get sha ${r.status}`);
  const j = await r.json();
  return j.sha || null;
}
async function putFile({ path, message, jsonOrString }) {
  const token = await ghInstallationToken();
  const contentStr = typeof jsonOrString === "string" ? jsonOrString : JSON.stringify(jsonOrString, null, 2);
  const sha = await getCurrentSha(path, token);
  const body = {
    message,
    branch: process.env.GH_BRANCH,
    content: Buffer.from(contentStr, "utf8").toString("base64"),
    ...(sha ? { sha } : {})
  };
  const url = `${GITHUB_API}/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${encodeURIComponent(path)}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "mgv-app/1.0"
    },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`putFile ${path} ${r.status}: ${text}`);
  return JSON.parse(text);
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod === "OPTIONS") return ok();
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const tokenClient = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!tokenClient || tokenClient !== process.env.SAVE_TOKEN) {
      return { statusCode: 401, body: "unauthorized" };
    }
    const body = JSON.parse(event.body || "{}");
    const { productos, banners, config } = body;
    const results = [];
    if (Array.isArray(productos)) {
      results.push(await putFile({
        path: "data/productos.json",
        message: "panel: update productos.json",
        jsonOrString: productos
      }));
    }
    if (Array.isArray(banners)) {
      results.push(await putFile({
        path: "data/banners.json",
        message: "panel: update banners.json",
        jsonOrString: banners
      }));
    }
    if (config && typeof config === "object") {
      results.push(await putFile({
        path: "data/config.json",
        message: "panel: update config.json",
        jsonOrString: config
      }));
    }
    return ok({ done: true, commits: results.map(r => r && r.commit ? r.commit.sha : null) });
  } catch (e) {
    return err(502, "save_catalog failed", { message: e.message, stack: e.stack });
  }
};
