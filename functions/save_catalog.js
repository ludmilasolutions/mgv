// functions/save_catalog.js
// Netlify Function: guarda productos/banners/config en GitHub (vía GitHub App)

const GITHUB_API = "https://api.github.com";

const ok = (body = {}) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  },
  body: JSON.stringify(body),
});

const err = (status, error) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  },
  body: JSON.stringify({ error }),
});

// Base64URL sin padding
const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

// Firma JWT RS256 para GitHub App sin librerías externas
function signAppJWT(appId, privateKeyPEM) {
  const crypto = require("node:crypto");

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  // exp <= 10 min según GitHub
  const payloadObj = { iat: now - 60, exp: now + 9 * 60, iss: appId };
  const payload = b64url(JSON.stringify(payloadObj));
  const data = `${header}.${payload}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  const signature = b64url(sign.sign(privateKeyPEM));
  return `${data}.${signature}`;
}

async function getInstallationToken(jwt, installationId) {
  const url = `${GITHUB_API}/app/installations/${installationId}/access_tokens`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "User-Agent": "mgv-save-catalog",
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`install_token_failed: ${r.status} ${t}`);
  }
  return r.json();
}

async function getFileSha({ owner, repo, path, branch, token }) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "mgv-save-catalog",
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`getFileSha failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j.sha || null;
}

async function putFile({ owner, repo, path, branch, token, content, message }) {
  const sha = await getFileSha({ owner, repo, path, branch, token }).catch(
    () => null
  );

  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}`;
  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "mgv-save-catalog",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    let t;
    try {
      t = await r.text();
    } catch {
      t = String(r.status);
    }
    throw new Error(`putFile ${path} failed: ${t}`);
  }
  return r.json();
}

exports.handler = async (event) => {
  // CORS / preflight
  if (event.httpMethod === "OPTIONS") return ok();
  // ping de salud (útil para el botón "Test")
  if (event.httpMethod === "GET") return ok({ pong: true });

  if (event.httpMethod !== "POST") {
    return err(405, "Method not allowed");
  }

  // Token simple del panel
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const tokenClient = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!process.env.SAVE_TOKEN) return err(500, "missing SAVE_TOKEN");
  if (!tokenClient || tokenClient !== process.env.SAVE_TOKEN)
    return err(401, "unauthorized");

  // Cargar body
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "invalid_json");
  }
  const { productos, banners, config } = payload || {};
  if (!Array.isArray(productos) || !Array.isArray(banners) || !config)
    return err(400, "invalid_payload");

  // ENV requeridas
  const {
    GH_APP_ID,
    GH_INSTALLATION_ID,
    GH_OWNER,
    GH_REPO,
    GH_BRANCH = "main",
    GH_PRIVATE_KEY, // opcional
    GH_PRIVATE_KEY_B64, // o esta
  } = process.env;

  if (!GH_APP_ID || !GH_INSTALLATION_ID || !GH_OWNER || !GH_REPO) {
    return err(500, "missing_github_env");
  }

  // Clave privada en PEM
  let privateKeyPEM = GH_PRIVATE_KEY || "";
  if (!privateKeyPEM && GH_PRIVATE_KEY_B64) {
    try {
      privateKeyPEM = Buffer.from(GH_PRIVATE_KEY_B64, "base64").toString("utf8");
    } catch {
      return err(500, "key_import_error");
    }
  }
  if (!privateKeyPEM) return err(500, "missing_private_key");

  try {
    // 1) JWT App
    const jwt = signAppJWT(GH_APP_ID, privateKeyPEM);

    // 2) Installation token
    const inst = await getInstallationToken(jwt, GH_INSTALLATION_ID);
    const ghToken = inst.token;

    // 3) Subir archivos
    const owner = GH_OWNER;
    const repo = GH_REPO;
    const branch = GH_BRANCH;

    const results = [];

    results.push(
      await putFile({
        owner,
        repo,
        branch,
        token: ghToken,
        path: "data/productos.json",
        message: "panel: update productos.json",
        content: JSON.stringify(productos, null, 2),
      })
    );
    results.push(
      await putFile({
        owner,
        repo,
        branch,
        token: ghToken,
        path: "data/banners.json",
        message: "panel: update banners.json",
        content: JSON.stringify(banners, null, 2),
      })
    );
    results.push(
      await putFile({
        owner,
        repo,
        branch,
        token: ghToken,
        path: "data/config.json",
        message: "panel: update config.json",
        content: JSON.stringify(config, null, 2),
      })
    );

    return ok({
      done: true,
      commits: results.map((r) => r.commit && r.commit.sha),
    });
  } catch (e) {
    return err(500, String(e.message || e));
  }
};
