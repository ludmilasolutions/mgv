// netlify/functions/save_catalog.js
// Guarda los JSON (productos/banners/config) en /data del repo. Sin dependencias externas.
// Requiere env vars: GITHUB_OWNER, GITHUB_REPO, GITHUB_DEFAULT_BRANCH (opcional), GITHUB_TOKEN
// También acepta token desde header Authorization: Bearer XXX (prioridad sobre env).

async function getSha(api, token) {
  const r = await fetch(api, { headers: { "Authorization": `Bearer ${token}`, "Accept":"application/vnd.github+json" } });
  if (r.status === 404) return null;
  const j = await r.json();
  return j && j.sha ? j.sha : null;
}

async function putFile(path, contentObj, token, owner, repo, branch, message){
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const sha = await getSha(api, token);
  const resp = await fetch(api, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept":"application/vnd.github+json"
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64"),
      branch,
      ...(sha ? { sha } : {})
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || "GitHub error");
  return data?.commit?.sha;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
    const tokHeader = event.headers.authorization || event.headers.Authorization || "";
    const token = (tokHeader.startsWith("Bearer ") ? tokHeader.slice(7) : "") || process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:"Missing GitHub env" }) };
    }

    const bodyTxt = event.body || "{}";
    let payload = {};
    try { payload = JSON.parse(bodyTxt); } catch(_){}
    const { productos=[], banners=[], config={} } = payload;

    // Guardamos cada archivo por separado bajo /data
    const commits = [];
    const stamp = new Date().toISOString();
    commits.push(await putFile("data/productos.json", productos, token, owner, repo, branch, `chore(panel): update productos ${stamp}`));
    commits.push(await putFile("data/banners.json",   banners,   token, owner, repo, branch, `chore(panel): update banners ${stamp}`));
    commits.push(await putFile("data/config.json",    config,    token, owner, repo, branch, `chore(panel): update config ${stamp}`));

    return { statusCode: 200, body: JSON.stringify({ ok:true, commits }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
