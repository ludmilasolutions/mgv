
// ===== Patch v9: robust checkout (no NaN, includes names, safe handlers) =====
(function(){
  function toNumber(x){
    try{
      const s = String(x ?? '').replace(/[^\d,.\-]/g, '');
      if(s.includes(',') && s.includes('.')){
        return parseFloat(s.replace(/\./g,'').replace(',', '.'));
      }else if(s.includes(',')){
        return parseFloat(s.replace(/\./g,'').replace(',', '.'));
      }else{
        return parseFloat(s.replace(/,/g,''));
      }
    }catch(_){ return 0; }
  }
  const money = n => `$ ${Number(n||0).toLocaleString('es-AR')}`;
  function installCheckout(){
    const oldBtn = document.getElementById('checkoutBtn');
    if(!oldBtn) return;
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    btn.addEventListener('click', (e)=>{
      try{
        const nameInput = document.getElementById('customerName');
        const name = (nameInput?.value || '').trim();
        if(nameInput){ nameInput.classList.remove('error'); }
        if(!name){
          if(nameInput){ nameInput.classList.add('error'); nameInput.focus(); }
          alert('Por favor, ingresá tu nombre para enviar el pedido.');
          return;
        }
        if(!window.state || !Array.isArray(window.state.cart) || state.cart.length===0){
          alert('Agregá algún producto al carrito.');
          return;
        }
        const lines = [];
        lines.push(`Pedido de: ${name}`);
        lines.push('Hola, quiero hacer un pedido:');
        const items = state.cart.map(it=>{
          const nm = it.name || it.title || it.nombre || 'Producto';
          const qty = Number(it.qty)||1;
          const unit = toNumber(it.price);
          const sub = unit * qty;
          return `• ${nm} ×${qty} – ${money(sub)}`;
        });
        items.forEach(l=>lines.push(l));
        const total = state.cart.reduce((acc, it)=> acc + (toNumber(it.price) * (Number(it.qty)||1)), 0);
        lines.push('');
        lines.push(`Total: ${money(total)}`);
        const text = lines.join('\n');
        const url = 'https://wa.me/5493412272899?text=' + encodeURIComponent(text);
        window.open(url, '_blank');
        // clear & close
        state.cart = [];
        localStorage.setItem('mgv_cart', JSON.stringify(state.cart));
        if(typeof renderCart === 'function'){ renderCart(); }
        const p = document.getElementById('cartPanel'); if(p) p.style.display='none';
      }catch(err){ console.error(err); }
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installCheckout);
  }else{
    installCheckout();
  }
})();


const state = {
  products: [],
  banners: [],
  config: null,
  category: "Todos",
  cart: JSON.parse(localStorage.getItem("mgv_cart")||"[]"),
  modal: { id: null }
};
const $ = (s)=>document.querySelector(s);

function money(n){return "$ " + Number(n||0).toLocaleString("es-AR")}
async function loadData(){
  const [pr, br, cf] = await Promise.all([
    fetch("data/productos.json?ts="+Date.now()),
    fetch("data/banners.json?ts="+Date.now()),
    fetch("data/config.json?ts="+Date.now())
  ]);
  state.products = await pr.json();
  state.banners = await br.json();
  state.config = await cf.json();
  applyConfig();
}
function applyConfig(){
  if(!state.config) return;
  $("#storeTitle").textContent = state.config.storeName || "Tienda";
  document.title = state.config.seo?.title || "Tienda";
  const desc = state.config.seo?.description || "";
  const meta = document.querySelector("meta[name='description']");
  if(meta) meta.setAttribute("content", desc);
  $("#footerInfo").innerHTML = `WhatsApp: ${state.config.whatsapp?.number||""} · ${state.config.seo?.description||""}`;
  const t = state.config.theme || {};
  const root = document.documentElement;
  Object.entries({
    "--bg": t.bg, "--card": t.card, "--text": t.text,
    "--muted": t.muted, "--border": t.border,
    "--brand": t.brand, "--accent": t.accent
  }).forEach(([k,v])=> v && root.style.setProperty(k, v));
}

function renderCategories(){
  const cats = ["Todos", ...Array.from(new Set(state.products.map(p=>p.categoria)))];
  const wrap = $("#categoryPills");
  wrap.innerHTML = "";
  cats.forEach(c=>{
    const b = document.createElement("button");
    b.className = "badge" + (state.category===c?" active":"");
    b.textContent = c;
    b.onclick = ()=>{state.category = c; renderProducts(); renderCategories();}
    wrap.appendChild(b);
  });
}

function renderBanners(){
  const wrap = $("#bannerCarousel");
  const active = state.banners.filter(b=>b.activo!==false);
  if(!active.length){wrap.innerHTML = ""; return;} // con datos aparece
  wrap.innerHTML = active.map((b,i)=>`
    <article class="banner" style="display:${i===0?"block":"none"}">
      <img src="${b.imagen}" alt="${b.titulo}"/>
      <div class="content">
        <div class="title" style="color:${b.color||'var(--brand)'}">${b.titulo}</div>
        <div class="text">${b.texto||""}</div>
      </div>
      <div class="dots"></div>
    </article>
  `).join("");
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "dots";
  active.forEach((_,i)=>{
    const d=document.createElement("div");
    d.className="dot"+(i===0?" active":"");
    d.onclick=()=>showSlide(i);
    dotsWrap.appendChild(d);
  });
  wrap.appendChild(dotsWrap);
  let idx=0;
  function showSlide(n){
    const cards = wrap.querySelectorAll(".banner");
    const dots = wrap.querySelectorAll(".dot");
    cards.forEach((c,i)=>c.style.display = i===n?"block":"none");
    dots.forEach((d,i)=>d.classList.toggle("active", i===n));
    idx=n;
  }
  setInterval(()=> showSlide((idx+1)%active.length), 5000);
}

function renderProducts(){
  const grid = document.getElementById("productGrid");
  const q = document.getElementById("q").value.toLowerCase();
  const items = state.products
    .filter(p=>state.category==="Todos" || p.categoria===state.category)
    .filter(p=>p.nombre.toLowerCase().includes(q)|| (p.descripcion||"").toLowerCase().includes(q));
  grid.innerHTML = items.map(p=>`
    <article class="card" data-open="${p.id}">
      <img src="${p.imagen}" alt="${p.nombre}"/>
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
    btn.onclick = (e)=>{ e.stopPropagation(); addToCart(btn.dataset.add); };
  });
  grid.querySelectorAll("[data-open]").forEach(card=>{
    card.onclick = ()=> openModal(card.dataset.open);
  });
}

function openModal(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  state.modal.id = id;
  document.getElementById("mImg").src = p.imagen;
  document.getElementById("mName").textContent = p.nombre;
  document.getElementById("mDesc").textContent = p.descripcion || "";
  document.getElementById("mPrice").textContent = money(p.precio);
  document.getElementById("productModal").style.display = "flex";
}
function closeModal(){ document.getElementById("productModal").style.display = "none"; }
document.getElementById("mClose").onclick = closeModal;
document.getElementById("mClose2").onclick = closeModal;
document.getElementById("mAdd").onclick = ()=>{ if(state.modal.id){ addToCart(state.modal.id); closeModal(); } };

function renderCart(){
  const list = document.getElementById("cartItems");
  const total = state.cart.reduce((acc,it)=>acc + it.precio*it.cant, 0);
  document.getElementById("cartTotal").textContent = money(total);
  document.getElementById("cartCount").textContent = state.cart.reduce((a,b)=>a+b.cant,0);
  list.innerHTML = state.cart.map(it=>`
    <div class="cart-item">
      <img src="${it.imagen}" />
      <div class="meta">
        <div class="name">${it.nombre}</div>
        <div class="small">${money(it.precio)} x ${it.cant}</div>
      </div>
      <div>
        <button class="btn secondary" data-q="-1" data-id="${it.id}">-</button>
        <button class="btn" data-q="+1" data-id="${it.id}">+</button>
        <button class="btn secondary" data-del="${it.id}">x</button>
      </div>
    </div>
  `).join("");
  list.querySelectorAll("[data-q]").forEach(b=>{
    b.onclick = ()=> changeQty(b.dataset.id, parseInt(b.dataset.q));
  });
  list.querySelectorAll("[data-del]").forEach(b=>{
    b.onclick = ()=> removeFromCart(b.dataset.del);
  })
}

function addToCart(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  const found = state.cart.find(x=>x.id===id);
  if(found) found.cant++; else state.cart.push({...p, cant:1});
  localStorage.setItem("mgv_cart", JSON.stringify(state.cart));
  renderCart();
}
function changeQty(id, delta){
  const it = state.cart.find(x=>x.id===id);
  if(!it) return;
  it.cant += delta;
  if(it.cant<=0) state.cart = state.cart.filter(x=>x.id!==id);
  localStorage.setItem("mgv_cart", JSON.stringify(state.cart));
  renderCart();
}
function removeFromCart(id){
  state.cart = state.cart.filter(x=>x.id!==id);
  localStorage.setItem("mgv_cart", JSON.stringify(state.cart));
  renderCart();
}

document.getElementById("cartFab").onclick = ()=> document.getElementById("cartPanel").style.display = "flex";
document.getElementById("closeCart").onclick = ()=> document.getElementById("cartPanel").style.display = "none";
document.getElementById("q").oninput = ()=> renderProducts();

document.getElementById("checkoutBtn").onclick = async ()=>{
  if(!state.cart.length){ alert("Tu carrito está vacío."); return; }
  const number = state.config?.whatsapp?.number || "";
  if(!number){ alert("No hay número de WhatsApp configurado."); return; }
  const items = state.cart.map(it=>`• ${it.nombre} x ${it.cant} — ${money(it.precio*it.cant)}`).join("%0A");
  const total = state.cart.reduce((a,i)=>a+i.precio*i.cant,0);
  const header = encodeURIComponent(state.config?.whatsapp?.preHeader || "Nuevo pedido");
  const msg = `${header}%0A%0A${items}%0A%0ATotal: ${money(total)}%0A%0A`;
  // Vaciar carrito luego de enviar
  state.cart = [];
  localStorage.setItem("mgv_cart", JSON.stringify(state.cart));
  renderCart();
  document.getElementById("cartPanel").style.display = "none";};

(async function(){
  await loadData();
  renderCategories();
  renderBanners();
  renderProducts();
  renderCart();
})();
