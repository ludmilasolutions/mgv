
/**
 * Netlify Function: save_catalog
 * Writes data/productos.json, data/banners.json, data/config.json to GitHub via GitHub App.
 * Env required:
 *  - SAVE_TOKEN (panel must send Bearer SAVE_TOKEN)
 *  - GH_APP_ID
 *  - GH_INSTALLATION_ID
 *  - GH_OWNER
 *  - GH_REPO
 *  - GH_BRANCH (default: main)
 *  - GH_PRIVATE_KEY  (PEM)  OR  GH_PRIVATE_KEY_B64 (base64 of PEM)
 */
const crypto = require("crypto");

const ok = (status, body) => ({ statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const err = (status, msg, extra={}) => ok(status, { error: msg, **extra });

function b64url(input) {
  const b = (Buffer.isBuffer(input) ? input : Buffer.from(input));
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
}

function signAppJWT(appId, pem) {
  const now = Math.floor(Date.now()/1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 30, exp: now + (9*60), iss: appId };
  const signingInput = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(pem);
  return signingInput + "." + b64url(signature);
}

async function ghFetch(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "accept": "application/vnd.github+json",
      "user-agent": "mgv-app/1.0",
      ...(init && init.headers ? init.headers : {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch(_) {}
  if (!res.ok) {
    const e = new Error(`GitHub ${res.status}: ${data && data.message ? data.message : text}`);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

async function getInstallationToken(appJWT, installationId) {
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;
  const data = await ghFetch(url, { method: "POST", headers: { authorization: `Bearer ${appJWT}` } });
  return data.token;
}

async function getShaIfExists(token, owner, repo, path, branch) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  try {
    const data = await ghFetch(url, { headers: { authorization: `token ${token}` } });
    return data && data.sha ? data.sha : null;
  } catch (e) {
    if (e.status === 404) return null; // new file
    throw e;
  }
}

async function putFile(token, owner, repo, branch, path, contentObj) {
  const content = Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64");
  const sha = await getShaIfExists(token, owner, repo, path, branch);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: `MGV: update ${path}`,
    content,
    branch,
    ...(sha ? { sha } : {}),
    committer: { name: "MGV Bot", email: "bot@mgv.local" }
  };
  const res = await ghFetch(url, { method: "PUT", headers: { authorization: `token ${token}` }, body: JSON.stringify(body) });
  return { path, sha: res && res.content ? res.content.sha : null, commit: res && res.commit ? (res.commit.sha || res.commit.html_url) : null };
}

exports.handler = async (event) => {
  try {
    // Auth from panel
    const auth = event.headers && event.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!process.env.SAVE_TOKEN || token !== process.env.SAVE_TOKEN) {
      return err(401, "Missing or invalid token");
    }

    // Body
    let payload = null;
    try { payload = JSON.parse(event.body || "{}"); } catch(_) {}
    if (!payload || !payload.productos || !payload.banners || !payload.config) {
      return err(400, "Invalid body; expected { productos, banners, config }");
    }

    // Env
    const APP_ID   = process.env.GH_APP_ID;
    const INSTALL  = process.env.GH_INSTALLATION_ID;
    const OWNER    = process.env.GH_OWNER;
    const REPO     = process.env.GH_REPO;
    const BRANCH   = process.env.GH_BRANCH || "main";
    const pem      = process.env.GH_PRIVATE_KEY || (process.env.GH_PRIVATE_KEY_B64 ? Buffer.from(process.env.GH_PRIVATE_KEY_B64, "base64").toString("utf8") : null);

    if (!APP_ID || !INSTALL || !OWNER || !REPO || !pem) {
      return err(500, "Missing GH env", { present: {
        GH_APP_ID: !!APP_ID, GH_INSTALLATION_ID: !!INSTALL, GH_OWNER: !!OWNER, GH_REPO: !!REPO, GH_PRIVATE_KEY: !!pem
      }});
    }

    // JWT & installation token
    const appJWT = signAppJWT(APP_ID, pem);
    const instToken = await getInstallationToken(appJWT, INSTALL);

    // Write files (sequential to simplify)
    const results = [];
    results.push(await putFile(instToken, OWNER, REPO, BRANCH, "data/productos.json", payload.productos));
    results.push(await putFile(instToken, OWNER, REPO, BRANCH, "data/banners.json",   payload.banners));
    results.push(await putFile(instToken, OWNER, REPO, BRANCH, "data/config.json",    payload.config));

    return ok(200, { ok: true, results });
  } catch (e) {
    return err(500, e.message || "internal_error", { stack: e.stack, gh: e.data });
  }
};
