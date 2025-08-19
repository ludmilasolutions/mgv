import { createSign, createPrivateKey } from "node:crypto";

function b64urlFromBuffer(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlFromString(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function resolvePrivateKey() {
  const b64 = process.env.GH_PRIVATE_KEY_B64;
  if (b64) {
    try { return Buffer.from(b64, "base64").toString("utf8"); } catch {}
  }
  const raw = process.env.GH_PRIVATE_KEY || "";
  return raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const auth = url.searchParams.get("auth");
    if (!auth || auth !== (process.env.SAVE_TOKEN || "")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const present = {
      GH_APP_ID: !!process.env.GH_APP_ID,
      GH_INSTALLATION_ID: !!process.env.GH_INSTALLATION_ID,
      GH_OWNER: !!process.env.GH_OWNER,
      GH_REPO: !!process.env.GH_REPO,
      GH_BRANCH: !!process.env.GH_BRANCH,
      PANEL_ORIGIN: !!process.env.PANEL_ORIGIN,
      SAVE_TOKEN: !!process.env.SAVE_TOKEN,
      GH_PRIVATE_KEY_len: (process.env.GH_PRIVATE_KEY || "").length,
      GH_PRIVATE_KEY_B64_len: (process.env.GH_PRIVATE_KEY_B64 || "").length,
    };

    // Intentar firmar JWT
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iat: now - 60, exp: now + 540, iss: process.env.GH_APP_ID };
    const unsigned = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(payload))}`;

    const pemMaybe = resolvePrivateKey();
    let pemForSign = pemMaybe;
    let signErr = null;
    try {
      const keyObj = createPrivateKey({ key: pemMaybe, format: "pem" });
      pemForSign = keyObj.export({ type: "pkcs8", format: "pem" });
    } catch (e) {
      // ignore
    }
    let jwt = null;
    try {
      const signer = createSign("RSA-SHA256");
      signer.update(unsigned);
      const sig = signer.sign(pemForSign);
      jwt = `${unsigned}.${b64urlFromBuffer(sig)}`;
    } catch (e) {
      signErr = String(e?.message || e);
    }

    let installStatus = null;
    let installBody = null;
    if (jwt) {
      const r = await fetch(`https://api.github.com/app/installations/${process.env.GH_INSTALLATION_ID}/access_tokens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json", "User-Agent": "mgv-editor/debug" },
      });
      installStatus = r.status;
      try { installBody = await r.json(); } catch {}
    }

    return json({
      present,
      jwt_created: !!jwt,
      sign_error: signErr,
      installation_token_status: installStatus,
      installation_token_body: installBody,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
};
