// netlify/functions/upload-image.js
// Ruta: /.netlify/functions/upload-image
// Requiere env vars en Netlify:
//   GITHUB_OWNER, GITHUB_REPO, GITHUB_DEFAULT_BRANCH (p.ej. "main"), GITHUB_TOKEN
// Opcional: MAX_BYTES (default 6000000)

const crypto = require("crypto");

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
    const part = bodyBuffer.slice(start + boundaryBuf.length + 2, end - 2); // salteo \r\n
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

function slugifyFilename(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const MAX_BYTES = parseInt(process.env.MAX_BYTES || "6000000", 10);
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: "Missing GitHub env" }) };
    }

    const { filename, contentType, bytes } = await parseMultipart(event);

    if (!/^image\//i.test(contentType)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Not an image" }) };
    }
    if (bytes.length > MAX_BYTES) {
      return { statusCode: 413, body: JSON.stringify({ ok: false, error: "File too large" }) };
    }

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const clean = slugifyFilename(filename);
    const path = `assets/uploads/${yyyy}/${mm}/${Date.now()}_${clean}`;

    const b64 = bytes.toString("base64");
    const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

    const resp = await fetch(api, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "mgv-uploader",
        "Accept": "application/vnd.github+json"
      },
      body: JSON.stringify({
        message: `feat(panel): upload image ${clean}`,
        content: b64,
        branch
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ ok: false, error: data?.message || "GitHub error" }) };
    }

    const commitSha = data?.commit?.sha;
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commitSha}/${path}`;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, url, path, commitSha })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
