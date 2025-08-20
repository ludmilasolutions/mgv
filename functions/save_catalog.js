// functions/save_catalog.js
// Guarda productos.json, banners.json y config.json en /data del repo.
// Auth del panel: SAVE_TOKEN (Authorization: Bearer <SAVE_TOKEN>)
// Auth GitHub: GitHub App (GH_APP_ID, GH_INSTALLATION_ID, GH_PRIVATE_KEY[_B64])
//   o fallback GITHUB_TOKEN (PAT o token ya generado).
// No requiere dependencias externas.

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

function checkSaveToken(event){
  const must = (process.env.SAVE_TOKEN || "").trim();
  if (!must) return { ok:false, error:"Missing SAVE_TOKEN env" };
  const hdr = event.headers.authorization || event.headers.Authorization || "";
  const got = hdr.startsWith("Bearer ") ? hdr.slice(7) : hdr;
  if (got !== must) return { ok:false, error:"unauthorized" };
  return { ok:true };
}

function b64ToPem(b64){
  try { return Buffer.from(b64, "base64").toString("utf8"); } catch(_){ return ""; }
}
function buildAppJWT(appId, privateKeyPem){
  const now = Math.floor(Date.now()/1000);
  const header = { alg:"RS256", typ:"JWT" };
  const payload = { iat: now-60, exp: now+9*60, iss: appId };
  const enc = (o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = enc(header)+"."+enc(payload);
  const sign = crypto.createSign("RSA-SHA256").update(data).end().sign(privateKeyPem,"base64url");
  return data+"."+sign;
}
async function getInstallationToken(){
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const appId = process.env.GH_APP_ID;
  const instId = process.env.GH_INSTALLATION_ID;
  const keyPem = process.env.GH_PRIVATE_KEY ? process.env.GH_PRIVATE_KEY : b64ToPem(process.env.GH_PRIVATE_KEY_B64||"");
  if (!appId || !instId || !keyPem) throw new Error("Missing GitHub App env (GH_APP_ID/GH_INSTALLATION_ID/GH_PRIVATE_KEY(_B64))");
  const jwt = buildAppJWT(appId, keyPem);
  const url = `https://api.github.com/app/installations/${instId}/access_tokens`;
  const r = await fetch(url, { method:"POST", headers:{
    "Authorization": `Bearer ${jwt}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json"
  }, body:"{}" });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`GitHub App token error (${r.status}): ${j?.message || "Unknown"}`);
  return j.token;
}

async function getSha(api, token){
  const r = await fetch(api, { headers: {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  }});
  if (r.status === 404) return null;
  const j = await r.json().catch(()=>null);
  return (j && j.sha) ? j.sha : null;
}

async function putJson(path, dataObj, token, owner, repo, branch, message){
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const sha = await getSha(api, token);
  const body = {
    message,
    content: Buffer.from(JSON.stringify(dataObj, null, 2)).toString("base64"),
    branch,
    ...(sha ? { sha } : {})
  };
  const r = await fetch(api, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`[GitHub ${r.status}] ${j?.message || "Unknown"} | path=${path}`);
  return j?.commit?.sha || null;
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

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch(_){
      return res(400, { ok:false, error:"Invalid JSON body" });
    }
    const productos = Array.isArray(payload.productos)? payload.productos : [];
    const banners   = Array.isArray(payload.banners)?   payload.banners   : [];
    const config    = (payload.config && typeof payload.config === "object") ? payload.config : {};

    // Token GitHub
    const ghToken = await getInstallationToken();

    const ts = new Date().toISOString();
    const commits = [];
    commits.push(await putJson("data/productos.json", productos, ghToken, owner, repo, branch, `panel: update productos ${ts}`));
    commits.push(await putJson("data/banners.json",   banners,   ghToken, owner, repo, branch, `panel: update banners ${ts}`));
    commits.push(await putJson("data/config.json",    config,    ghToken, owner, repo, branch, `panel: update config ${ts}`));

    return res(200, { ok:true, commits, branch });
  }catch(e){
    return res(500, { ok:false, error: e.message });
  }
};
