// ================================
// CAFETERIA POS - CLOUD SERVER
// PostgreSQL + Render Ready
// ================================

require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

// ================================
// CONFIG
// ================================
const PORT = process.env.PORT || 10000;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL no encontrada");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ================================
// TEST DB
// ================================
async function testDB() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ DB conectada:", res.rows[0].now);
  } catch (err) {
    console.error("❌ Error DB:", err.message);
  }
}
testDB();

// ================================
// INIT APP
// ================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ================================
// INIT DATABASE
// ================================
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        total NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
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

    console.log("✅ Tablas listas");
  } catch (err) {
    console.error("❌ Error creando tablas:", err.message);
  }
}

initDB().then(async () => {
  const check = await pool.query("SELECT COUNT(*) FROM products");
  if (parseInt(check.rows[0].count) === 0) {
    console.log("⚡ Base vacía, cargando productos iniciales...");
    await pool.query(`
      INSERT INTO products (name, price, stock) VALUES
      ('Café Americano', 30, 20),
      ('Capuchino', 40, 15),
      ('Latte', 45, 10),
      ('Chocolate', 35, 12),
      ('Pan Dulce', 15, 25)
    `);
    console.log("✅ Productos iniciales cargados");
  }
});

// ================================
// PRODUCTS
// ================================
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const result = await pool.query(
      "INSERT INTO products (name, price, stock) VALUES ($1,$2,$3) RETURNING id",
      [name, price, stock || 0]
    );
    res.json({ id: result.rows[0].id });
  } catch {
    res.status(500).json({ error: "Error al crear producto" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    await pool.query(
      "UPDATE products SET name=$1, price=$2, stock=$3 WHERE id=$4",
      [name, price, stock, req.params.id]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error al actualizar" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error al borrar" });
  }
});

// ================================
// CREAR VENTA (CON STOCK BIEN)
// ================================
app.post("/api/sales", async (req, res) => {

  const { items, total } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: "Sin productos" });
  }

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    // 1️⃣ Crear venta
    const sale = await client.query(
      "INSERT INTO sales (total) VALUES ($1) RETURNING id",
      [total]
    );

    const saleId = sale.rows[0].id;

    // 2️⃣ Procesar productos
    for (const item of items) {

      // 🔒 Bloquear producto
      const check = await client.query(
        "SELECT stock FROM products WHERE id = $1 FOR UPDATE",
        [item.id]
      );

      if (check.rows.length === 0) {
        throw new Error("Producto no existe");
      }

      const currentStock = check.rows[0].stock;

      // ❌ Validar stock
      if (currentStock < item.qty) {
        throw new Error("Stock insuficiente");
      }

      // 🧾 Guardar detalle
      await client.query(
        `
        INSERT INTO sale_items
        (sale_id, product_id, quantity, price)
        VALUES ($1,$2,$3,$4)
        `,
        [saleId, item.id, item.qty, item.price]
      );

      // 📦 Descontar bien
      await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id = $2
        `,
        [item.qty, item.id]
      );
    }

    // 3️⃣ Confirmar
    await client.query("COMMIT");

    res.json({ success: true });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("❌ Error venta:", err.message);

    res.status(500).json({
      error: err.message
    });

  } finally {
    client.release();
  }

});

// ================================
// HISTORIAL
// ================================
app.get("/api/sales", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.total, s.created_at,
      json_agg(json_build_object(
        'name', p.name,
        'quantity', si.quantity,
        'price', si.price
      )) AS items
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON p.id = si.product_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Error historial" });
  }
});

// ================================
// REPORTES
// ================================
app.get("/api/reports", async (req, res) => {
  try {
    const today = await pool.query(
      "SELECT COALESCE(SUM(total),0) total FROM sales WHERE DATE(created_at)=CURRENT_DATE"
    );
    const week = await pool.query(
      "SELECT COALESCE(SUM(total),0) total FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"
    );
    const month = await pool.query(
      "SELECT COALESCE(SUM(total),0) total FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"
    );

    res.json({
      today: today.rows[0].total,
      week: week.rows[0].total,
      month: month.rows[0].total,
    });
  } catch {
    res.status(500).json({ error: "Error reportes" });
  }
});

// ================================
// FRONTEND
// ================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ================================
// START SERVER
// ================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
