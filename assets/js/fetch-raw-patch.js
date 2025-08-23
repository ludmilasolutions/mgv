// fetch-raw-patch.js
// Reescribe peticiones a data/*.json para que salgan de GitHub RAW.
// Usa solo ?sha= de la URL (ignora cookies/localStorage).
// Además, limpia el cookie mgvsha para evitar pins viejos.

(function(){
  try{
    document.cookie = 'mgvsha=; Max-Age=0; path=/';
  }catch(_){}

  const ENV = (window.ENV||{});
  const OWNER  = ENV.GH_OWNER  || 'ludmilasolutions';
  const REPO   = ENV.GH_REPO   || 'mgv';
  const BRANCH = ENV.GH_BRANCH || 'main';

  function getShaFromUrl(){
    try{
      const u = new URL(location.href);
      const s = u.searchParams.get('sha');
      return s || null;
    }catch(_){ return null; }
  }

  function toRawDataUrl(path){
    const sha = getShaFromUrl() || BRANCH;
    const clean = String(path||'').replace(/^\/+/,''); // quita / inicial
    const full = clean.startsWith('data/') ? clean : ('data/' + clean);
    return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/${full}`;
  }

  const origFetch = window.fetch;
  window.fetch = function(input, init){
    try{
      let url = (typeof input === 'string') ? input : (input && input.url) || '';
      const isAbsolute = /^https?:\/\//i.test(url);
      const isData = !isAbsolute && /^data\//.test(url) || (!isAbsolute && /(^|\/)data\/.+\.json(\?|$)/i.test(url)) || (typeof input === 'string' && /^data\/.+\.json(\?|$)/i.test(input));

      if(isData){
        const raw = toRawDataUrl(url);
        const ts = Date.now();
        const final = raw + (raw.includes('?') ? '&' : '?') + 'ts=' + ts;
        if(typeof input === 'string'){
          return origFetch(final, init);
        }else{
          const req = new Request(final, input);
          return origFetch(req, init);
        }
      }
    }catch(_){/* si algo falla, seguimos con fetch normal */}
    return origFetch(input, init);
  };
})();