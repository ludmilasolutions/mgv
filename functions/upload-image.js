// functions/upload-image.js
// Upload de imágenes con autenticación de PANEL por SAVE_TOKEN
// y autenticación a GitHub mediante GitHub App (o PAT de fallback).
// No requiere dependencias externas (Node 18+).

const crypto = require("crypto");

function res(status, obj){
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(obj)
  };
}

// ==== Auth del panel (SAVE_TOKEN) ====
function checkSaveToken(event){
  const must = (process.env.SAVE_TOKEN || "").trim();
  if (!must) return { ok:false, error:"Missing SAVE_TOKEN env" };
  const hdr = event.headers.authorization || event.headers.Authorization || "";
  const got = hdr.startsWith("Bearer ") ? hdr.slice(7) : hdr;
  if (got !== must) return { ok:false, error:"unauthorized" };
  return { ok:true };
}

// ==== GitHub App helpers ====
function b64ToPem(b64){
  try { return Buffer.from(b64, "base64").toString("utf8"); } catch(_){ return ""; }
}

function buildAppJWT(appId, privateKeyPem){
  const now = Math.floor(Date.now()/1000);
  const header = { alg:"RS256", typ:"JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9*60, // 9 minutos
    iss: appId
  };
  const enc = (o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = enc(header)+"."+enc(payload);
  const sign = crypto.createSign("RSA-SHA256").update(data).end().sign(privateKeyPem, "base64url");
  return data+"."+sign;
}

async function getInstallationToken(){
  // 1) Si hay GITHUB_TOKEN (PAT o token de app ya generado), usarlo
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN.trim();
  }
  // 2) GitHub App: generar token de instalación
  const appId = process.env.GH_APP_ID;
  const instId = process.env.GH_INSTALLATION_ID;
  const keyPem  = process.env.GH_PRIVATE_KEY ? process.env.GH_PRIVATE_KEY
                : b64ToPem(process.env.GH_PRIVATE_KEY_B64 || "");
  if (!appId || !instId || !keyPem) {
    throw new Error("Missing GitHub App env (GH_APP_ID / GH_INSTALLATION_ID / GH_PRIVATE_KEY(_B64))");
  }
  const jwt = buildAppJWT(appId, keyPem);
  const url = `https://api.github.com/app/installations/${instId}/access_tokens`;
  const r = await fetch(url, {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${jwt}`,
      "Accept":"application/vnd.github+json",
      "Content-Type":"application/json"
    },
    body: "{}"
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) {
    throw new Error(`GitHub App token error (${r.status}): ${j?.message || "Unknown"}`);
  }
  return j.token;
}

// ==== multipart parse ====
function parseBoundary(ct) {
  const m = /boundary=(.*)$/i.exec(ct || "");
  return m && m[1];
}
async function parseMultipart(event) {
  const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
  const boundary = parseBoundary(ct);
  if (!boundary) throw new Error("Missing multipart boundary");

  const buf = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  const b = Buffer.from("--" + boundary);
  const parts = [];
  let i = buf.indexOf(b);
  while (i !== -1) {
    const j = buf.indexOf(b, i + b.length);
    if (j === -1) break;
    const chunk = buf.slice(i + b.length + 2, j - 2);
    parts.push(chunk);
    i = j;
  }

  for (const p of parts) {
    const sep = p.indexOf(Buffer.from("\r\n\r\n"));
    if (sep === -1) continue;
    const head = p.slice(0, sep).toString("utf8");
    const body = p.slice(sep + 4);
    if (/name="file"/i.test(head)) {
      const filename = /filename="([^"]+)"/i.exec(head)?.[1] || "upload.bin";
      const contentType = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || "application/octet-stream";
      return { filename, contentType, bytes: body };
    }
  }
  throw new Error("No 'file' field found");
}

function slug(name) {
  return name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9._-]+/g,"-")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
    .toLowerCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return res(200, { ok:true });
  if (event.httpMethod !== "POST")  return res(405, { ok:false, error:"Method Not Allowed" });

  // Auth del panel
  const auth = checkSaveToken(event);
  if (!auth.ok) return res(401, { ok:false, error:auth.error });

  try{
    const owner  = process.env.GH_OWNER || process.env.GITHUB_OWNER;
    const repo   = process.env.GH_REPO  || process.env.GITHUB_REPO;
    const branch = process.env.GH_BRANCH || process.env.GITHUB_DEFAULT_BRANCH || "main";
    if (!owner || !repo) return res(500, { ok:false, error:"Missing GH_OWNER/GH_REPO env" });

    // Token para GitHub (App o PAT)
    const ghToken = await getInstallationToken();

    const { filename, contentType, bytes } = await parseMultipart(event);
    if (!/^image\//i.test(contentType)) return res(400, { ok:false, error:"Not an image" });

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm   = String(now.getUTCMonth()+1).padStart(2,"0");
    const clean = slug(filename);
    const path = `assets/uploads/${yyyy}/${mm}/${Date.now()}_${clean}`;

    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const put = await fetch(api, {
      method:"PUT",
      headers:{
        "Authorization": `Bearer ${ghToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        message: `panel: upload ${clean}`,
        content: bytes.toString("base64"),
        branch
      })
    });
    const data = await put.json().catch(()=>({}));
    if (!put.ok) return res(put.status, { ok:false, error:data?.message || "GitHub error" });

    const commitSha = data?.commit?.sha;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${path}`;
    return res(200, { ok:true, url, path, commitSha });
  }catch(e){
    return res(500, { ok:false, error: e.message });
  }
};
