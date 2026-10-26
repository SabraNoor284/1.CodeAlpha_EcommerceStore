const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'store.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  ship_name TEXT NOT NULL,
  ship_address TEXT NOT NULL,
  ship_phone TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL
);
`);

// ---- seed products ----
if (db.prepare('SELECT COUNT(*) AS c FROM products').get().c === 0) {
  const ins = db.prepare(
    'INSERT INTO products (name, description, price, category, image, stock) VALUES (?,?,?,?,?,?)'
  );
  const seed = [
    ['Wireless Headphones', 'Over-ear Bluetooth headphones with noise isolation and 30 hours of battery life.', 59.99, 'Electronics', '🎧', 25],
    ['Smart Watch', 'Fitness tracking, heart-rate monitor, notifications and a bright AMOLED display.', 89.5, 'Electronics', '⌚', 15],
    ['Mechanical Keyboard', 'Compact 75% layout with hot-swappable switches and RGB backlight.', 74.0, 'Electronics', '⌨️', 30],
    ['Laptop Backpack', 'Water-resistant 25L backpack with padded laptop sleeve and USB charging port.', 39.99, 'Accessories', '🎒', 40],
    ['Running Shoes', 'Lightweight breathable running shoes with responsive cushioning.', 64.95, 'Fashion', '👟', 20],
    ['Sunglasses', 'Polarized UV400 sunglasses with a durable lightweight frame.', 19.99, 'Fashion', '🕶️', 50],
    ['Coffee Mug Set', 'Set of 4 ceramic mugs, dishwasher and microwave safe.', 24.0, 'Home', '☕', 35],
    ['Desk Lamp', 'LED desk lamp with 5 brightness levels and a flexible neck.', 29.5, 'Home', '💡', 28],
    ['Yoga Mat', 'Non-slip 6mm thick mat with carrying strap.', 22.0, 'Sports', '🧘', 45],
    ['Water Bottle', 'Insulated stainless steel bottle keeps drinks cold for 24 hours.', 17.5, 'Sports', '🧴', 60],
    ['Portable Speaker', 'Waterproof Bluetooth speaker with 12 hours of playtime.', 34.99, 'Electronics', '🔊', 22],
    ['Notebook Pack', 'Pack of 3 hardcover dotted notebooks, 120 pages each.', 12.0, 'Stationery', '📓', 80],
  ];
  seed.forEach((p) => ins.run(...p));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- helpers ----
const signToken = (user) =>
  jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---- auth ----
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email is already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)')
    .run(name.trim(), email.toLowerCase(), hash);
  const user = { id: Number(info.lastInsertRowid), name: name.trim(), email: email.toLowerCase() };
  res.status(201).json({ token: signToken(user), user });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password' });
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: signToken(user), user });
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

// ---- products ----
app.get('/api/products', (req, res) => {
  const { q, category } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY id';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category));
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// ---- orders ----
app.post('/api/orders', auth, (req, res) => {
  const { items, shipping } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  if (!shipping || !shipping.name || !shipping.address || !shipping.phone)
    return res.status(400).json({ error: 'Shipping name, address and phone are required' });

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const lines = [];
  let total = 0;
  for (const it of items) {
    const qty = Number.parseInt(it.quantity, 10);
    const p = getProduct.get(it.productId);
    if (!p) return res.status(400).json({ error: `Product ${it.productId} not found` });
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: `Invalid quantity for ${p.name}` });
    if (qty > p.stock) return res.status(409).json({ error: `Only ${p.stock} left in stock for ${p.name}` });
    lines.push({ p, qty });
    total += p.price * qty;
  }
  total = Math.round(total * 100) / 100;

  db.exec('BEGIN');
  try {
    const o = db
      .prepare('INSERT INTO orders (user_id, total, ship_name, ship_address, ship_phone) VALUES (?,?,?,?,?)')
      .run(req.user.id, total, shipping.name, shipping.address, shipping.phone);
    const orderId = Number(o.lastInsertRowid);
    const insItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)'
    );
    const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const { p, qty } of lines) {
      insItem.run(orderId, p.id, p.name, p.price, qty);
      dec.run(qty, p.id);
    }
    db.exec('COMMIT');
    res.status(201).json({ orderId, total });
  } catch (e) {
    db.exec('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Could not place order' });
  }
});

app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  res.json(orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (require.main === module) {
  app.listen(PORT, () => console.log(`E-commerce store running at http://localhost:${PORT}`));
}
module.exports = app;
