/* =========================================================
   App – carrito prolijo con resumen único + envío desde panel
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

const money = (n)=>{
  try{ n = Number(n||0); }catch(_){ n = 0; }
  return n.toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
};
const saveCart = ()=> localStorage.setItem('mgv_cart', JSON.stringify(state.cart));

function deepMerge(base, extra){
  if(Array.isArray(base) || Array.isArray(extra)) return (extra ?? base);
  const out = {...(base||{})};
  for(const k of Object.keys(extra||{})){
    const v = extra[k];
    out[k] = (v && typeof v==='object' && !Array.isArray(v)) ? deepMerge(out[k], v) : v;
  }
  return out;
}
const cfgShipPrice = ()=>{
  const v = state?.config?.shipping?.price ?? state?.config?.shipping?.default ?? 0;
  const n = Number(v||0);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- Banners ---------- */
function normalizeBanners(arr){
  return (arr||[]).map(b=>({
    img:b.img||b.imagen, title:b.title||b.titulo||'', text:b.text||b.texto||'',
    active:(typeof b.active!=='undefined'? b.active : b.activo)
  })).filter(b=> b.img && (b.active===undefined || b.active===true));
}
function renderBanners(){
  const wrap = $('#bannerCarousel'); if(!wrap) return;
  const active = (state.banners||[]).filter(b=>b&&b.img);
  if(!active.length){ wrap.innerHTML=''; wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML = active.map((b,i)=>`
    <article class="banner${i===0?' active':''}">
      <img src="${b.img}" alt="${b.title||''}">
      <div class="content">
        <div class="title">${b.title||''}</div>
        <div class="text">${b.text||''}</div>
      </div>
    </article>`).join('');
  const dots=document.createElement('div'); dots.className='dots';
  let idx=0; const show=(n)=>{
    wrap.querySelectorAll('.banner').forEach((c,i)=>c.classList.toggle('active',i===n));
    wrap.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===n));
    idx=n;
  };
  active.forEach((_,i)=>{ const d=document.createElement('div'); d.className='dot'+(i?'':' active'); d.onclick=()=>show(i); dots.appendChild(d); });
  wrap.appendChild(dots);
  if(active.length>1) setInterval(()=>show((idx+1)%active.length),5000);
}

/* ---------- Productos ---------- */
function renderProducts(){
  const grid = $('#productGrid'); if(!grid) return;
  const q = ($('#q')?.value||'').toLowerCase();
  const cat = $('.badge.active')?.dataset?.cat||'';
  const items = state.products
    .filter(p=>!cat || p.categoria===cat)
    .filter(p=> (p.nombre||'').toLowerCase().includes(q) || (p.descripcion||'').toLowerCase().includes(q) );
  grid.innerHTML = items.map(p=>`
    <article class="card">
      <img src="${p.imagen}" alt="${p.nombre||''}">
      <div class="body">
        <div class="name">${p.nombre||''}</div>
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
  const panel = $('#cartPanel'); if(!panel) return {};
  let items   = $('#cartItems');
  let summary = $('#cartSummary');
  if(!summary){
    summary=document.createElement('div');
    summary.id='cartSummary'; summary.className='cart-summary';
    if(items) panel.insertBefore(summary, items); else panel.appendChild(summary);
  }
  // Eliminar duplicados de .cart-summary
  $$('.cart-summary').forEach(el=>{ if(el!==summary) el.remove(); });
  // Asegurar orden: summary arriba de items
  if(summary && items && summary.nextElementSibling!==items){
    panel.insertBefore(summary, items);
  }
  return {panel, items, summary};
}
function changeQty(id,delta){
  const it=state.cart.find(x=>String(x.id)===String(id)); if(!it) return;
  it.cant=Math.max(1,(Number(it.cant||1)+Number(delta||0)));
  saveCart(); renderCart();
}
function removeFromCart(id){
  state.cart=state.cart.filter(x=>String(x.id)!==String(id));
  saveCart(); renderCart();
}
function renderCart(){
  const {items,summary}=ensureCartLayout(); if(!items||!summary) return;

  state.shipping.price = state.shipping.method==='envio' ? cfgShipPrice() : 0;
  const subtotal = state.cart.reduce((a,it)=>a+(Number(it.precio||0)*Number(it.cant||1)),0);
  const envio    = state.shipping.price;
  const total    = subtotal + (state.shipping.method==='envio'?envio:0);

  const count = state.cart.reduce((a,b)=>a+Number(b.cant||1),0);
  const cc = $('#cartCount'); if(cc) cc.textContent=String(count);
  const ct = $('#cartTotal'); if(ct) ct.textContent=money(total);

  // Ítems con – / + / ✕
  items.innerHTML = state.cart.map(it=>`
    <div class="cart-item">
      <img src="${it.imagen}" alt="${it.nombre||''}">
      <div class="meta">
        <div class="name">${it.nombre||''}</div>
        <div class="small">${money(it.precio)} × ${it.cant}</div>
      </div>
      <div>
        <span class="qty-group">
          <button class="btn secondary" data-q="-1" data-id="${it.id}" aria-label="Restar">-</button>
          <button class="btn"            data-q="+1" data-id="${it.id}" aria-label="Sumar">+</button>
        </span>
        <button class="btn secondary" data-del="${it.id}" aria-label="Eliminar">✕</button>
      </div>
    </div>`).join('');
  items.querySelectorAll('[data-q]').forEach(b=> b.onclick=()=>changeQty(b.dataset.id,parseInt(b.dataset.q)));
  items.querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>removeFromCart(b.dataset.del));

  // Resumen único
  if(state.cart.length){
    const list = state.cart.map(it=>`
      <li class="sum-item">
        <img src="${it.imagen}" alt="${it.nombre||''}">
        <div class="sum-meta">
          <div class="sum-name">${it.nombre||''}</div>
          <div class="sum-qty">×${it.cant} · ${money(Number(it.precio)*Number(it.cant))}</div>
        </div>
      </li>`).join('');
    summary.innerHTML = `<div class="sum-title">Resumen</div><ul class="sum-grid">${list}</ul>`;
  }else{
    summary.innerHTML = `<div class="sum-empty">Tu carrito está vacío.</div>`;
  }

  // Desglose
  const bd = $('#cartBreakdown');
  if(bd){
    const lbl = state.shipping.method==='envio' ? 'Envío' : 'Retiro en local';
    const val = state.shipping.method==='envio' ? money(envio) : '$ 0';
    bd.innerHTML = `
      <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>${lbl}</span><span>${val}</span></div>`;
  }

  // Asegurar botón checkout visible
  const btn = document.getElementById('checkoutBtn');
  if(btn){
    btn.style.display = 'block';
    btn.disabled = state.cart.length===0;
    btn.setAttribute('aria-disabled', String(btn.disabled));
  }
}

/* ---------- Envío (selector) ---------- */
function setupShippingSelector(){
  const wrap=$('#shipMethod'); if(!wrap) return;
  wrap.querySelectorAll('.seg').forEach(b=>{
    if(b.dataset.method==='retiro') b.innerHTML='🏬 <span>Retiro</span>';
    if(b.dataset.method==='envio')  b.innerHTML='🚚 <span>Envío</span>';
    b.onclick=()=>{
      wrap.querySelectorAll('.seg').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.shipping.method=b.dataset.method;
      const note=document.getElementById('shipNote'); if(note) note.remove();
      renderCart();
    };
  });
}

/* ---------- Checkout (WhatsApp) ---------- */
function setupCheckout(){
  const btn = document.getElementById('checkoutBtn');
  if(!btn) return;
  btn.onclick = ()=>{
    const cart = Array.isArray(state.cart)? state.cart: [];
    if(!cart.length){ alert('Tu carrito está vacío.'); return; }
    const nameInput = document.getElementById('customerName');
    const name = (nameInput?.value || '').trim();
    if(nameInput){ nameInput.classList.remove('error'); }
    if(!name){
      if(nameInput){ nameInput.classList.add('error'); nameInput.scrollIntoView({block:'center', behavior:'smooth'}); nameInput.focus(); }
      alert('Por favor, ingresá tu nombre para enviar el pedido.');
      return;
    }
    const number = state?.config?.whatsapp?.number || '5493412272899';
    const preHeader = state?.config?.whatsapp?.preHeader || 'Nuevo pedido';
    const toNumber = (x)=>{ try{ const s=String(x??'').replace(/[^\d,.-]/g,''); return Number(s||0);}catch(_){return 0;} };
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
    const text = lines.join('\\n');
    const url = 'https://wa.me/' + encodeURIComponent(number) + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
    state.cart = [];
    localStorage.setItem('mgv_cart', JSON.stringify(state.cart));
    renderCart();
    const panel = document.getElementById('cartPanel'); if(panel) panel.style.display='none';
  };
}

/* ---------- Init (se llama al final, con todo definido) ---------- */
async function initStore(){
  const [serverCfg,banners,prods] = await Promise.all([
    fetch('data/config.json').then(r=>r.json()).catch(()=>({})),
    fetch('data/banners.json').then(r=>r.json()).catch(()=>[]),
    fetch('data/productos.json').then(r=>r.json()).catch(()=>[])
  ]);
  const localOverride = JSON.parse(localStorage.getItem('mgv_config_override')||'null')||{};
  state.config   = deepMerge(serverCfg, localOverride);
  state.banners  = normalizeBanners(banners);
  state.products = prods;

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

  $('#cartFab') && ($('#cartFab').onclick = ()=> $('#cartPanel').style.display='flex');
  $('#closeCart') && ($('#closeCart').onclick = ()=> $('#cartPanel').style.display='none');

  renderBanners();
  renderProducts();
  setupShippingSelector();
  renderCart();
  setupCheckout();

  window.addEventListener('storage',(e)=>{
    if(e.key==='mgv_config_override'){
      const ov = JSON.parse(e.newValue||'null')||{};
      state.config = deepMerge(state.config, ov);
      renderCart();
    }
  });
}

initStore();
