// assets/js/fetch-raw-patch.js
// Reescribe los fetch() de /data/*.json para que lean desde raw.githubusercontent
// usando el SHA más reciente guardado por el panel en cookie/localStorage.
// No toca tu app.js: funciona como "shim" transparente.

(function(){
  const ENV = (window.ENV||{});
  const OWNER  = ENV.GH_OWNER  || "ludmilasolutions";
  const REPO   = ENV.GH_REPO   || "mgv";
  const BRANCH = ENV.GH_BRANCH || "main";

  function setLastSHA(sha){
    try{
      if(!sha) return;
      localStorage.setItem('mgv_last_sha', sha);
      document.cookie = 'mgvsha='+sha+';path=/;max-age='+(60*60*24*30);
    }catch(_){}
  }
  function getLastSHA(){
    try{
      const u = new URL(window.location.href);
      const qs = u.searchParams.get('sha');
      if(qs){ setLastSHA(qs); return qs; }
    }catch(_){}
    try{
      const ls = localStorage.getItem('mgv_last_sha');
      if(ls) return ls;
    }catch(_){}
    try{
      const m = document.cookie.match(/(?:^|;)\s*mgvsha=([^;]+)/);
      if(m) return m[1];
    }catch(_){}
    return null;
  }

  function rawBase(sha){
    return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha||BRANCH}/data`;
  }

  // Exponer helpers por si querés usarlos en app.js
  window.MGVData = {
    get sha(){ return getLastSHA(); },
    rawBase,
    dataUrl: (rel)=> rawBase(getLastSHA()) + '/' + String(rel||'').replace(/^\.?\/?data\//,'')
  };
  window.__MGV_SHA = getLastSHA();

  const isDataJson = (url)=>{
    try{
      const u = String(url);
      if (/^https?:/i.test(u)) return /\/data\/[^?]+\.(json)(\?|$)/i.test(u);
      return /^\.?\/?data\/[^?]+\.(json)(\?|$)/i.test(u);
    }catch(_){ return false; }
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    try{
      const url = (typeof input==='string') ? input : (input && input.url);
      if (url && isDataJson(url)){
        const rel = String(url).replace(/^https?:\/\/[^/]+\/?/,'').replace(/^\.?\/?/,''); // strip origin & leading ./
        const finalUrl = window.MGVData.dataUrl(rel) + (url.includes('?')?'&':'?') + 'ts=' + Date.now();
        const opts = Object.assign({}, init||{}, { cache:'no-store' });
        // Try remote first; if it fails, fallback to original URL (local /data/*.json)
return origFetch(finalUrl, opts).then(function(r){
  if(r && r.ok) return r;
  /* MGV FALLBACK LOCAL */
  return origFetch(input, init);
}).catch(function(){
  return origFetch(input, init);
});
      }
    }catch(_){}
    return origFetch(input, init);
  };
})();
