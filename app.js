// ==== Datos demo (si tu backend ya carga productos, podés quitar esto) ====
const PRODUCTS = [
  {id:"p1", name:"Set marcadores flúo x6", desc:"Alta visibilidad y durabilidad.", price:2800, img:"assets/placeholder.svg"},
  {id:"p2", name:"Cuaderno A4", desc:"Rayado 80 hojas.", price:4957, img:"assets/placeholder.svg"},
  {id:"p3", name:"Lápiz HB", desc:"Suave y preciso.", price:1200, img:"assets/placeholder.svg"},
  {id:"p4", name:"Cartuchera", desc:"Colores surtidos.", price:6000, img:"assets/placeholder.svg"},
  {id:"p5", name:"Mochila", desc:"Resistente y liviana.", price:7500, img:"assets/placeholder.svg"},
];

// ==== Helpers ====
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const money = n => `$ ${n.toLocaleString('es-AR')}`;

// ==== Estado Carrito ====
let cart = JSON.parse(localStorage.getItem('mgv_cart') || '[]');

function saveCart(){
  localStorage.setItem('mgv_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge(){
  const qty = cart.reduce((a,b)=>a+b.qty,0);
  $('#cartQty').textContent = qty;
}

// ==== Render catálogo ====
function renderProducts(list){
  const grid = $('#productGrid');
  grid.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__img" style="background-image:url('${p.img}')"></div>
      <div class="card__body">
        <div class="card__title">${p.name}</div>
        <div class="card__desc">${p.desc || ''}</div>
        <div class="card__row">
          <span class="price">${money(p.price)}</span>
          <button class="btn" data-add="${p.id}">Agregar</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ==== Carrito UI ====
function openDrawer(){ $('#cartDrawer').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden','false'); }
function closeDrawer(){ $('#cartDrawer').classList.remove('open'); $('#cartDrawer').setAttribute('aria-hidden','true'); }

function renderCart(){
  const list = $('#cartItems');
  list.innerHTML = '';
  if(cart.length === 0){
    list.innerHTML = `<p class="empty">Tu carrito está vacío.</p>`;
  }else{
    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-item__img"></div>
        <div>
          <div class="cart-item__title">${item.name}</div>
          <div class="cart-item__meta">${item.qty} × ${money(item.price)}</div>
        </div>
        <div>
          <button class="icon-btn" data-dec="${item.id}" aria-label="Quitar uno">−</button>
          <button class="icon-btn" data-inc="${item.id}" aria-label="Agregar uno">+</button>
          <button class="icon-btn" data-del="${item.id}" aria-label="Eliminar">🗑️</button>
        </div>`;
      list.appendChild(row);
    });
  }
  const total = cart.reduce((a,b)=>a + b.qty*b.price, 0);
  $('#cartTotal').textContent = money(total);
}

function clearCart(){
  cart = [];
  saveCart();
  renderCart();
}

// ==== Acciones ====
document.addEventListener('click', (e)=>{
  // add product
  const addId = e.target.closest('[data-add]')?.getAttribute('data-add');
  if(addId){
    const product = PRODUCTS.find(p => p.id === addId);
    const found = cart.find(i => i.id === addId);
    if(found) found.qty += 1;
    else cart.push({id: product.id, name: product.name, price: product.price, qty: 1});
    saveCart();
    renderCart();
    return;
  }

  // cart actions
  const inc = e.target.closest('[data-inc]')?.getAttribute('data-inc');
  if(inc){
    const it = cart.find(i => i.id === inc); if(it){ it.qty += 1; saveCart(); renderCart(); }
    return;
  }
  const dec = e.target.closest('[data-dec]')?.getAttribute('data-dec');
  if(dec){
    const it = cart.find(i => i.id === dec); if(it){ it.qty = Math.max(0, it.qty-1); if(it.qty===0) cart = cart.filter(i=>i.id!==dec); saveCart(); renderCart(); }
    return;
  }
  const del = e.target.closest('[data-del]')?.getAttribute('data-del');
  if(del){
    cart = cart.filter(i => i.id !== del); saveCart(); renderCart(); return;
  }

  if(e.target.id === 'openCartBtn'){ openDrawer(); return; }
  if(e.target.id === 'closeCartBtn'){ closeDrawer(); return; }
  if(e.target.id === 'drawerBackdrop'){ closeDrawer(); return; }
  if(e.target.id === 'clearCartBtn'){ clearCart(); return; }

  if(e.target.id === 'sendOrderBtn'){
    if(cart.length === 0){ alert('Agregá algún producto.'); return; }
    const total = cart.reduce((a,b)=>a + b.qty*b.price, 0);
    const items = cart.map(i => `• ${i.name} ×${i.qty} – ${money(i.price*i.qty)}`).join('%0A');
    const msg = `Hola, quiero hacer un pedido:%0A${items}%0A%0ATotal: ${money(total)}%0A`;
    const url = `https://wa.me/5493412272899?text=${msg}`;
    window.open(url, '_blank');

    // *** Vaciar inmediatamente después de enviar ***
    clearCart();
    closeDrawer();
    return;
  }
});

// ==== Búsqueda ====
$('#searchInput').addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  const filtered = PRODUCTS.filter(p => (p.name + ' ' + (p.desc||'')).toLowerCase().includes(q));
  renderProducts(filtered);
});

// ==== Inicio ====
(function init(){
  renderProducts(PRODUCTS);
  renderCart();
  updateCartBadge();
  $('#year').textContent = new Date().getFullYear();
})();
