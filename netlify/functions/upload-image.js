// netlify/functions/upload-image.js
// Upload product images to GitHub repo via Netlify Function (securely uses PAT)
// - Expects multipart/form-data with field 'file' and optional 'subdir'
// - Writes to repo path: assets/uploads/<YYYY>/<MM>/<slugified-name>
// - Returns: { ok: true, url, path, commitSha }
//
// Env vars required in Netlify settings:
//   GITHUB_OWNER, GITHUB_REPO, GITHUB_DEFAULT_BRANCH (e.g. "main"), GITHUB_TOKEN
//
// Optional:
//   MAX_BYTES (default 6_000_000)  ~6 MB
//
// Note: You can add SHARP optimization later if you want (commented below).

import { Octokit } from "@octokit/rest";

export const config = {
  path: "/api/upload-image",
};

function parseBoundary(ct) {
  const m = /boundary=(.*)$/i.exec(ct || "");
  return m && m[1];
}

// Very light multipart parser (for a single file part). Good enough for our panel.
async function parseMultipart(event) {
  const boundary = parseBoundary(event.headers["content-type"] || event.headers["Content-Type"]);
  if (!boundary) throw new Error("Missing multipart boundary");

  const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  const boundaryBuf = Buffer.from("--" + boundary);
  const parts = [];
  let start = bodyBuffer.indexOf(boundaryBuf);
  while (start !== -1) {
    const end = bodyBuffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (end === -1) break;
    const part = bodyBuffer.slice(start + boundaryBuf.length + 2, end - 2); // skip \r\n
    parts.push(part);
    start = end;
  }

  // Find the part with name="file"
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

export async function handler(event) {
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
    if (bytes.length > MAX_BYTES) {
      return { statusCode: 413, body: JSON.stringify({ ok: false, error: "File too large" }) };
    }

    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

    const clean = slugifyFilename(filename);
    const path = `assets/uploads/${yyyy}/${mm}/${Date.now()}_${clean}`;

    // Optional: image type guard
    if (!/^image\//i.test(contentType)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Not an image" }) };
    }

    // If you want to add compression with sharp, uncomment below & add it to package.json
    // const sharp = await import("sharp");
    // const img = sharp.default(bytes);
    // const meta = await img.metadata();
    // let output = bytes;
    // if (meta.format === "jpeg" || meta.format === "jpg") {
    //   output = await img.jpeg({ quality: 82 }).toBuffer();
    // } else if (meta.format === "png") {
    //   output = await img.png({ compressionLevel: 8 }).toBuffer();
    // } else if (meta.format === "webp") {
    //   output = await img.webp({ quality: 80 }).toBuffer();
    // }
    // const b64 = output.toString("base64");

    const b64 = Buffer.from(bytes).toString("base64");

    const octokit = new Octokit({ auth: token });
    const commit = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `feat(panel): upload image ${clean}`,
      content: b64,
      branch,
    });

    const sha = commit.data.commit.sha;
    // Raw URL pinned to commit
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, url, path, commitSha: sha }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
}
