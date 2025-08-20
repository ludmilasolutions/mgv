// functions/upload-image.js
// Subida de imágenes con auth por SAVE_TOKEN (igual que save_catalog).
// No usa dependencias externas (fetch nativo).
// Requiere env: SAVE_TOKEN, GITHUB_OWNER, GITHUB_REPO, (opcional) GITHUB_DEFAULT_BRANCH, GITHUB_TOKEN.

function response(status, bodyObj, extraHeaders={}){
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders
    },
    body: JSON.stringify(bodyObj)
  };
}

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
    const chunk = buf.slice(i + b.length + 2, j - 2); // skip \r\n
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
  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
  }
  if (event.httpMethod !== "POST") {
    return response(405, { ok:false, error:"Method Not Allowed" });
  }

  try{
    // --- Auth con SAVE_TOKEN ---
    const saveToken = process.env.SAVE_TOKEN || "";
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!saveToken || bearer !== saveToken) {
      return response(401, { ok:false, error:"unauthorized" });
    }

    const owner  = process.env.GITHUB_OWNER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
    const gitTok = process.env.GITHUB_TOKEN; // PAT o token de app (ya resuelto)
    if (!owner || !repo || !gitTok) {
      return response(500, { ok:false, error:"Missing GitHub env" });
    }

    const { filename, contentType, bytes } = await parseMultipart(event);
    if (!/^image\//i.test(contentType)) {
      return response(400, { ok:false, error:"Not an image" });
    }

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm   = String(now.getUTCMonth()+1).padStart(2,"0");
    const clean = slug(filename);
    const path = `assets/uploads/${yyyy}/${mm}/${Date.now()}_${clean}`;

    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const gh = await fetch(api, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${gitTok}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: `panel: upload ${clean}`,
        content: bytes.toString("base64"),
        branch
      })
    });
    const data = await gh.json().catch(()=>({}));
    if (!gh.ok) {
      return response(gh.status, { ok:false, error: data?.message || "GitHub error" });
    }
    const commitSha = data?.commit?.sha;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${path}`;
    return response(200, { ok:true, url, path, commitSha });
  }catch(e){
    return response(500, { ok:false, error: e.message });
  }
};
