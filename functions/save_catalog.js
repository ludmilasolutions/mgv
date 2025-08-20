// functions/save_catalog.js (v6) – commit a GitHub + trigger Netlify build hook
const GITHUB_API = "https://api.github.com";

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "OPTIONS, POST"
    },
    body: JSON.stringify(body, null, 2)
  };
}

const jwt = require('jsonwebtoken');

const b64dec = (s) => Buffer.from(s, "base64").toString("utf8");
const getPK = () => process.env.GH_PRIVATE_KEY_B64 ? b64dec(process.env.GH_PRIVATE_KEY_B64) : process.env.GH_PRIVATE_KEY;
function makeAppJWT(){
  const now = Math.floor(Date.now()/1000);
  return jwt.sign({ iat: now-60, exp: now+9*60, iss: process.env.GH_APP_ID }, getPK(), { algorithm:"RS256" });
}

async function ghInstallationToken(){
  const appJwt = makeAppJWT();
  const r = await fetch(`${GITHUB_API}/app/installations/${process.env.GH_INSTALLATION_ID}/access_tokens`, {
    method: "POST",
    headers: { "accept":"application/vnd.github+json", "authorization":`Bearer ${appJwt}`, "user-agent":"mgv-app/1.0" }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`installation token ${r.status}: ${text}`);
  return JSON.parse(text).token;
}

async function ghGet(path, token, qs=""){
  const url = `${GITHUB_API}/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${encodeURIComponent(path)}${qs}`;
  return fetch(url, { headers: { "accept":"application/vnd.github+json", "authorization":`Bearer ${token}`, "user-agent":"mgv-app/1.0" } });
}

async function getCurrentSha(path, token){
  const r = await ghGet(path, token, `?ref=${encodeURIComponent(process.env.GH_BRANCH)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`get sha ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.sha || null;
}

async function putFile({ path, message, jsonOrString }){
  const token = await ghInstallationToken();
  const contentStr = typeof jsonOrString === "string" ? jsonOrString : JSON.stringify(jsonOrString, null, 2);
  const sha = await getCurrentSha(path, token);
  const body = {
    message,
    branch: process.env.GH_BRANCH,
    content: Buffer.from(contentStr, "utf8").toString("base64"),
    ...(sha ? { sha } : {})
  };
  const url = `${GITHUB_API}/repos/${process.env.GH_OWNER}/${process.env.GH_REPO}/contents/${encodeURIComponent(path)}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { "accept":"application/vnd.github+json", "authorization":`Bearer ${token}`, "content-type":"application/json", "user-agent":"mgv-app/1.0" },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`putFile ${path} ${r.status}: ${text}`);
  return JSON.parse(text);
}

async function triggerBuildHook() {
  const hook = process.env.NETLIFY_BUILD_HOOK || process.env.BUILD_HOOK_URL;
  if (!hook) return { triggered:false, reason:"no BUILD_HOOK env" };
  try {
    const r = await fetch(hook, { method:"POST" });
    const ok = r.ok;
    const body = await r.text();
    return { triggered: ok, status: r.status, body };
  } catch (e) {
    return { triggered:false, error: e.message };
  }
}

exports.handler = async (event) => {
  try{
    if (event.httpMethod === "OPTIONS") return json({ ok:true });
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const tokenClient = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!tokenClient || tokenClient !== process.env.SAVE_TOKEN) return { statusCode:401, body:"unauthorized" };

    const params = event.queryStringParameters || {};
    if (params && params.debug === "1"){
      return json({ env_present: {
        GH_APP_ID: !!process.env.GH_APP_ID,
        GH_INSTALLATION_ID: !!process.env.GH_INSTALLATION_ID,
        GH_OWNER: !!process.env.GH_OWNER,
        GH_REPO: !!process.env.GH_REPO,
        GH_BRANCH: !!process.env.GH_BRANCH,
        SAVE_TOKEN: !!process.env.SAVE_TOKEN,
        GH_PRIVATE_KEY_B64_len: (process.env.GH_PRIVATE_KEY_B64||"").length,
        GH_CONTENT_BASE: (process.env.GH_CONTENT_BASE || "data"),
        NETLIFY_BUILD_HOOK: !!(process.env.NETLIFY_BUILD_HOOK || process.env.BUILD_HOOK_URL)
      }});
    }

    const base = (process.env.GH_CONTENT_BASE || "data").replace(/^\/+|\/+$/g,"");
    const body = JSON.parse(event.body || "{}");
    const { productos, banners, config } = body;
    const results = [];

    if (Array.isArray(productos)) {
      results.push(await putFile({ path: `${base}/productos.json`, message: "panel: update productos.json", jsonOrString: productos }));
    }
    if (Array.isArray(banners)) {
      results.push(await putFile({ path: `${base}/banners.json`, message: "panel: update banners.json", jsonOrString: banners }));
    }
    if (config && typeof config === "object") {
      results.push(await putFile({ path: `${base}/config.json`, message: "panel: update config.json", jsonOrString: config }));
    }

    const hook = await triggerBuildHook();

    return json({ done:true, commits: results.map(r => r?.commit?.sha || null), base, build_hook: hook });
  }catch(e){
    console.error("save_catalog error", e);
    return json({ error:"save_catalog failed", message: e.message, stack: e.stack }, 502);
  }
};
