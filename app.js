// MGV_FOOTER_FILTER: remove phone numbers from footer
(function(){
  const fi=document.getElementById('footerInfo');
  if(!fi) return;
  const obs=new MutationObserver(()=>{
    fi.querySelectorAll('*').forEach(n=>{
      if(n.childNodes && n.childNodes.length){
        n.childNodes.forEach(c=>{
          if(c.nodeType===3){
            c.nodeValue=c.nodeValue.replace(/\+?\d[\d\s.-]{6,}/g,'');
          }
        });
      }
    });
  });
  obs.observe(fi,{childList:true,subtree:true});
  } catch(e){ console.error('Init error', e); }
})();
// Patch_v16_clearCart
(function(){
  const btn=document.getElementById('clearCartBtn'); if(!btn) return;
  btn.addEventListener('click',()=>{
    try{ if(window.state){ state.cart=[]; } localStorage.setItem('mgv_cart','[]'); if(typeof renderCart==='function'){ renderCart(); } }catch(e){}
  });
  } catch(e){ console.error('Init error', e); }
})();
// Patch_v15_clearCart
(function(){
  const btn=document.getElementById('clearCartBtn'); if(!btn) return;
  btn.addEventListener('click',()=>{
    try{ if(window.state){ state.cart=[]; } localStorage.setItem('mgv_cart','[]'); if(typeof renderCart==='function'){ renderCart(); } }catch(e){}
  });
  } catch(e){ console.error('Init error', e); }
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
  const t = {}; // theme ignored: fixed palette in CSS
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
    const toNumber = (x)=>{
      try{
        const s = String(x ?? "").replace(/[^\d,\.\-]/g, "");
        if(s.includes(",") && s.includes(".")){
          return parseFloat(s.replace(/\./g,"").replace(",", "."));
        }else if(s.includes(",")){
          return parseFloat(s.replace(/\./g,"").replace(",", "."));
        }else{
          return parseFloat(s.replace(/,/g,""));
        }
      }catch(_){ return 0; }
    };
    const money = (n)=> "$ " + Number(n||0).toLocaleString("es-AR");
    const items = cart.map(it=>{
      const nm = it.nombre || it.name || it.title || "Producto";
      const qty = Number(it.cant ?? it.qty ?? 1);
      const unit = toNumber(it.precio ?? it.price ?? 0);
      const sub = unit * qty;
      return `• ${nm} ×${qty} — ${money(sub)}`;
    });
    const total = cart.reduce((acc, it)=> acc + (toNumber(it.precio ?? it.price ?? 0) * Number(it.cant ?? it.qty ?? 1)), 0);
    const lines = [
      `Pedido de: ${name}`,
      preHeader,
      "Hola, quiero hacer un pedido:",
      ...items,
      "",
      `Total: ${money(total)}`
    ];
    const text = lines.join("\n");
    const url = "https://wa.me/" + encodeURIComponent(number) + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
    state.cart = [];
    localStorage.setItem("mgv_cart", JSON.stringify(state.cart));
    if(typeof renderCart === "function"){ renderCart(); }
    const panel = document.getElementById("cartPanel"); if(panel) panel.style.display = "none";
  }catch(err){ console.error(err); }
};

(async function(){
  /* SAFE_RENDER_GUARD */
  try {
  await loadData();
  renderCategories();
  renderBanners();
  renderProducts();
  renderCart();
  } catch(e){ console.error('Init error', e); }
})();


// Patch v17: cart form logic (ship, phone, addr, summary)
(function(){
  const nameEl = document.getElementById('customerName');
  const phoneEl = document.getElementById('customerPhone');
  const addrWrap = document.getElementById('addrWrap');
  const addrEl = document.getElementById('customerAddr');
  const shipInputs = document.querySelectorAll('input[name="ship"]');

  function shipValue(){
    const s=document.querySelector('input[name="ship"]:checked'); return s?s.value:'retiro';
  }
  function phoneDigits(v){ return String(v||'').replace(/[^\d+]/g,''); }

  function validate(){
    let ok=true;
    const name=(nameEl?.value||'').trim();
    const phone=phoneDigits(phoneEl?.value||'');
    const isEnvio = shipValue()==='envio';
    const addr=(addrEl?.value||'').trim();

    const errN=document.getElementById('errName'), errP=document.getElementById('errPhone'), errA=document.getElementById('errAddr');
    if(errN) errN.textContent='';
    if(errP) errP.textContent='';
    if(errA) errA.textContent='';

    if(!name){ if(errN) errN.textContent='Ingresá tu nombre.'; ok=false; }
    if(phone.length<8){ if(errP) errP.textContent='Ingresá tu WhatsApp (mín. 8 dígitos).'; ok=false; }
    if(isEnvio && !addr){ if(errA) errA.textContent='Ingresá tu dirección para envío.'; ok=false; }
    return ok;
  }

  // Toggle address
  function toggleAddr(){
    const isEnvio = shipValue()==='envio';
    if(addrWrap){ addrWrap.hidden = !isEnvio; }
    updateSummary();
  }

  shipInputs.forEach(r=>r.addEventListener('change', toggleAddr));
  if(phoneEl) phoneEl.addEventListener('input', ()=>{ document.getElementById('errPhone')?.textContent=''; });
  if(nameEl) nameEl.addEventListener('input',  ()=>{ document.getElementById('errName')?.textContent=''; });
  if(addrEl) addrEl.addEventListener('input',  ()=>{ document.getElementById('errAddr')?.textContent=''; });

  // Summary values (shipping flat configurable)
  function readShipCost(){
    const cfg = (window.state && state.config && state.config.shipping) ? Number(state.config.shipping)||0 : 0;
    return shipValue()==='envio' ? cfg : 0;
  }
  function updateSummary(){
    try{
      const shipCost = readShipCost();
      const shipRow = document.getElementById('shipRow');
      if(shipRow){ shipRow.hidden = shipCost<=0; }
      const shipEl = document.getElementById('cartSummaryShip');
      if(shipEl){ shipEl.textContent = "$ " + Number(shipCost).toLocaleString("es-AR"); }

      const subtotalEl = document.getElementById('cartSummarySubtotal');
      const totalEl = document.getElementById('cartTotal');

      let subtotal=0;
      const cart = (Array.isArray(state?.cart) ? state.cart : JSON.parse(localStorage.getItem("mgv_cart")||"[]")) || [];
      cart.forEach(it=>{ const q=Number(it.cant||it.qty||1), u=Number(it.precio||it.price||0); subtotal += q*u; });

      if(subtotalEl){ subtotalEl.textContent = "$ " + Number(subtotal).toLocaleString("es-AR"); }
      if(totalEl){ totalEl.textContent = "$ " + Number(subtotal + shipCost).toLocaleString("es-AR"); }
    }catch(e){}
  }

  updateSummary(); toggleAddr();

  // Enhance checkout to validate fields + include shipping & address
  const btn = document.getElementById('checkoutBtn');
  if(btn){
    const old = btn.onclick;
    btn.onclick = ()=>{
      if(!validate()) return;
      if(typeof old === 'function') old();
    };
  }
  } catch(e){ console.error('Init error', e); }
})();
// MGV_FAVS: simple favorites by product id/name
(function(){
  const KEY='mgv_favs_v1';
  const getFavs=()=>{ try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]} };
  const setFavs=(l)=>localStorage.setItem(KEY,JSON.stringify(l));

  function toggleFav(name){
    const favs=new Set(getFavs());
    if(favs.has(name)) favs.delete(name); else favs.add(name);
    setFavs([...favs]);
  }

  // Decorate grid after render
  const grid=document.getElementById('productGrid');
  const obs=new MutationObserver(()=>{
    const favs=new Set(getFavs());
    grid.querySelectorAll('.card').forEach(card=>{
      if(card.__favDecorated) return; card.__favDecorated=true;
      const title = card.querySelector('.name')?.textContent?.trim() || '';
      const btn = document.createElement('button');
      btn.className='heart'; btn.type='button'; btn.setAttribute('aria-label','Favorito');
      btn.textContent='❤';
      if(favs.has(title)) btn.classList.add('active');
      btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleFav(title); btn.classList.toggle('active'); });
      const media = card.querySelector('.media') || card;
      media.style.position='relative';
      media.appendChild(btn);
    });
  });
  obs.observe(grid, {childList:true, subtree:true});
  } catch(e){ console.error('Init error', e); }
})();