// ================================
//  CAFETERIA POS - CLOUD SERVER
//  PostgreSQL + Render Ready
// ================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

// -------------------------------
// CONFIG
// -------------------------------

const PORT = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// -------------------------------
// INIT APP
// -------------------------------

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// -------------------------------
// INIT DATABASE
// -------------------------------

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      stock INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      total NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER REFERENCES sales(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER,
      price NUMERIC
    );
  `);

  console.log("✅ Base de datos lista (Postgres)");
}

initDB();

// -------------------------------
// PRODUCTS
// -------------------------------

// Obtener
app.get("/api/products", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM products ORDER BY id DESC"
  );

  res.json(result.rows);
});

// Crear
app.post("/api/products", async (req, res) => {
  const { name, price, stock } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  const result = await pool.query(
    `
    INSERT INTO products (name, price, stock)
    VALUES ($1,$2,$3)
    RETURNING id
    `,
    [name, price, stock || 0]
  );

  res.json({ id: result.rows[0].id });
});

// Actualizar
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, price, stock } = req.body;

  await pool.query(
    `
    UPDATE products
    SET name=$1, price=$2, stock=$3
    WHERE id=$4
    `,
    [name, price, stock, id]
  );

  res.json({ success: true });
});

// Borrar
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query(
    "DELETE FROM products WHERE id=$1",
    [id]
  );

  res.json({ success: true });
});

// -------------------------------
// SALES
// -------------------------------

// Crear venta
app.post("/api/sales", async (req, res) => {
  const { items, total } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: "Sin productos" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sale = await client.query(
      "INSERT INTO sales (total) VALUES ($1) RETURNING id",
      [total]
    );

    const saleId = sale.rows[0].id;

    for (const item of items) {
      await client.query(
        `
        INSERT INTO sale_items
        (sale_id, product_id, quantity, price)
        VALUES ($1,$2,$3,$4)
        `,
        [saleId, item.id, item.quantity, item.price]
      );

      await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id = $2
        `,
        [item.quantity, item.id]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error(err);

    res.status(500).json({ error: "Error en venta" });

  } finally {
    client.release();
  }
});

// Historial
app.get("/api/sales", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM sales ORDER BY id DESC"
  );

  res.json(result.rows);
});

// Reporte
app.get("/api/reports", async (req, res) => {
  const total = await pool.query(
    "SELECT SUM(total) FROM sales"
  );

  const count = await pool.query(
    "SELECT COUNT(*) FROM sales"
  );

  res.json({
    total: total.rows[0].sum || 0,
    ventas: count.rows[0].count || 0,
  });
});

// -------------------------------
// FRONTEND
// -------------------------------

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/index.html")
  );
});

// -------------------------------
// START SERVER
// -------------------------------

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto " + PORT);
});
