(async function(){
  const $ = s => document.querySelector(s);

  const serverCfg = await fetch('data/config.json').then(r=>r.json()).catch(()=>({}));
  const localOverride = JSON.parse(localStorage.getItem('mgv_config_override')||'null') || {};
  const cfg = deepMerge(serverCfg, localOverride);

  $('#shippingPrice').value = Number(cfg?.shipping?.price || 0);

  $('#saveLocal').onclick = ()=>{
    const n = Math.max(0, Number($('#shippingPrice').value||0));
    const override = deepMerge(localOverride, { shipping: { price: n } });
    localStorage.setItem('mgv_config_override', JSON.stringify(override));
    $('#status').textContent = 'Guardado en este navegador. Abrí/recargá la tienda para ver el cambio.';
  };

  $('#download').onclick = ()=>{
    const n = Math.max(0, Number($('#shippingPrice').value||0));
    const finalCfg = deepMerge(serverCfg, { shipping: { price: n } });
    const blob = new Blob([JSON.stringify(finalCfg, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    $('#status').textContent = 'Descargado config.json. Subilo a /data/config.json en tu deploy.';
  };

  function deepMerge(base, extra){
    if(Array.isArray(base) || Array.isArray(extra)) return extra ?? base;
    const out = {...(base||{})};
    for(const k of Object.keys(extra||{})){
      const v = extra[k];
      out[k] = (v && typeof v==='object' && !Array.isArray(v))
        ? deepMerge(out[k], v)
        : v;
    }
    return out;
  }
})();