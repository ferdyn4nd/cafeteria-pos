// ===============================
// IMPORTS
// ===============================
const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const path = require('path');

// ===============================
// INIT
// ===============================
const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// DB
// ===============================
const db = new Database('./db.sqlite');

// ===============================
// MIDDLEWARE
// ===============================
app.use(bodyParser.json());
app.use(express.static('public'));

// ===============================
// CREAR TABLAS
// ===============================
db.prepare(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  price REAL,
  stock INTEGER
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total REAL,
  payment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER,
  product_id INTEGER,
  qty INTEGER,
  price REAL
)
`).run();

// ===============================
// API MENU
// ===============================
app.get('/api/menu', (req, res) => {

  const products = db
    .prepare('SELECT * FROM products')
    .all();

  res.json(products);
});

// ===============================
// AGREGAR PRODUCTO
// ===============================
app.post('/api/product/add', (req, res) => {

  const { name, price, stock } = req.body;

  if (!name || price == null || stock == null) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  db.prepare(`
    INSERT INTO products (name, price, stock)
    VALUES (?,?,?)
  `).run(name, price, stock);

  res.json({ success: true });
});

// ===============================
// EDITAR PRODUCTO
// ===============================
app.post('/api/product/edit', (req, res) => {

  const { id, name, price } = req.body;

  db.prepare(`
    UPDATE products
    SET name=?, price=?
    WHERE id=?
  `).run(name, price, id);

  res.json({ success: true });
});

// ===============================
// AGREGAR STOCK
// ===============================
app.post('/api/stock/add', (req, res) => {

  const { id, amount } = req.body;

  if (!id || !amount) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  db.prepare(`
    UPDATE products
    SET stock = stock + ?
    WHERE id = ?
  `).run(amount, id);

  res.json({ success: true });
});

// ===============================
// VENTA
// ===============================
app.post('/api/sale', (req, res) => {

  const { items, payment } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Orden vacía' });
  }

  // VALIDAR STOCK
  for (const item of items) {

    const p = db
      .prepare('SELECT stock FROM products WHERE id=?')
      .get(item.id);

    if (!p || p.stock < item.qty) {
      return res.status(400).json({
        error: `Stock insuficiente: ${item.name}`
      });
    }
  }

  // CALCULAR TOTAL
  let total = 0;

  items.forEach(i => {
    total += i.price * i.qty;
  });

  // REGISTRAR VENTA
  const sale = db.prepare(`
    INSERT INTO sales (total, payment)
    VALUES (?,?)
  `).run(total, payment);

  const saleId = sale.lastInsertRowid;

  // GUARDAR ITEMS + DESCONTAR
  const insertItem = db.prepare(`
    INSERT INTO sale_items
    (sale_id, product_id, qty, price)
    VALUES (?,?,?,?)
  `);

  const discount = db.prepare(`
    UPDATE products
    SET stock = stock - ?
    WHERE id = ?
  `);

  items.forEach(item => {

    insertItem.run(
      saleId,
      item.id,
      item.qty,
      item.price
    );

    discount.run(item.qty, item.id);
  });

  res.json({
    success: true,
    total
  });
});

// ===============================
// REPORTES
// ===============================
app.get('/api/reports', (req, res) => {

  const today = db.prepare(`
    SELECT IFNULL(SUM(total),0) total
    FROM sales
    WHERE DATE(created_at)=DATE('now')
  `).get().total;

  const week = db.prepare(`
    SELECT IFNULL(SUM(total),0) total
    FROM sales
    WHERE DATE(created_at)>=DATE('now','-6 days')
  `).get().total;

  const month = db.prepare(`
    SELECT IFNULL(SUM(total),0) total
    FROM sales
    WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')
  `).get().total;
app.get('/api/sales', (req, res) => {

  const sales = db.prepare(`
    SELECT * FROM sales
    ORDER BY created_at DESC
  `).all();

  res.json(sales);
});
app.get('/api/corte', (req, res) => {

  const data = db.prepare(`
    SELECT 
      COUNT(*) as totalVentas,
      IFNULL(SUM(total),0) as totalDinero
    FROM sales
    WHERE DATE(created_at)=DATE('now')
  `).get();

  res.json(data);
});

  res.json({ today, week, month });
});

// ===============================
// FRONTEND
// ===============================
app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../public/index.html')
  );
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
  console.log('Servidor en http://localhost:' + PORT);
});