
const state = {
  products: [],
  banners: [],
  category: "Todos",
  cart: JSON.parse(localStorage.getItem("mgv_cart")||"[]"),
};
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
function money(n){return "$ " + n.toLocaleString("es-AR")}

async function loadData(){
  const [prodRes, banRes] = await Promise.all([
    fetch("data/productos.json?ts="+Date.now()),
    fetch("data/banners.json?ts="+Date.now()),
  ]);
  state.products = await prodRes.json();
  state.banners = await banRes.json();
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
  if(!active.length){wrap.innerHTML = ""; return;}
  wrap.innerHTML = active.map((b,i)=>`
    <article class="banner" style="display:${i===0?"block":"none"}">
      <img src="${b.imagen}" alt="${b.titulo}"/>
      <div class="content">
        <div class="title" style="color:${b.color||'#ffd700'}">${b.titulo}</div>
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
  const grid = $("#productGrid");
  const q = $("#q").value.toLowerCase();
  const items = state.products
    .filter(p=>state.category==="Todos" || p.categoria===state.category)
    .filter(p=>p.nombre.toLowerCase().includes(q)|| (p.descripcion||"").toLowerCase().includes(q));
  grid.innerHTML = items.map(p=>`
    <article class="card">
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
    btn.onclick = ()=> addToCart(btn.dataset.add);
  });
}

function renderCart(){
  const list = $("#cartItems");
  const total = state.cart.reduce((acc,it)=>acc + it.precio*it.cant, 0);
  $("#cartTotal").textContent = money(total);
  $("#cartCount").textContent = state.cart.reduce((a,b)=>a+b.cant,0);
  list.innerHTML = state.cart.map(it=>`
    <div class="cart-item">
      <img src="${it.imagen}" />
      <div class="meta">
        <div class="name">${it.nombre}</div>
        <div class="small">${money(it.precio)} x ${it.cant}</div>
      </div>
      <div>
        <button class="btn" data-q="-1" data-id="${it.id}">-</button>
        <button class="btn" data-q="+1" data-id="${it.id}">+</button>
        <button class="btn" data-del="${it.id}">x</button>
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

$("#cartFab").onclick = ()=> $("#cartPanel").style.display = "flex";
$("#closeCart").onclick = ()=> $("#cartPanel").style.display = "none";
$("#q").oninput = ()=> renderProducts();

$("#checkoutBtn").onclick = async ()=>{
  if(!state.cart.length){ alert("Tu carrito está vacío."); return; }
  const backend = (window.APP_CONFIG||{}).MP_BACKEND_URL;
  if(!backend){
    alert("Para activar el pago con Mercado Pago, configurá MP_BACKEND_URL en app.js y desplegá la función de ejemplo (gratis) incluida en /functions.");
    return;
  }
  try{
    const items = state.cart.map(it=>({
      title: it.nombre, quantity: it.cant, unit_price: it.precio, currency_id: "ARS"
    }));
    const res = await fetch(backend, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ items })});
    const data = await res.json();
    if(data && data.init_point){ window.location.href = data.init_point; }
    else alert("No se pudo iniciar el pago. Revisá la configuración.");
  }catch(err){ console.error(err); alert("Error al iniciar el pago."); }
};

(async function(){
  await loadData();
  renderCategories();
  renderBanners();
  renderProducts();
  renderCart();
})();
