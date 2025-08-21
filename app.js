/* =========================================================
   MGV – App JS (banners + carrito con resumen full)
   ========================================================= */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

const state = {
  config: null,
  banners: [],
  products: [],
  cart: JSON.parse(localStorage.getItem("mgv_cart")||"[]")||[]
};
state.shipping = { method: "retiro", price: 0 };

function money(n){
  try{ n = Number(n||0); }catch(e){ n=0; }
  return n.toLocaleString("es-AR", {style:"currency", currency:"ARS", maximumFractionDigits:0});
}
function saveCart(){ localStorage.setItem("mgv_cart", JSON.stringify(state.cart)); }

function applyConfig(){
  if(!state.config) return;
  $("#storeTitle").textContent = state.config.storeName || "Tienda";
  document.title = state.config.seo?.title || "Tienda";
  const desc = state.config.seo?.description || "";
  const meta = document.querySelector("meta[name='description']");
  if(meta) meta.setAttribute("content", desc);
  const f = document.getElementById("footerInfo"); if(f){ f.innerHTML = `${desc}`; }
}

/* === Normalizador de banners: acepta claves en ES/EN === */
function normalizeBanners(arr){
  return (arr||[]).map(b=>({
    img:   b.img    || b.imagen,
    title: b.title  || b.titulo || "",
    text:  b.text   || b.texto  || "",
    active: (typeof b.active !== "undefined" ? b.active : b.activo)
  })).filter(b=> b.img && (b.active === undefined || b.active === true));
}

/* ================== Estructura del panel ================== */
function ensureCartLayout(){
  const panel = document.getElementById("cartPanel");
  if(!panel) return {};
  const footer = panel.querySelector(".cart-footer");

  // Asegurar bloque de ítems
  let items = document.getElementById("cartItems");
  if(!items){
    items = document.createElement("div");
    items.id = "cartItems";
    items.className = "cart-items";
  }
  if(footer && items.nextElementSibling !== footer){
    panel.insertBefore(items, footer);
  }else if(!footer && !items.parentElement){
    panel.appendChild(items);
  }

  // Resumen compacto justo arriba de los ítems
  let summary = document.getElementById("cartSummary");
  if(!summary){
    summary = document.createElement("div");
    summary.id = "cartSummary";
    summary.className = "cart-summary";
    panel.insertBefore(summary, items);
  }

  return {panel, items, summary, footer};
}

/* ==== FORMA DE ENTREGA – ocultar label y copy ==== */
function applyShippingUI(){
  const wrap = document.getElementById("shipMethod");
  const wPrice = document.getElementById("shipPriceWrap");
  if(!wrap) return;

  // >>> Quitar el texto "Forma de entrega"
  const label = wrap.parentElement?.querySelector('label[for="shipMethod"]');
  if (label) label.style.display = "none";

  // CTA
  const cta = document.getElementById("checkoutBtn");
  if (cta) cta.textContent = "Confirmar por WhatsApp";

  // Leyenda de ayuda
  let help = document.getElementById("cartHelp");
  if (!help) {
    help = document.querySelector(".cart-footer p");
    if (help) help.id = "cartHelp";
  }
  if (help) help.textContent = "Coordinamos entrega y pago por WhatsApp.";

  // Botones con íconos
  wrap.querySelectorAll(".seg").forEach(b=>{
    if(b.dataset.method === "retiro") b.innerHTML = "🏬 <span>Retiro</span>";
    if(b.dataset.method === "envio")  b.innerHTML = "🚚 <span>Envío</span>";
  });

  const inp = document.getElementById("shippingPrice");

  function updateUI(){
    const isEnvio = (state.shipping?.method === "envio");
    if (wPrice) wPrice.style.display = isEnvio ? "" : "none";
    if (isEnvio && inp){
      if(!inp.value){
        const def = Number(state?.config?.shipping?.default || 0) || 0;
        if(def) inp.value = def;
      }
      inp.focus();
    }

    const note = document.getElementById("shipNote") || (() => {
      const n = document.createElement("div");
      n.id = "shipNote"; n.className = "ship-note";
      wrap.parentElement.appendChild(n);
      return n;
    })();
    note.textContent = isEnvio
      ? "Ingresá el costo del envío; se suma al total."
      : "Retiro por el local. Lo coordinamos por WhatsApp.";

    const helpEl = document.getElementById("cartHelp");
    if (helpEl) {
      helpEl.textContent = isEnvio
        ? "Coordinamos envío y pago por WhatsApp."
        : "Coordinamos retiro y pago por WhatsApp.";
    }
  }

  wrap.querySelectorAll(".seg").forEach(b=>{
    b.onclick = ()=>{
      wrap.querySelectorAll(".seg").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      state.shipping = state.shipping || {};
      state.shipping.method = b.dataset.method;
      if(state.shipping.method !== "envio") state.shipping.price = 0;
      updateUI();
      if(typeof renderCart === "function") renderCart();
    };
  });

  if(inp){
    inp.addEventListener("input", ()=>{
      const n = Math.max(0, Number(inp.value||0));
      state.shipping.price = isNaN(n) ? 0 : n;
      if(typeof renderCart === "function") renderCart();
    });
  }

  updateUI();
}

/* ================== BANNERS ================== */
function renderBanners(){
  const wrap = document.getElementById("bannerCarousel");
  if(!wrap) return;
  const active = (state.banners||[]).filter(b=> b && b.img);
  if(!active.length){
    wrap.innerHTML = "";
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "";
  wrap.innerHTML = active.map((b,i)=>`
    <article class="banner${i===0?' active':''}">
      <img src="${b.img}" alt="${b.title||''}">
      <div class="content">
        <div class="title">${b.title||''}</div>
        <div class="text">${b.text||''}</div>
      </div>
    </article>
  `).join("");

  const dotsWrap = document.createElement("div");
  dotsWrap.className = "dots";
  active.forEach((_,i)=>{
    const d = document.createElement("div");
    d.className = "dot"+(i===0?" active":"");
    d.onclick = ()=> showSlide(i);
    dotsWrap.appendChild(d);
  });
  wrap.appendChild(dotsWrap);

  let idx=0;
  function showSlide(n){
    const cards = wrap.querySelectorAll(".banner");
    const dots = wrap.querySelectorAll(".dot");
    cards.forEach((c,i)=> c.classList.toggle("active", i===n));
    dots.forEach((d,i)=> d.classList.toggle("active", i===n));
    idx = n;
  }
  if(active.length>1){
    setInterval(()=> showSlide((idx+1)%active.length), 5000);
  }
}

/* ================== PRODUCTOS ================== */
function renderProducts(){
  const grid = document.getElementById("productGrid");
  const q = ($("#q")?.value||"").toLowerCase();
  const cat = $(".badge.active")?.dataset?.cat||"";
  const items = state.products
    .filter(p=>!cat || p.categoria===cat)
    .filter(p=>{
      const nom = (p.nombre||"").toLowerCase();
      const desc = (p.descripcion||"").toLowerCase();
      return nom.includes(q) || desc.includes(q);
    });

  grid.innerHTML = items.map(p=>`
    <article class="card">
      <img src="${p.imagen}" alt="${p.nombre}">
      <div class="body">
        <div class="name">${p.nombre}</div>
        <div class="desc">${p.descripcion||""}</div>
        <div class="row">
          <div class="price">${money(p.precio)}</div>
          <button class="btn" data-add="${p.id}">Agregar</button>
        </div>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll("[data-add]").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.add;
      const prod = state.products.find(x=>String(x.id)===String(id));
      if(!prod) return;
      const found = state.cart.find(x=>String(x.id)===String(prod.id));
      if(found) found.cant += 1;
      else state.cart.push({id: prod.id, nombre: prod.nombre, precio: prod.precio, imagen: prod.imagen, cant: 1});
      saveCart(); renderCart();
    };
  });
}

/* ================== CARRITO ================== */
function changeQty(id, delta){
  const it = state.cart.find(x=>String(x.id)===String(id));
  if(!it) return;
  it.cant = Math.max(1, (Number(it.cant||1) + Number(delta||0)));
  saveCart(); renderCart();
}
function removeFromCart(id){
  state.cart = state.cart.filter(x=>String(x.id)!==String(id));
  saveCart(); renderCart();
}

function renderCart(){
  const {items, summary} = ensureCartLayout();
  if(!items || !summary) return;

  const subtotal = state.cart.reduce((acc,it)=> acc + (Number(it.precio||0) * Number(it.cant||1)), 0);
  const envio = (state.shipping?.method === "envio") ? Number(state.shipping?.price||0) : 0;
  const total = subtotal + envio;

  const count = state.cart.reduce((a,b)=> a + Number(b.cant||1), 0);
  const cartFabCount = document.getElementById("cartCount");
  if(cartFabCount) cartFabCount.textContent = String(count);
  const totalEl = document.getElementById("cartTotal");
  if(totalEl) totalEl.textContent = money(total);

  // ---------- Lista de ítems
  items.innerHTML = state.cart.map(it=>`
    <div class="cart-item">
      <img src="${it.imagen}" alt="${it.nombre}"/>
      <div class="meta">
        <div class="name">${it.nombre}</div>
        <div class="small">${money(it.precio)} × ${it.cant}</div>
      </div>
      <div>
        <span class="qty-group">
          <button class="btn secondary" data-q="-1" data-id="${it.id}">-</button>
          <button class="btn" data-q="+1" data-id="${it.id}">+</button>
        </span>
        <button class="btn secondary" data-del="${it.id}">✕</button>
      </div>
    </div>
  `).join("");

  items.querySelectorAll("[data-q]").forEach(b=>{
    b.onclick = ()=> changeQty(b.dataset.id, parseInt(b.dataset.q));
  });
  items.querySelectorAll("[data-del]").forEach(b=>{
    b.onclick = ()=> removeFromCart(b.dataset.del);
  });

  // ---------- Resumen FULL bajo el header (lista completa)
  if(state.cart.length){
    const list = state.cart.map(it=>`<li>${it.nombre} ×${it.cant}</li>`).join("");
    summary.innerHTML = `<div class="sum-title">Resumen</div><ul class="sum-list">${list}</ul>`;
  }else{
    summary.innerHTML = `<div class="sum-empty">Tu carrito está vacío.</div>`;
  }

  // ---------- Desglose en el footer
  const bd = document.getElementById("cartBreakdown");
  if(bd){
    bd.innerHTML = `
      <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>${state.shipping?.method==="envio" ? "Envío" : "Retiro en local"}</span><span>${state.shipping?.method==="envio" ? money(envio) : "$ 0"}</span></div>
    `;
  }
}

/* ================== INIT ================== */
(async function(){
  const fab = document.getElementById("cartFab");
  const close = document.getElementById("closeCart");
  if(fab) fab.onclick = ()=> document.getElementById("cartPanel").style.display = "flex";
  if(close) close.onclick = ()=> document.getElementById("cartPanel").style.display = "none";
  const search = document.getElementById("q");
  if(search) search.oninput = ()=> renderProducts();

  const [cfg, banners, prods] = await Promise.all([
    fetch("data/config.json").then(r=>r.json()).catch(()=>({})),
    fetch("data/banners.json").then(r=>r.json()).catch(()=>([])),
    fetch("data/productos.json").then(r=>r.json()).catch(()=>([]))
  ]);
  state.config = cfg; state.banners = normalizeBanners(banners); state.products = prods;
  applyConfig();

  renderBanners();
  const cats = [...new Set(state.products.map(p=>p.categoria).filter(Boolean))];
  const pills = document.getElementById("categoryPills");
  if(pills){
    pills.innerHTML = `<span class="badge active" data-cat="">Todo</span>` + cats.map(c=>`<span class="badge" data-cat="${c}">${c}</span>`).join("");
    pills.querySelectorAll(".badge").forEach(b=>{
      b.onclick = ()=>{
        pills.querySelectorAll(".badge").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        renderProducts();
      };
    });
  }
  renderProducts();
  renderCart();
  applyShippingUI();
})();

/* ================== CHECKOUT (WhatsApp) ================== */
document.getElementById("checkoutBtn").onclick = ()=>{
  try{
    const cart = (Array.isArray(state?.cart) && state.cart.length) ? state.cart
                 : (JSON.parse(localStorage.getItem("mgv_cart")||"[]") || []);
    if(!cart.length){ alert("Tu carrito está vacío."); return; }
    const nameInput = document.getElementById("customerName");
    const name = (nameInput?.value || "").trim();
    if(nameInput){ nameInput.classList.remove("error"); }
    if(!name){
      if(nameInput){ nameInput.classList.add("error"); nameInput.focus(); }
      alert("Por favor, ingresá tu nombre para enviar el pedido.");
      return;
    }
    const number = state?.config?.whatsapp?.number || "5493412272899";
    const preHeader = state?.config?.whatsapp?.preHeader || "Nuevo pedido";
    const toNumber = (x)=>{ try{ const s = String(x ?? "").replace(/[^\d,\.\-]/g, ""); return Number(s||0); }catch(e){ return 0; } };
    const items = cart.map((it)=>`• ${it.nombre} ×${Number(it.cant||1)} – ${money(toNumber(it.precio))}`);
    const subtotal = cart.reduce((acc, it)=> acc + (toNumber(it.precio) * Number(it.cant||1)), 0);
    const envio = (state.shipping?.method==="envio") ? Number(state.shipping?.price||0) : 0;
    const total = subtotal + envio;

    const lines = [
      `Pedido de: ${name}`,
      preHeader,
      "Hola, quiero hacer un pedido:",
      ...items,
      "",
      `${state.shipping?.method==="envio" ? "Envío" : "Retiro en local"}: ${state.shipping?.method==="envio" ? money(envio) : "$ 0"}`,
      `Total: ${money(total)}`
    ];
    const text = lines.join("\n");
    const url = "https://wa.me/" + encodeURIComponent(number) + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
    state.cart = [];
    localStorage.setItem("mgv_cart", JSON.stringify(state.cart));
    renderCart();
    const panel = document.getElementById("cartPanel"); if(panel) panel.style.display = "none";
  }catch(err){ console.error(err); }
};
