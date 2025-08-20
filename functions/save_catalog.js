/**
 * Netlify Function: save_catalog
 * Writes data/productos.json, data/banners.json, data/config.json to GitHub.
 * Auth: "Authorization: Bearer <SAVE_TOKEN>"
 * Env required (GitHub App mode):
 *   - GH_APP_ID
 *   - GH_INSTALLATION_ID
 *   - GH_PRIVATE_KEY_B64  (base64 of PEM)  OR GH_PRIVATE_KEY (PEM)
 *   - GH_OWNER, GH_REPO
 *   - (optional) GH_BRANCH (default: main)
 * OR (fallback) Personal Access Token mode:
 *   - GH_PAT
 */
const crypto = require("crypto");

function b64url(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Content-Type": "application/json; charset=utf-8",
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  const headers = corsHeaders();
  try {
    // Auth by SAVE_TOKEN
    const SAVE_TOKEN = process.env.SAVE_TOKEN || "";
    const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
    const tokenProvided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!SAVE_TOKEN || !tokenProvided || tokenProvided !== SAVE_TOKEN) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // Parse body
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing body" }) };
    }
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
    }
    const { productos = [], banners = [], config = {} } = payload || {};

    const owner = process.env.GH_OWNER;
    const repo  = process.env.GH_REPO;
    const branch = process.env.GH_BRANCH || "main";

    if (!owner || !repo) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing GH_OWNER/GH_REPO env" }) };
    }

    // Acquire GitHub token (PAT fallback)
    let ghToken = process.env.GH_PAT || "";
    let mode = "pat";
    if (!ghToken) {
      // GitHub App flow
      const APP_ID = process.env.GH_APP_ID;
      const INST_ID = process.env.GH_INSTALLATION_ID;
      const keyB64  = process.env.GH_PRIVATE_KEY_B64 || "";
      const keyPem  = process.env.GH_PRIVATE_KEY || (keyB64 ? Buffer.from(keyB64, "base64").toString("utf-8") : "");
      if (!APP_ID || !INST_ID || !keyPem) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "GitHub App credentials missing" }) };
      }
      const nowSec = Math.floor(Date.now()/1000);
      const header = { alg: "RS256", typ: "JWT" };
      const body = { iat: nowSec - 60, exp: nowSec + 8*60, iss: APP_ID };
      const signingInput = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(body));
      const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(keyPem);
      const jwt = signingInput + "." + b64url(signature);
      // Exchange for installation access token
      const res = await fetch(`https://api.github.com/app/installations/${INST_ID}/access_tokens`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${jwt}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "mgv-save-catalog"
        },
      });
      const j = await res.json().catch(()=> ({}));
      if (!res.ok || !j.token) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "install_token_failed", status: res.status, body: j }) };
      }
      ghToken = j.token;
      mode = "gh_app";
    }

    async function getFile(path) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`, {
        headers: {
          "Authorization": `Bearer ${ghToken}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "mgv-save-catalog"
        }
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        const b = await res.text();
        throw new Error(`getFile ${path} failed: ${res.status} ${b}`);
      }
      return res.json();
    }

    async function putFile(path, contentText, message) {
      const existing = await getFile(path);
      const body = {
        message,
        content: Buffer.from(contentText, "utf-8").toString("base64"),
        branch
      };
      if (existing && existing.sha) body.sha = existing.sha;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${ghToken}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "mgv-save-catalog",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const j = await res.json().catch(()=> ({}));
      if (!res.ok) {
        throw new Error(`putFile ${path} failed: ${res.status} ${JSON.stringify(j)}`);
      }
      return j;
    }

    // Write files (sequential to keep it simple)
    const msg = `chore(panel): update catalog ${new Date().toISOString()}`;
    const result = {};
    result.productos = await putFile("data/productos.json", JSON.stringify(productos, null, 2), msg);
    result.banners   = await putFile("data/banners.json",   JSON.stringify(banners,   null, 2), msg);
    result.config    = await putFile("data/config.json",    JSON.stringify(config,    null, 2), msg);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode, result }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
