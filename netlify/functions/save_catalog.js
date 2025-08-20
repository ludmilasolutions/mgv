// netlify/functions/save_catalog.js
// Versión con mensajes de error detallados para depurar 500.
// No requiere dependencias externas (usa fetch nativo).

function json(obj){ return JSON.stringify(obj); }

async function getSha(api, token){
  const r = await fetch(api, { headers: { "Authorization": `Bearer ${token}`, "Accept":"application/vnd.github+json" } });
  if (r.status === 404) return null;
  const j = await r.json().catch(()=>null);
  return j && j.sha ? j.sha : null;
}

async function putFile(path, contentObj, token, owner, repo, branch, message){
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const sha = await getSha(api, token);
  const body = {
    message,
    content: Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64"),
    branch,
    ...(sha ? { sha } : {})
  };
  const resp = await fetch(api, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept":"application/vnd.github+json"
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) {
    throw new Error(`[GitHub ${resp.status}] ${data?.message || "Unknown"} | path=${path}`);
  }
  return data?.commit?.sha || null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const owner  = process.env.GITHUB_OWNER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
    const tokHdr = event.headers.authorization || event.headers.Authorization || "";
    const token  = (tokHdr.startsWith("Bearer ") ? tokHdr.slice(7) : "") || process.env.GITHUB_TOKEN;

    if (!owner || !repo) {
      return { statusCode: 500, body: json({ ok:false, where:"env", error:"Missing GITHUB_OWNER / GITHUB_REPO" }) };
    }
    if (!token) {
      return { statusCode: 500, body: json({ ok:false, where:"auth", error:"Missing token. Provide Authorization: Bearer <PAT> or set GITHUB_TOKEN." }) };
    }

    let payload={};
    try{ payload = JSON.parse(event.body||"{}"); }catch(e){
      return { statusCode: 400, body: json({ ok:false, where:"parse", error:"Invalid JSON body" }) };
    }

    const productos = Array.isArray(payload.productos) ? payload.productos : [];
    const banners   = Array.isArray(payload.banners) ? payload.banners : [];
    const config    = (payload.config && typeof payload.config === "object") ? payload.config : {};

    const ts = new Date().toISOString();
    const commits = [];
    commits.push(await putFile("data/productos.json", productos, token, owner, repo, branch, `panel: update productos ${ts}`));
    commits.push(await putFile("data/banners.json",   banners,   token, owner, repo, branch, `panel: update banners ${ts}`));
    commits.push(await putFile("data/config.json",    config,    token, owner, repo, branch, `panel: update config ${ts}`));

    return { statusCode: 200, body: json({ ok:true, commits, branch }) };
  } catch (e) {
    return { statusCode: 500, body: json({ ok:false, error: e.message }) };
  }
};
