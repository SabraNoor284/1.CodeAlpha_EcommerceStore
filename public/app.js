/* ShopEasy – single page frontend (vanilla JS, hash routing) */
const app = document.getElementById('app');
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  cart: JSON.parse(localStorage.getItem('cart') || '[]'), // [{productId, name, price, image, quantity, stock}]
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n).toFixed(2);

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(url, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(false);
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  renderChrome();
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  renderChrome();
}

function logout(redirect = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  renderChrome();
  if (redirect) location.hash = '#/';
}

function renderChrome() {
  document.getElementById('cart-count').textContent = state.cart.reduce((n, i) => n + i.quantity, 0);
  document.getElementById('auth-links').innerHTML = state.user
    ? `<a href="#/orders">My Orders</a> &nbsp; <span>Hi, ${esc(state.user.name)}</span> &nbsp; <a href="#" id="logout">Logout</a>`
    : `<a href="#/login">Login</a> &nbsp; <a href="#/register">Register</a>`;
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = (e) => { e.preventDefault(); logout(); };
}

function addToCart(p, qty = 1) {
  const existing = state.cart.find((i) => i.productId === p.id);
  const newQty = (existing ? existing.quantity : 0) + qty;
  if (newQty > p.stock) return toast(`Only ${p.stock} in stock`);
  if (existing) existing.quantity = newQty;
  else state.cart.push({ productId: p.id, name: p.name, price: p.price, image: p.image, quantity: qty, stock: p.stock });
  saveCart();
  toast(`${p.name} added to cart`);
}

/* ---------- views ---------- */
async function viewProducts() {
  const cats = await api('/api/categories');
  app.innerHTML = `
    <h1>Products</h1>
    <div class="toolbar">
      <input id="q" placeholder="Search products..." />
      <select id="cat"><option>All</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
    </div>
    <div id="list" class="grid"></div>`;
  const list = document.getElementById('list');
  let timer;
  async function load() {
    const q = document.getElementById('q').value;
    const category = document.getElementById('cat').value;
    const products = await api(`/api/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);
    list.innerHTML = products.length
      ? products.map((p) => `
        <div class="card product">
          <div class="emoji">${esc(p.image)}</div>
          <span class="cat">${esc(p.category)}</span>
          <h3>${esc(p.name)}</h3>
          <div class="price">${money(p.price)}</div>
          ${p.stock <= 5 ? `<div class="stock-low">${p.stock ? 'Only ' + p.stock + ' left' : 'Out of stock'}</div>` : ''}
          <div class="actions">
            <a class="btn secondary" href="#/product/${p.id}">Details</a>
            <button class="btn" data-add="${p.id}" ${p.stock ? '' : 'disabled'}>Add</button>
          </div>
        </div>`).join('')
      : '<div class="empty">No products found.</div>';
    list.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => addToCart(products.find((p) => p.id == b.dataset.add));
    });
  }
  document.getElementById('q').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  document.getElementById('cat').onchange = load;
  load();
}

async function viewProduct(id) {
  const p = await api('/api/products/' + id);
  app.innerHTML = `
    <a href="#/">← Back to products</a><br /><br />
    <div class="detail">
      <div class="emoji">${esc(p.image)}</div>
      <div>
        <span class="cat">${esc(p.category)}</span>
        <h1>${esc(p.name)}</h1>
        <p>${esc(p.description)}</p>
        <div class="price" style="font-size:1.6rem">${money(p.price)}</div>
        <p>${p.stock > 0 ? `<span class="tag">In stock: ${p.stock}</span>` : '<span class="stock-low">Out of stock</span>'}</p>
        <div class="qty"><label>Qty</label><input id="qty" type="number" min="1" max="${p.stock}" value="1" /></div>
        <button class="btn" id="add" ${p.stock ? '' : 'disabled'}>Add to cart</button>
      </div>
    </div>`;
  document.getElementById('add').onclick = () => {
    const qty = Math.max(1, parseInt(document.getElementById('qty').value, 10) || 1);
    addToCart(p, qty);
  };
}

function viewCart() {
  if (!state.cart.length) {
    app.innerHTML = '<h1>Your cart</h1><div class="empty">Your cart is empty. <a href="#/">Browse products</a></div>';
    return;
  }
  const total = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  app.innerHTML = `
    <h1>Your cart</h1>
    <table>
      <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>
        ${state.cart.map((i) => `
          <tr>
            <td>${esc(i.image)} <a href="#/product/${i.productId}">${esc(i.name)}</a></td>
            <td>${money(i.price)}</td>
            <td><input type="number" min="1" max="${i.stock}" value="${i.quantity}" data-qty="${i.productId}" style="width:70px" /></td>
            <td>${money(i.price * i.quantity)}</td>
            <td><button class="btn danger" data-rm="${i.productId}">Remove</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="summary"><strong style="font-size:1.2rem">Total: ${money(total)}</strong>
      <a class="btn" href="#/checkout">Checkout</a></div>`;
  app.querySelectorAll('[data-qty]').forEach((inp) => {
    inp.onchange = () => {
      const item = state.cart.find((i) => i.productId == inp.dataset.qty);
      const q = Math.max(1, Math.min(item.stock, parseInt(inp.value, 10) || 1));
      item.quantity = q;
      saveCart();
      viewCart();
    };
  });
  app.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = () => {
      state.cart = state.cart.filter((i) => i.productId != b.dataset.rm);
      saveCart();
      viewCart();
    };
  });
}

function viewCheckout() {
  if (!state.user) {
    toast('Please login to checkout');
    location.hash = '#/login?next=checkout';
    return;
  }
  if (!state.cart.length) { location.hash = '#/cart'; return; }
  const total = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  app.innerHTML = `
    <h1>Checkout</h1>
    <div class="card" style="margin-bottom:18px">
      ${state.cart.map((i) => `<div>${esc(i.image)} ${esc(i.name)} × ${i.quantity} — ${money(i.price * i.quantity)}</div>`).join('')}
      <hr style="width:100%;border:0;border-top:1px solid var(--border)" />
      <strong>Total: ${money(total)}</strong>
    </div>
    <form class="stack" id="form">
      <label>Full name <input name="name" required value="${esc(state.user.name)}" /></label>
      <label>Shipping address <textarea name="address" rows="3" required></textarea></label>
      <label>Phone <input name="phone" required /></label>
      <div class="error" id="err"></div>
      <button class="btn" type="submit">Place order</button>
    </form>`;
  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await api('/api/orders', {
        method: 'POST',
        body: {
          items: state.cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          shipping: { name: f.get('name'), address: f.get('address'), phone: f.get('phone') },
        },
      });
      state.cart = [];
      saveCart();
      app.innerHTML = `<div class="card"><h1>🎉 Order placed!</h1><p>Your order <strong>#${r.orderId}</strong> total <strong>${money(r.total)}</strong> has been received.</p><a class="btn" href="#/orders">View my orders</a></div>`;
    } catch (err) {
      document.getElementById('err').textContent = err.message;
    }
  };
}

async function viewOrders() {
  if (!state.user) { location.hash = '#/login'; return; }
  const orders = await api('/api/orders');
  app.innerHTML = `<h1>My orders</h1>` + (orders.length
    ? orders.map((o) => `
      <div class="card order">
        <div class="order-head"><strong>Order #${o.id}</strong><span class="tag">${esc(o.status)}</span>
          <span>${esc(new Date(o.created_at + 'Z').toLocaleString())}</span><strong>${money(o.total)}</strong></div>
        ${o.items.map((i) => `<div>${esc(i.name)} × ${i.quantity} — ${money(i.price * i.quantity)}</div>`).join('')}
        <small style="color:var(--muted)">Ship to: ${esc(o.ship_name)}, ${esc(o.ship_address)} (${esc(o.ship_phone)})</small>
      </div>`).join('')
    : '<div class="empty">No orders yet.</div>');
}

function viewAuth(mode) {
  const isReg = mode === 'register';
  app.innerHTML = `
    <h1>${isReg ? 'Create account' : 'Login'}</h1>
    <form class="stack" id="form">
      ${isReg ? '<label>Name <input name="name" required /></label>' : ''}
      <label>Email <input name="email" type="email" required /></label>
      <label>Password <input name="password" type="password" minlength="6" required /></label>
      <div class="error" id="err"></div>
      <button class="btn" type="submit">${isReg ? 'Register' : 'Login'}</button>
      <small>${isReg ? 'Already have an account? <a href="#/login">Login</a>' : 'New here? <a href="#/register">Create an account</a>'}</small>
    </form>`;
  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api(isReg ? '/api/register' : '/api/login', { method: 'POST', body: f });
      setAuth(r.token, r.user);
      toast(isReg ? 'Account created' : 'Welcome back!');
      location.hash = location.hash.includes('next=checkout') ? '#/checkout' : '#/';
    } catch (err) {
      document.getElementById('err').textContent = err.message;
    }
  };
}

/* ---------- router ---------- */
async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [pathPart] = hash.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  try {
    if (!parts.length) await viewProducts();
    else if (parts[0] === 'product') await viewProduct(parts[1]);
    else if (parts[0] === 'cart') viewCart();
    else if (parts[0] === 'checkout') viewCheckout();
    else if (parts[0] === 'orders') await viewOrders();
    else if (parts[0] === 'login') viewAuth('login');
    else if (parts[0] === 'register') viewAuth('register');
    else app.innerHTML = '<div class="empty">Page not found.</div>';
  } catch (err) {
    app.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);
renderChrome();
route();
