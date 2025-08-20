
/** Minimal diagnostics to see env and JWT creation */
const crypto = require("crypto");
const ok = (s,b)=>({statusCode:s,headers:{'content-type':'application/json'},body:JSON.stringify(b,null,2)});
const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
exports.handler = async () => {
  const present = {
    GH_APP_ID: !!process.env.GH_APP_ID,
    GH_INSTALLATION_ID: !!process.env.GH_INSTALLATION_ID,
    GH_OWNER: !!process.env.GH_OWNER,
    GH_REPO: !!process.env.GH_REPO,
    GH_BRANCH: !!process.env.GH_BRANCH,
    PANEL_ORIGIN: !!process.env.PANEL_ORIGIN,
    SAVE_TOKEN: !!process.env.SAVE_TOKEN,
    GH_PRIVATE_KEY_len: process.env.GH_PRIVATE_KEY ? process.env.GH_PRIVATE_KEY.length : 0,
    GH_PRIVATE_KEY_B64_len: process.env.GH_PRIVATE_KEY_B64 ? process.env.GH_PRIVATE_KEY_B64.length : 0,
  };
  let jwt_created=false, sign_error=null, installation_token_status=null, installation_token_body=null;
  try{
    const pem = process.env.GH_PRIVATE_KEY || (process.env.GH_PRIVATE_KEY_B64? Buffer.from(process.env.GH_PRIVATE_KEY_B64,'base64').toString('utf8'):null);
    if(!pem) throw new Error("no pem");
    const now = Math.floor(Date.now()/1000);
    const header = {alg:"RS256",typ:"JWT"};
    const payload = {iat: now-30, exp: now+540, iss: process.env.GH_APP_ID};
    const signingInput = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingInput);
    const signature = signer.sign(pem);
    const appJWT = signingInput + "." + signature.toString('base64url');
    jwt_created = true;

    const url = `https://api.github.com/app/installations/${process.env.GH_INSTALLATION_ID}/access_tokens`;
    const r = await fetch(url, {method:"POST", headers:{
      "accept":"application/vnd.github+json", "user-agent":"mgv-app/1.0", authorization:`Bearer ${appJWT}`
    }});
    installation_token_status = r.status;
    try{ installation_token_body = await r.json(); }catch{}
  }catch(e){ sign_error = String(e.message||e); }
  return ok(200,{ present, jwt_created, sign_error, installation_token_status, installation_token_body });
};
