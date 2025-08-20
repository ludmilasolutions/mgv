
// Netlify Function: save_catalog
// Guarda productos/banners/config en GitHub (GitHub App o PAT).
// CORS, OPTIONS y mensajes de error claros.

const crypto = require("crypto");
const GITHUB_API = "https://api.github.com";

function jsonResponse(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
      ...extraHeaders,
    },
  });
}

function b64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

// Build a GitHub App JWT (RS256)
function buildAppJWT(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 8 * 60, iss: appId };
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const unsigned = b64url(header) + "." + b64url(payload);
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const sig = signer.sign(privateKeyPem).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return unsigned + "." + sig;
}

async function ghFetch(path, token, method = "GET", body) {
  const url = `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "authorization": `token ${token}`,
      "accept": "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "mgv-netlify-fn",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text || "{}"); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

// encode path safely (each segment)
function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

async function createInstallationToken(appJWT, installationId) {
  return ghFetch(`/app/installations/${installationId}/access_tokens`, appJWT, "POST", {});
}

async function putFileWithToken({ owner, repo, branch, path, contentStr, token }) {
  const encPath = encodePath(path);
  // 1) GET to know sha (if exists)
  const get = await ghFetch(`/repos/${owner}/${repo}/contents/${encPath}?ref=${encodeURIComponent(branch)}`, token, "GET");
  let sha = undefined;
  if (get.ok && get.json && get.json.sha) sha = get.json.sha;

  // 2) PUT create or update
  const putBody = {
    message: `chore(panel): update ${path} ${new Date().toISOString()}`,
    content: b64(contentStr),
    branch,
  };
  if (sha) putBody.sha = sha;
  const put = await ghFetch(`/repos/${owner}/${repo}/contents/${encPath}`, token, "PUT", putBody);
  return { get, put };
}

export default async (req) => {
  if (req.method === "OPTIONS") return jsonResponse(204, {});

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed. Use POST." });
  }

  const auth = req.headers.get("authorization") || "";
  const tokenIn = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const SAVE_TOKEN = process.env.SAVE_TOKEN || "";
  if (!SAVE_TOKEN || tokenIn !== SAVE_TOKEN) {
    return jsonResponse(401, { error: "Unauthorized. Missing/invalid token." });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const owner  = process.env.GH_OWNER || "ludmilasolutions";
  const repo   = process.env.GH_REPO || "mgv";
  const branch = process.env.GH_BRANCH || "main";

  const { productos = [], banners = [], config = {} } = body || {};

  // Choose auth mode
  const GH_PAT = process.env.GH_PAT || "";
  let mode = "gh_app";
  let ghToken = null;

  if (GH_PAT) {
    mode = "pat";
    ghToken = GH_PAT;
  } else {
    const appId = process.env.GH_APP_ID;
    const instId = process.env.GH_INSTALLATION_ID;
    let priv = process.env.GH_PRIVATE_KEY;
    const privB64 = process.env.GH_PRIVATE_KEY_B64;
    if (!priv && privB64) {
      try { priv = Buffer.from(privB64, "base64").toString("utf8"); } catch {}
    }
    if (!appId || !instId || !priv) {
      return jsonResponse(500, { error: "GitHub App env missing (GH_APP_ID/GH_INSTALLATION_ID/GH_PRIVATE_KEY or GH_PRIVATE_KEY_B64). Or set GH_PAT to use PAT mode." });
    }
    // Build JWT and exchange for installation token
    try {
      const jwt = buildAppJWT(appId, priv);
      const tokRes = await createInstallationToken(jwt, instId);
      if (!tokRes.ok) {
        return jsonResponse(500, { error: "install_token_failed", details: tokRes });
      }
      ghToken = tokRes.json.token;
    } catch (e) {
      return jsonResponse(500, { error: "jwt_build_failed", details: String(e) });
    }
  }

  // Write all three files (secuencial para mensajes claros)
  const results = {};
  const files = [
    ["data/productos.json", JSON.stringify(productos, null, 2) + "\n"],
    ["data/banners.json",   JSON.stringify(banners,   null, 2) + "\n"],
    ["data/config.json",    JSON.stringify(config,    null, 2) + "\n"],
  ];

  for (const [path, txt] of files) {
    const r = await putFileWithToken({ owner, repo, branch, path, contentStr: txt, token: ghToken });
    // Si GitHub devuelve 404 en PUT, normalmente es falta de acceso al repo para ese token (GitHub suele ocultar con 404).
    if (!r.put.ok && r.put.status === 404 && mode === "gh_app" && GH_PAT) {
      // fallback automático a PAT si está definido
      const rr = await putFileWithToken({ owner, repo, branch, path, contentStr: txt, token: GH_PAT });
      results[path] = { modeTried: "gh_app_then_pat", get: r.get, put: rr.put };
      if (!rr.put.ok) {
        return jsonResponse(500, { error: `putFile ${path} failed (fallback PAT)`, details: rr.put });
      }
    } else {
      results[path] = { modeTried: mode, get: r.get, put: r.put };
      if (!r.put.ok) {
        return jsonResponse(500, { error: `putFile ${path} failed`, details: r.put });
      }
    }
  }

  return jsonResponse(200, { ok: true, mode, result: results });
};
