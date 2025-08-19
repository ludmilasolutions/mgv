import crypto from "node:crypto";

export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.PANEL_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const authz = req.headers["authorization"] || req.headers["Authorization"];
    if (!authz || !authz.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }
    const token = authz.slice("Bearer ".length).trim();
    if (token !== process.env.SAVE_TOKEN) {
      return res.status(403).json({ error: "Invalid token" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || !body.productos || !body.banners || !body.config) {
      return res.status(400).json({ error: "Missing payload" });
    }

    // Build GitHub App JWT
    const appId = process.env.GH_APP_ID;
    const now = Math.floor(Date.now()/1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iat: now-60, exp: now+540, iss: appId };
    const b64url = (obj)=>Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = b64url(header)+"."+b64url(payload);
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsigned);
    const signature = signer.sign(process.env.GH_PRIVATE_KEY, "base64url");
    const jwt = unsigned+"."+signature;

    // Installation token
    const instId = process.env.GH_INSTALLATION_ID;
    const itRes = await fetch(`https://api.github.com/app/installations/${instId}/access_tokens`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${jwt}`, "Accept": "application/vnd.github+json" },
    });
    const itData = await itRes.json();
    if (!itRes.ok) return res.status(500).json({ error: "GH install token error", detail: itData });
    const ghToken = itData.token;

    async function getSha(path){
      const r = await fetch(`https://api.github.com/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${path}?ref=${process.env.GH_BRANCH||"main"}`, {
        headers: { "Authorization": `Bearer ${ghToken}`, "Accept": "application/vnd.github+json" }
      });
      if (r.status===200){ const j = await r.json(); return j.sha; }
      return null;
    }
    async function putFile(path, content, message){
      const sha = await getSha(path);
      const r = await fetch(`https://api.github.com/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${path}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${ghToken}`, "Accept": "application/vnd.github+json" },
        body: JSON.stringify({
          message, branch: process.env.GH_BRANCH||"main",
          content: Buffer.from(content, "utf8").toString("base64"),
          sha
        })
      });
      if (!r.ok){ const t = await r.text(); throw new Error("GitHub PUT error: "+t);}
    }

    await putFile("data/productos.json", JSON.stringify(body.productos, null, 2), "chore: update productos.json");
    await putFile("data/banners.json", JSON.stringify(body.banners, null, 2), "chore: update banners.json");
    await putFile("data/config.json", JSON.stringify(body.config, null, 2), "chore: update config.json");

    return res.status(200).json({ ok: true, commit: "changes queued" });
  } catch (e) {
    return res.status(500).json({ error: e.message||String(e) });
  }
};