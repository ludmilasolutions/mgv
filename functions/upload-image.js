// functions/upload-image.js
// Subida de imágenes usando GitHub App (mismo esquema que save_catalog).
// - Espera multipart/form-data con campo 'file'
// - Verifica Authorization: Bearer <SAVE_TOKEN> si existe SAVE_TOKEN en env
// - Escribe en: assets/uploads/YYYY/MM/<timestamp>_<slug>
// - Responde: { ok:true, url, path, commitSha }
const crypto = require("crypto");

function json(body, statusCode = 200){
  return {
    statusCode,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "access-control-allow-origin": process.env.PANEL_ORIGIN || "*",
      "access-control-allow-headers":"authorization, content-type",
      "access-control-allow-methods":"OPTIONS, POST"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try{
    if (event.httpMethod === "OPTIONS") return json({}, 200);
    if (event.httpMethod !== "POST") return json({error:"Method Not Allowed"}, 405);

    // Auth del panel (token corto) si está configurado
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const tokenClient = auth && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (process.env.SAVE_TOKEN) {
      if (!tokenClient || tokenClient !== process.env.SAVE_TOKEN) {
        return json({ error:"unauthorized" }, 401);
      }
    }

    // --- Parse multipart ---
    const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const m = /boundary=(.*)$/i.exec(ct);
    if (!m) return json({ ok:false, error:"Missing multipart boundary" }, 400);
    const boundary = m[1];
    const buf = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
    const boundaryBuf = Buffer.from("--" + boundary);
    let start = 0, files = [];
    while (true){
      const i = buf.indexOf(boundaryBuf, start);
      if (i === -1) break;
      const j = buf.indexOf(boundaryBuf, i + boundaryBuf.length);
      if (j === -1) break;
      const part = buf.slice(i + boundaryBuf.length + 2, j - 2); // skip CRLFs
      const sep = part.indexOf(Buffer.from("\r\n\r\n"));
      if (sep !== -1) {
        const head = part.slice(0, sep).toString("utf8");
        const body = part.slice(sep + 4);
        const isFile = /name="file"/i.test(head);
        if (isFile) {
          const fn = /filename="([^"]+)"/i.exec(head)?.[1] || "upload.bin";
          const ct = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || "application/octet-stream";
          files.push({ filename: fn, contentType: ct, bytes: body });
        }
      }
      start = j;
    }
    if (!files.length) return json({ ok:false, error:"No 'file' field" }, 400);
    const file = files[0];
    if (!/^image\//i.test(file.contentType)) return json({ ok:false, error:"Not an image" }, 400);

    // --- GitHub App auth ---
    function b64url(input){
      return Buffer.from(input).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
    }
    function getPem(){
      if (process.env.GH_PRIVATE_KEY) return process.env.GH_PRIVATE_KEY;
      if (process.env.GH_PRIVATE_KEY_B64) return Buffer.from(process.env.GH_PRIVATE_KEY_B64, "base64").toString("utf8");
      return null;
    }
    const pem = getPem();
    if (!pem || !process.env.GH_APP_ID || !process.env.GH_INSTALLATION_ID) {
      return json({ ok:false, error:"Missing GH App env (GH_APP_ID/GH_INSTALLATION_ID/GH_PRIVATE_KEY[_B64])" }, 500);
    }
    const now = Math.floor(Date.now()/1000);
    const header  = { alg:"RS256", typ:"JWT" };
    const payload = { iat: now-60, exp: now+9*60, iss: process.env.GH_APP_ID };
    const signingInput = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingInput);
    const signature = b64url(signer.sign(pem));
    const appJwt = signingInput + "." + signature;

    const installUrl = `https://api.github.com/app/installations/${process.env.GH_INSTALLATION_ID}/access_tokens`;
    const rTok = await fetch(installUrl, {
      method:"POST",
      headers:{ "accept":"application/vnd.github+json", "authorization":`Bearer ${appJwt}`, "user-agent":"mgv-app/1.0" }
    });
    const tokTxt = await rTok.text();
    if (!rTok.ok) return json({ ok:false, error:`installation token ${rTok.status}: ${tokTxt}` }, 502);
    const ghToken = JSON.parse(tokTxt).token;

    // --- Guardar archivo ---
    function slug(name){
      return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase();
    }
    const nowD = new Date();
    const yyyy = String(nowD.getUTCFullYear());
    const mm = String(nowD.getUTCMonth()+1).padStart(2,"0");
    const clean = slug(file.filename || "upload");
    const relPath = `assets/uploads/${yyyy}/${mm}/${Date.now()}_${clean}`;

    const url = `https://api.github.com/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${encodeURIComponent(relPath)}`;
    const resp = await fetch(url, {
      method:"PUT",
      headers:{
        "accept":"application/vnd.github+json",
        "authorization":`Bearer ${ghToken}`,
        "content-type":"application/json",
        "user-agent":"mgv-app/1.0"
      },
      body: JSON.stringify({
        message: `panel: upload ${clean}`,
        content: file.bytes.toString("base64"),
        branch: process.env.GH_BRANCH || "main"
      })
    });
    const text = await resp.text();
    if (!resp.ok) return json({ ok:false, error:`put ${resp.status}: ${text}` }, resp.status);

    let data = {};
    try{ data = JSON.parse(text); }catch(_){}
    const commitSha = data?.commit?.sha || null;
    const rawUrl = commitSha
      ? `https://raw.githubusercontent.com/${process.env.GH_OWNER}/${process.env.GH_REPO}/${commitSha}/${relPath}`
      : `https://raw.githubusercontent.com/${process.env.GH_OWNER}/${process.env.GH_REPO}/${process.env.GH_BRANCH || "main"}/${relPath}`;

    return json({ ok:true, url: rawUrl, path: relPath, commitSha });
  }catch(e){
    return json({ ok:false, error: e.message || String(e) }, 500);
  }
};
