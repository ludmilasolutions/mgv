// netlify/functions/upload-image.js
// Función CJS sin dependencias externas. Usa fetch global (Node 18+).
// Sube una imagen al repo usando la API de GitHub.
// Requiere env vars: GITHUB_OWNER, GITHUB_REPO, GITHUB_DEFAULT_BRANCH (opcional), GITHUB_TOKEN
// También acepta token desde header Authorization: Bearer XXX (prioridad sobre env).

function parseBoundary(ct) {
  const m = /boundary=(.*)$/i.exec(ct || "");
  return m && m[1];
}
async function parseMultipart(event) {
  const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
  const boundary = parseBoundary(ct);
  if (!boundary) throw new Error("Missing multipart boundary");

  const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  const boundaryBuf = Buffer.from("--" + boundary);
  const parts = [];
  let start = bodyBuffer.indexOf(boundaryBuf);
  while (start !== -1) {
    const end = bodyBuffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (end === -1) break;
    const part = bodyBuffer.slice(start + boundaryBuf.length + 2, end - 2); // \r\n
    parts.push(part);
    start = end;
  }

  for (const p of parts) {
    const sep = p.indexOf(Buffer.from("\r\n\r\n"));
    if (sep === -1) continue;
    const head = p.slice(0, sep).toString("utf8");
    const body = p.slice(sep + 4);
    if (/name="file"/i.test(head)) {
      const fnm = /filename="([^"]+)"/i.exec(head)?.[1] || "upload.bin";
      const ctype = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || "application/octet-stream";
      return { filename: fnm, contentType: ctype, bytes: body };
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
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
    const tokHeader = event.headers.authorization || event.headers.Authorization || "";
    const token = (tokHeader.startsWith("Bearer ") ? tokHeader.slice(7) : "") || process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return { statusCode: 500, body: JSON.stringify({ ok:false, error:"Missing GitHub env" }) };
    }

    const { filename, contentType, bytes } = await parseMultipart(event);
    if (!/^image\//i.test(contentType)) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Not an image" }) };
    }

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth()+1).padStart(2,"0");
    const clean = slug(filename);
    const path = `assets/uploads/${yyyy}/${mm}/${Date.now()}_${clean}`;

    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const resp = await fetch(api, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: `feat(panel): upload image ${clean}`,
        content: bytes.toString("base64"),
        branch
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ ok:false, error: data?.message || "GitHub error" }) };
    }
    const commitSha = data?.commit?.sha;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${path}`;

    return { statusCode: 200, body: JSON.stringify({ ok:true, url, path, commitSha }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};
