/* =========================================================
   App – carrito arreglado + envío desde panel + resumen único
   ========================================================= */
const $  = (s,ctx=document)=>ctx.querySelector(s);
const $$ = (s,ctx=document)=>[...ctx.querySelectorAll(s)];

const state = {
  config: null,
  banners: [],
  products: [],
  cart: JSON.parse(localStorage.getItem('mgv_cart')||'[]')||[],
  shipping: { method: 'retiro', price: 0 }
};

const money = n=>{
  try{ n = Number(n||0); }catch(e){ n=0; }
  return n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
};
const saveCart = ()=> localStorage.setItem('mgv_cart', JSON.stringify(state.cart));

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
const cfgShipPrice = ()=> {
  const v = state?.config?.shipping?.price ?? state?.config?.shipping?.default ?? 0;
  const n = Number(v||0);
  return isNaN(n)?0:n;
};

/* ---------- Banners ---------- */
function normalizeBanners(arr){
  return (arr||[]).map(b=>({
    img: b.img||b.imagen, title: b.title||b.titulo||'', text: b.text||b.texto||'',
    active: (typeof b.active!=='undefined'? b.active : b.activo)
  })).filter(b=> b.img && (b.active===undefined || b.active===true));
}
function renderBanners(){
  const wrap = $('#bannerCarousel'); if(!wrap) return;
  const active = (state.banners||[]).filter(b=>b&&b.img);
  if(!active.length){ wrap.innerHTML=''; wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML = active.map((b,i)=>`
    <article class="banner${i===0?' active':''}">
      <img src="${b.img}" alt="${b.title}">
      <div class="content"><div class="title">${b.title||''}</div><div class="text">${b.text||''}</div></div>
    </article>`).join('');
  const dots=document.createElement('div'); dots.className='dots';
  active.forEach((_,i)=>{ const d=document.createElement('div'); d.className='dot'+(i?'':' active'); d.onclick=()=>show(i); dots.appendChild(d); });
  wrap.appendChild(dots);
  let idx=0; function show(n){
    wrap.querySelectorAll('.banner').forEach((c,i)=>c.classList.toggle('active',i===n));
    wrap.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===n));
    idx=n;
  }
  if(active.length>1) setInterval(()=>show((idx+1)%active.length),5000);
}

/* ---------- Productos ---------- */
function renderProducts(){
  const grid = $('#productGrid'); if(!grid) return;
  const q = ($('#q')?.value||'').toLowerCase();
  const cat = $('.badge.active')?.dataset?.cat||'';
  const items = state.products
    .filter(p=>!cat || p.categoria===cat)
    .filter(p=>{
      const n=(p.nombre||'').toLowerCase(); const d=(p.descripcion||'').toLowerCase();
      return n.includes(q)||d.includes(q);
    });
  grid.innerHTML = items.map(p=>`
    <article class="card">
      <img src="${p.imagen}" alt="${p.nombre}">
      <div class="body">
        <div class="name">${p.nombre}</div>
        <div class="desc">${p.descripcion||''}</div>
        <div class="row">
          <div class="price">${money(p.precio)}</div>
          <button class="btn" data-add="${p.id}">Agregar</button>
        </div>
      </div>
    </article>`).join('');
  grid.querySelectorAll('[data-add]').forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.add; const prod=state.products.find(x=>String(x.id)===String(id)); if(!prod) return;
      const r=state.cart.find(x=>String(x.id)===String(id));
      if(r) r.cant+=1; else state.cart.push({id:prod.id,nombre:prod.nombre,precio:prod.precio,imagen:prod.imagen,cant:1});
      saveCart(); renderCart();
    };
  });
}

/* ---------- Carrito ---------- */
function ensureCartLayout(){
  const panel = document.getElementById('cartPanel');
  if(!panel) return {};
  let items   = document.getElementById('cartItems');
  let summary = document.getElementById('cartSummary');
  document.querySelectorAll('.cart-summary').forEach(el=>{ if(el.id !== 'cartSummary') el.remove(); });
  if(summary && items && summary.nextElementSibling !== items){
    panel.insertBefore(summary, items);
  }
  return {panel, items, summary};
}

/* ---------- Envío (selector) ---------- */
function setupShippingSelector(){
  const wrap=document.getElementById('shipMethod'); if(!wrap) return;
  wrap.querySelectorAll('.seg').forEach(b=>{
    if(b.dataset.method==='retiro') b.innerHTML='🏬 <span>Retiro</span>';
    if(b.dataset.method==='envio')  b.innerHTML='🚚 <span>Envío</span>';
    b.onclick=()=>{
      wrap.querySelectorAll('.seg').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.shipping.method=b.dataset.method;
      const old=document.getElementById('shipNote'); if(old) old.remove();
      renderCart();
    };
  });
};
      const items = cart.map((it)=>`• ${it.nombre} ×${Number(it.cant||1)} – ${money(toNumber(it.precio))}`);
      const subtotal = cart.reduce((acc, it)=> acc + (toNumber(it.precio) * Number(it.cant||1)), 0);
      const envio = (state.shipping?.method==='envio') ? Number(cfgShipPrice()||0) : 0;
      const total = subtotal + envio;

      const lines = [
        `Pedido de: ${name}`,
        preHeader,
        'Hola, quiero hacer un pedido:',
        ...items,
        '',
        `${state.shipping?.method==='envio' ? 'Envío' : 'Retiro en local'}: ${state.shipping?.method==='envio' ? money(envio) : '$ 0'}`,
        `Total: ${money(total)}`
      ];
      const text = lines.join('\n');
      const url = 'https://wa.me/' + encodeURIComponent(number) + '?text=' + encodeURIComponent(text);
      window.open(url, '_blank');
      state.cart = [];
      localStorage.setItem('mgv_cart', JSON.stringify(state.cart));
      renderCart();
      const panel = document.getElementById('cartPanel'); if(panel) panel.style.display = 'none';
    }catch(err){ console.error(err); }
  };
}

/* ---------- Init ---------- */
(async function(){
  const [serverCfg,banners,prods] = await Promise.all([
    fetch('data/config.json').then(r=>r.json()).catch(()=>({})),
    fetch('data/banners.json').then(r=>r.json()).catch(()=>[]),
    fetch('data/productos.json').then(r=>r.json()).catch(()=>[])
  ]);
  // Override local desde el panel (previsualización)
  const localOverride = JSON.parse(localStorage.getItem('mgv_config_override')||'null')||{};
  state.config   = deepMerge(serverCfg, localOverride);
  state.banners  = normalizeBanners(banners);
  state.products = prods;

  // Header/search/cats
  if($('#storeTitle')) $('#storeTitle').textContent = state.config.storeName || 'Tienda';
  document.title = state.config?.seo?.title || 'Tienda';
  const search = $('#q'); if(search) search.oninput=()=>renderProducts();
  const cats=[...new Set(state.products.map(p=>p.categoria).filter(Boolean))];
  const pills=$('#categoryPills');
  if(pills){
    pills.innerHTML = `<span class="badge active" data-cat="">Todo</span>` + cats.map(c=>`<span class="badge" data-cat="${c}">${c}</span>`).join('');
    pills.querySelectorAll('.badge').forEach(b=>{
      b.onclick=()=>{ pills.querySelectorAll('.badge').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderProducts(); };
    });
  }

  // Abrir/cerrar carrito
  if($('#cartFab')) $('#cartFab').onclick = ()=> $('#cartPanel').style.display='flex';
  if($('#closeCart')) $('#closeCart').onclick = ()=> $('#cartPanel').style.display='none';

  renderBanners();
  renderProducts();
  setupShippingSelector();
  renderCart();
  setupCheckout();

  // Si el panel guarda override en otra pestaña, actualizar
  window.addEventListener('storage',(e)=>{
    if(e.key==='mgv_config_override'){
      const ov = JSON.parse(e.newValue||'null')||{};
      state.config = deepMerge(state.config, ov);
      renderCart();
    }
  });
})();
