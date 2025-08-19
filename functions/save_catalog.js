import { createSign } from "node:crypto";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

export default async (request, context) => {
  const cors = {
    "Access-Control-Allow-Origin": process.env.PANEL_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    // --- Auth del panel ---
    const auth = request.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Missing token" }, 401, cors);
    }
    const token = auth.slice(7).trim();
    if (token !== process.env.SAVE_TOKEN) {
      return json({ error: "Invalid token" }, 403, cors);
    }

    // --- Payload ---
    const body = await request.json().catch(() => ({}));
    if (!body?.productos || !body?.banners || !body?.config) {
      return json({ error: "Missing payload" }, 400, cors);
    }

    // --- JWT de GitHub App ---
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iat: now - 60, exp: now + 540, iss: process.env.GH_APP_ID };
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${b64url(header)}.${b64url(payload)}`;

    // Normalizar la key por si la pegaron con \n o con CRLF
    const rawKey = process.env.GH_PRIVATE_KEY || "";
    const pk = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const signature = signer.sign(pk, "base64url");
    const jwt = `${unsigned}.${signature}`;

    // --- Installation token ---
    const inst = process.env.GH_INSTALLATION_ID;
    const itRes = await fetch(`https://api.github.com/app/installations/${inst}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "mgv-editor/1.0",
      },
    });
    const itData = await itRes.json();
    if (!itRes.ok) {
      return json({ error: "GH install token error", detail: itData }, 500, cors);
    }
    const ghToken = itData.token;

    const owner = process.env.GH_OWNER;
    const repo = process.env.GH_REPO;
    const branch = process.env.GH_BRANCH || "main";

    async function getSha(path) {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        { headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "User-Agent": "mgv-editor/1.0" } }
      );
      if (r.status === 200) return (await r.json()).sha;
      return null;
    }

    async function putFile(path, content, message) {
      const sha = await getSha(path);
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json", "User-Agent": "mgv-editor/1.0" },
        body: JSON.stringify({
          message,
          branch,
          content: Buffer.from(content, "utf8").toString("base64"),
          sha,
        }),
      });
      if (!r.ok) throw new Error(`GitHub PUT error: ${await r.text()}`);
    }

    await putFile("data/productos.json", JSON.stringify(body.productos, null, 2), "chore: update productos.json");
    await putFile("data/banners.json", JSON.stringify(body.banners, null, 2), "chore: update banners.json");
    await putFile("data/config.json", JSON.stringify(body.config, null, 2), "chore: update config.json");

    return json({ ok: true, commit: "changes queued" }, 200, cors);
  } catch (e) {
    return json({ error: e.message || String(e) }, 500, cors);
  }
};
