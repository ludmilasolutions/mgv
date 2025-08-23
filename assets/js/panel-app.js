/* Panel MGV – lógica principal movida a archivo externo para evitar errores de parseo inline */
(function(){
  'use strict';

  const GH_OWNER  = "ludmilasolutions";
  const GH_REPO   = "mgv";
  const GH_BRANCH = "main";
  function rawBase(sha){ return `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${sha||GH_BRANCH}/data`; }

  function setLastSHA(sha){
    try{ if(!sha) return; localStorage.setItem('mgv_last_sha', sha);
      document.cookie='mgvsha='+sha+';path=/;max-age='+(60*60*24*30);
    }catch(_){}
  }
  // PANEL: por defecto usa siempre la rama main; solo respeta ?sha= en la URL
  function getLastSHA(){
    try{ const u=new URL(location.href); const qs=u.searchParams.get('sha'); if(qs){ setLastSHA(qs); return qs; } }catch(_){}
    return null;
  }

  // helpers
  const SALT = "mgv~panel#2025";
  const HASHED = "b950ddfbf98b1a566a9445e569d2e31e894a8026cbf0eb447846b254c820ce23";
  async function sha256(str){const buf=new TextEncoder().encode(str); const hash=await crypto.subtle.digest('SHA-256',buf); return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  function show(id, yes){ document.getElementById(id).classList.toggle('hidden', !yes) }

  function withVersion(u, v){
    if(!u) return u;
    const sep = u.includes('?') ? '&' : '?';
    return `${u}${sep}v=${encodeURIComponent(v || Date.now())}`;
  }
  function toRawGitUrl(u, commitSha){
    try{
      if(!u) return u;
      if(/^https?:\/\//i.test(u) && u.includes('github.com') && u.includes('/blob/')){
        return u.replace('https://github.com/','https://raw.githubusercontent.com/').replace('/blob/','/');
      }
      if(/^https?:\/\//i.test(u)) return u;
      const sha = commitSha || getLastSHA() || GH_BRANCH;
      const path = String(u).replace(/^\//,'');
      return `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${sha}/${path}`;
    }catch(e){ return u; }
  }

  const sess = {
    get logged(){ return localStorage.getItem("mgv_logged")==="1" },
    login(){ localStorage.setItem("mgv_logged","1"); },
    logout(){ localStorage.removeItem("mgv_logged"); }
  };

  async function doLogin(){
    const u=document.getElementById("user").value.trim();
    const p=document.getElementById("pass").value;
    if(u!=="admin"){ alert("Usuario inválido"); return; }
    const h=await sha256(SALT+p);
    if(h!==HASHED){ alert("Contraseña incorrecta"); return; }
    sess.login(); boot();
  }

  function boot(){
    if(!localStorage.getItem("mgv_apiBase")) localStorage.setItem("mgv_apiBase","/api");
    show("loginSec", !sess.logged);
    show("appSec",  sess.logged);
    if(sess.logged){
      const _sha=getLastSHA();
      loadTables(_sha);
      hydrateConfigUI();
      updateApiStatus();
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById("loginBtn").onclick=doLogin;
    document.getElementById("logoutBtn").onclick=()=>{ sess.logout(); boot(); };
    document.getElementById("resetPin").onclick=()=>{
      try{
        document.cookie='mgvsha=;path=/;max-age=0';
        localStorage.removeItem('mgv_last_sha');
        alert('Cache del commit reseteada. Se usará la rama main.'); location.reload();
      }catch(e){ alert(e.message); }
    };

    const tabs={productosSec:"tabProductos",bannersSec:"tabBanners",configSec:"tabConfig"};
    Object.entries(tabs).forEach(([sec,btn])=>{
      document.getElementById(btn).onclick=()=>{ Object.keys(tabs).forEach(id=>show(id,id===sec)); };
    });

    boot();
  });

  let productos=[], banners=[], config=null;

  async function fetchJsonWithRetry(url, tries=6, wait=700){
    for(let i=0;i<tries;i++){
      try{ const r=await fetch(url,{cache:"no-store"}); if(r.ok){ return await r.json(); } }
      catch(_){}
      await new Promise(res=>setTimeout(res,wait));
    }
    const r=await fetch(url,{cache:"no-store"});
    return r.json();
  }

  async function loadTables(sha){
    const BASE = rawBase(sha || window.__MGV_PENDING_SHA);
    const ts = Date.now();
    productos = await fetchJsonWithRetry(`${BASE}/productos.json?ts=${ts}`);
    banners   = await fetchJsonWithRetry(`${BASE}/banners.json?ts=${ts}`);
    config    = await fetchJsonWithRetry(`${BASE}/config.json?ts=${ts}`);
    window.__MGV_PENDING_SHA = null;
    renderProductos();
    renderBanners();
    hydrateConfigUI();
  }

  async function uploadImageFile(file){
    if(!file) return { ok:false, error:"No file" };
    const fd=new FormData();
    fd.append("file",file,file.name);
    const api=(localStorage.getItem("mgv_apiBase")||"/api")+"/upload-image";
    const tok=(localStorage.getItem("mgv_saveToken")||"").trim();
    const headers = tok ? { "Authorization":"Bearer "+tok } : {};
    let resp;
    try{
      resp=await fetch(api,{ method:"POST", headers, body:fd });
    }catch(e){
      return { ok:false, error:"No se pudo conectar: "+e.message };
    }
    if(resp.status===401 || resp.status===403){
      return { ok:false, error:"No autorizado. Configurá el Save Token en este dispositivo (Panel → Config)." };
    }
    try{ const j=await resp.json(); if(!resp.ok) return { ok:false, error:j.error||("Error "+resp.status) }; return j; }
    catch(_){ return { ok:false, error:"Respuesta inválida de la API" }; }
  }

  const toInt = v => {
    const n = parseInt(String(v||"").replace(/[^\d-]/g,""), 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  };

  function renderProductos(){
    const tbody=document.querySelector("#tablaProductos tbody");
    tbody.innerHTML="";
    productos.forEach(p=>{
      const precioInt = toInt(p.precio);
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td><input value="${p.nombre ?? ''}" data-f="nombre" data-id="${p.id}"/></td>
        <td>
          <input value="${precioInt}" type="number" step="1" min="0" inputmode="numeric" pattern="[0-9]*"
                 data-f="precio" data-id="${p.id}" />
        </td>
        <td><input value="${p.categoria ?? ''}" data-f="categoria" data-id="${p.id}"/></td>
        <td>
          <div class="td-img">
            <input class="url" value="${p.imagen ?? ''}" placeholder="https://…/img.jpg" data-f="imagen" data-id="${p.id}"/>
            <label class="img-upload">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Subir…</span>
              <input type="file" accept="image/*" data-file="${p.id}"/>
            </label>
            <img class="preview-thumb" src="${withVersion(p.imagen || '', Date.now())}" alt="Vista previa"/>
            <span class="muted" data-status="${p.id}"></span>
          </div>
        </td>
        <td class="td-actions"><button class="btn secondary" data-ed="${p.id}">Desc</button> <button class="btn danger" data-del="${p.id}">Borrar</button></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("input[type='number'][data-f='precio']").forEach(n=>{
      n.addEventListener('wheel', e=> e.preventDefault(), {passive:false});
    });

    tbody.querySelectorAll("input.url, td input[type='text'], td input[type='number']").forEach(inp=>{
      const handler=()=>{
        const id=inp.dataset.id, f=inp.dataset.f; if(!id||!f) return;
        const p=productos.find(x=>x.id===id); if(!p) return;
        if(f==="precio"){
          p[f] = toInt(inp.value);
          inp.value = p[f];
        }else{
          p[f]=inp.value;
          if(f==="imagen"){
            const row=inp.closest("tr"); const img=row?.querySelector("img.preview-thumb");
            const val=(inp.value||"").trim();
            if(img) img.src = withVersion(val, Date.now());
          }
        }
      };
      inp.addEventListener("input",handler);
      inp.addEventListener("change",handler);
    });

    tbody.querySelectorAll("[data-ed]").forEach(b=>{
      b.onclick=()=>{ const id=b.dataset.ed; const p=productos.find(x=>x.id===id); const d=prompt("Descripción",p.descripcion||""); if(d!==null) p.descripcion=d; };
    });
    tbody.querySelectorAll("[data-del]").forEach(b=>{
      b.onclick=()=>{ const id=b.dataset.del; if(confirm("¿Eliminar producto?")){ productos=productos.filter(x=>x.id!==id); renderProductos(); } };
    });
    document.getElementById("nuevoProd").onclick=()=>{
      const id="p"+Math.random().toString(36).slice(2,7);
      productos.unshift({id, nombre:"Nuevo producto", precio:0, categoria:"Librería", imagen:"", descripcion:""});
      renderProductos();
    };

    tbody.querySelectorAll("input[type=file][data-file]").forEach(fi=>{
      fi.addEventListener("change", async ()=>{
        const id=fi.dataset.file;
        const row=fi.closest("tr");
        const urlInp=row.querySelector("input.url[data-id='"+id+"']");
        const prev=row.querySelector("img.preview-thumb");
        const st=row.querySelector("[data-status='"+id+"']");
        const file=fi.files?.[0];
        fi.value="";
        if(!file) return;
        st.textContent="Subiendo imagen…";
        try{
          const res=await uploadImageFile(file);
          if(res.ok){
            const rawUrl = toRawGitUrl(res.url, res.commitSha);
            urlInp.value = rawUrl;
            if(prev) prev.src = withVersion(rawUrl, res.commitSha || Date.now());
            const p=productos.find(x=>x.id===id); if(p) p.imagen=rawUrl;
            st.textContent="Listo ✔";
            if(res.commitSha){ setLastSHA(res.commitSha); window.__MGV_PENDING_SHA=res.commitSha; }
          }else{
            st.textContent="Error: "+(res.error||"no se pudo subir");
          }
        }catch(e){ st.textContent="Error: "+e.message; }
      });
    });
  }

  function renderBanners(){
    const tbody=document.querySelector("#tablaBanners tbody");
    tbody.innerHTML="";
    banners.forEach(b=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td><input value="${b.titulo ?? ''}" data-f="titulo" data-id="${b.id}"/></td>
        <td><input value="${b.texto ?? ''}" data-f="texto" data-id="${b.id}"/></td>
        <td><input value="${b.color ?? '#111111'}" data-f="color" data-id="${b.id}"/></td>
        <td><input type="checkbox" ${b.activo!==false?'checked':''} data-f="activo" data-id="${b.id}"/></td>
        <td class="flex"><button class="btn danger" data-del="${b.id}">Borrar</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("input").forEach(inp=>{
      const handler=()=>{ const id=inp.dataset.id, f=inp.dataset.f; const b=banners.find(x=>x.id===id); if(!b) return; b[f]=(f==="activo")? inp.checked:inp.value; };
      inp.addEventListener("input",handler); inp.addEventListener("change",handler);
    });
    tbody.querySelectorAll("[data-del]").forEach(btn=>{
      btn.onclick=()=>{ const id=btn.dataset.del; if(confirm("¿Eliminar banner?")){ banners=banners.filter(x=>x.id!==id); renderBanners(); } };
    });
    document.getElementById("nuevoBanner").onclick=()=>{
      const id="b"+Math.random().toString(36).slice(2,7);
      banners.unshift({id, titulo:"Nuevo banner", texto:"", imagen:"", color:"#111111", activo:true});
      renderBanners();
    };
  }

  function hydrateConfigUI(){
    if(!config) return;
    document.getElementById("sName").value = config.storeName||"";
    document.getElementById("waNum").value = (config.whatsapp&&config.whatsapp.number)||"";
    document.getElementById("shipPrice").value = (config.shipping && (config.shipping.price ?? config.shipping.default)) || 0;
    const t=config.theme||{};

    const shipInp = document.getElementById("shipPrice");
    if (shipInp) {
      const pushOverride = ()=>{
        const v = toInt(shipInp.value);
        try { localStorage.setItem('mgv_config_override', JSON.stringify({ shipping: { price: v } })); } catch(_){}
      };
      shipInp.addEventListener('input', pushOverride);
      shipInp.addEventListener('change', pushOverride);
      pushOverride();
    }

    document.getElementById("cText").value=t.text||"#111111";
    document.getElementById("cCard").value=t.card||"#f7f7f8";
    document.getElementById("cBorder").value=t.border||"#e5e7eb";
    document.getElementById("cBrand").value=t.brand||"#111111";
    document.getElementById("cAccent").value=t.accent||"#d4af37";
    document.getElementById("cBg").value=t.bg||"#ffffff";
    document.getElementById("seoTitle").value=(config.seo&&config.seo.title)||"";
    document.getElementById("seoDesc").value =(config.seo&&config.seo.description)||"";
    document.getElementById("pgAbout").value =(config.pages&&config.pages.about)||"";
    document.getElementById("pgContact").value=(config.pages&&config.pages.contact)||"";
    document.getElementById("pgReturns").value =(config.pages&&config.pages.returns)||"";
    document.getElementById("pgPrivacy").value=(config.pages&&config.pages.privacy)||"";

    document.getElementById("apiBase").value   = localStorage.getItem("mgv_apiBase") || "/api";
    document.getElementById("saveToken").value = localStorage.getItem("mgv_saveToken") || "";
    document.getElementById("testApi").onclick = testApi;
    document.getElementById("saveAll").onclick = saveAll;
    document.getElementById("dlAll").onclick   = dlAll;
    document.getElementById("saveNow").onclick = saveAll;
    document.getElementById("saveNow2").onclick= saveAll;
  }

  function gatherConfigFromUI(){
    const t=(config.theme=config.theme||{});
    config.storeName=document.getElementById("sName").value;
    config.whatsapp=config.whatsapp||{};
    config.whatsapp.number=document.getElementById("waNum").value;
    config.shipping = config.shipping || {};
    config.shipping.price = toInt(document.getElementById("shipPrice").value);
    t.text  =document.getElementById("cText").value;
    t.card  =document.getElementById("cCard").value;
    t.border=document.getElementById("cBorder").value;
    t.brand =document.getElementById("cBrand").value;
    t.accent=document.getElementById("cAccent").value;
    t.bg    =document.getElementById("cBg").value;
    config.seo=config.seo||{};
    config.seo.title=document.getElementById("seoTitle").value;
    config.seo.description=document.getElementById("seoDesc").value;
    config.pages=config.pages||{};
    config.pages.about  =document.getElementById("pgAbout").value;
    config.pages.contact=document.getElementById("pgContact").value;
    config.pages.returns=document.getElementById("pgReturns").value;
    config.pages.privacy=document.getElementById("pgPrivacy").value;
  }

  function updateApiStatus(){
    const base=localStorage.getItem("mgv_apiBase");
    const tok =localStorage.getItem("mgv_saveToken");
    document.getElementById("apiStatus").textContent=`API: ${base||'sin URL'} · Token ${tok?'listo':'falta'}`;
  }

  async function testApi(){
    const base=(document.getElementById("apiBase").value.trim()||"/api");
    const tok =document.getElementById("saveToken").value.trim();
    localStorage.setItem("mgv_apiBase", base);
    localStorage.setItem("mgv_saveToken", tok);
    updateApiStatus();
    try{
      const t0=performance.now();
      const r=await fetch(base+"/ping");
      const ms=(performance.now()-t0)|0;
      alert(r.ok? ("Conexión OK ("+ms+" ms)") : ("La API respondió con estado "+r.status));
    }catch(e){ alert("No se pudo conectar: "+e.message); }
  }

  function syncTablesBeforeSave(){
    document.querySelectorAll("#tablaProductos tbody input").forEach(inp=>{
      const id=inp.dataset.id, f=inp.dataset.f; if(!id||!f) return;
      const p=productos.find(x=>x.id===id); if(!p) return;
      p[f]=(f==="precio")? toInt(inp.value):inp.value;
    });
    document.querySelectorAll("#tablaBanners tbody input").forEach(inp=>{
      const id=inp.dataset.id, f=inp.dataset.f; if(!id||!f) return;
      const b=banners.find(x=>x.id===id); if(!b) return;
      b[f]=(f==="activo")? inp.checked:inp.value;
    });
  }

  function dlAll(){
    const a=(name,txt)=>{const blob=new Blob([txt],{type:"application/json"}); const el=document.createElement("a"); el.href=URL.createObjectURL(blob); el.download=name; el.click(); URL.revokeObjectURL(el.href);};
    gatherConfigFromUI();
    a("productos.json", JSON.stringify(productos,null,2));
    a("banners.json",   JSON.stringify(banners,null,2));
    a("config.json",    JSON.stringify(config,null,2));
  }

  async function saveAll(){
    syncTablesBeforeSave(); gatherConfigFromUI();
    const base=localStorage.getItem("mgv_apiBase")||"/api";
    const tok =localStorage.getItem("mgv_saveToken")||"";
    try{
      const r=await fetch(base+"/save_catalog",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify({productos,banners,config})});
      const txt=await r.text(); let j={}; try{ j=JSON.parse(txt);}catch(_){}
      if(r.ok){
        if (j && Array.isArray(j.commits) && j.commits.length) { window.__MGV_PENDING_SHA=j.commits[j.commits.length-1]; setLastSHA(window.__MGV_PENDING_SHA); }
        alert("Guardado en GitHub ✔️"); await loadTables(window.__MGV_PENDING_SHA);
      } else { alert("Error "+r.status+": "+(j.error||txt)); }
    }catch(e){ alert("Error de red: "+e.message); }
  }

  document.getElementById("newPass2").onchange=async ()=>{
    const p1=document.getElementById("newPass").value;
    const p2=document.getElementById("newPass2").value;
    if(!p1 || p1!==p2){ alert("Las contraseñas no coinciden"); return; }
    const h=await sha256(SALT+p1);
    alert("Hash generado. Para cambiarla, abrí este archivo y reemplazá HASHED por:\n\n"+h+"\n\nLuego subilo al repo.");
  };

})();