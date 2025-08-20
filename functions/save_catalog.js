
// v1 function (CommonJS). No ESM, no 'node:' prefixes.
const { createSign, createPrivateKey } = require("crypto");

function json(data, statusCode = 200, extra = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...extra },
    body: JSON.stringify(data),
  };
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const b64urlStr = (s) => b64url(Buffer.from(s, "utf8"));

function resolvePrivateKey() {
  // Preferimos GH_PRIVATE_KEY_B64 si está
  const b64 = process.env.GH_PRIVATE_KEY_B64;
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {}
  }
  const raw = process.env.GH_PRIVATE_KEY || "";
  // Normalizar saltos
  return raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": process.env.PANEL_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  try {
    // Auth
    const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Missing token" }, 401, cors);
    const token = auth.slice(7).trim();
    if (token !== process.env.SAVE_TOKEN) return json({ error: "Invalid token" }, 403, cors);

    // Payload
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}
    if (!body?.productos || !body?.banners || !body?.config) return json({ error: "Missing payload" }, 400, cors);

    // JWT
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iat: now - 60, exp: now + 540, iss: process.env.GH_APP_ID };
    const unsigned = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(payload))}`;

    // Importar clave como KeyObject (conversión a PKCS#8 para OpenSSL 3)
    const pem = resolvePrivateKey();
    let keyObj;
    try {
      keyObj = createPrivateKey({ key: pem, format: "pem" });
      const pkcs8 = keyObj.export({ type: "pkcs8", format: "pem" });
      keyObj = createPrivateKey({ key: pkcs8, format: "pem" });
    } catch (e) {
      return json({ error: "key_import_error", detail: String(e?.message || e) }, 500, cors);
    }

    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    let signature;
    try {
      signature = signer.sign(keyObj);
    } catch (e) {
      return json({ error: "sign_error", detail: String(e?.message || e) }, 500, cors);
    }
    const jwt = `${unsigned}.${b64url(signature)}`;

    // Installation token
    const inst = process.env.GH_INSTALLATION_ID;
    const itRes = await fetch(`https://api.github.com/app/installations/${inst}/access_tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json", "User-Agent": "mgv-editor/1.0" },
    });
    const itData = await itRes.json();
    if (!itRes.ok) return json({ error: "GH install token error", detail: itData }, 500, cors);
    const ghToken = itData.token;

    const owner = process.env.GH_OWNER;
    const repo = process.env.GH_REPO;
    const branch = process.env.GH_BRANCH || "main";

    async function getSha(path) {
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "User-Agent": "mgv-editor/1.0" },
      });
      if (r.status === 200) return (await r.json()).sha;
      return null;
    }

    async function putFile(path, content, message) {
      const sha = await getSha(path);
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "User-Agent": "mgv-editor/1.0" },
        body: JSON.stringify({ message, branch, content: Buffer.from(content, "utf8").toString("base64"), sha }),
      });
      if (!r.ok) return json({ error: "GitHub PUT error", detail: await r.text() }, 500, cors);
    }

    await putFile("data/productos.json", JSON.stringify(body.productos, null, 2), "chore: update productos.json");
    await putFile("data/banners.json", JSON.stringify(body.banners, null, 2), "chore: update banners.json");
    await putFile("data/config.json", JSON.stringify(body.config, null, 2), "chore: update config.json");

    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: e.message || String(e) }, 500, cors);
  }
};
