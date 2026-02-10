// ===============================
// CAFETERIA POS - FRONTEND
// ===============================

// 👉 MISMO DOMINIO (Render)
const API_URL = "";

// ===============================
// STATE
// ===============================
let menu = [];
let order = [];

// ===============================
// INIT
// ===============================
loadMenu();
showMenu();
setInterval(loadMenu, 5000);

// ===============================
// LOAD MENU
// ===============================
async function loadMenu() {
  try {
    const res = await fetch(`${API_URL}/api/products`);
    const data = await res.json();

    // 🔒 Blindar stock null
    menu = data.map(p => ({
      ...p,
      stock: p.stock ?? 0
    }));

    renderMenu();
    renderInventory();
  } catch (err) {
    console.error("Error cargando productos", err);
  }
}


// ===============================
// MENU
// ===============================
function renderMenu() {
  const div = document.getElementById("menu");
  if (!div) return;

  div.innerHTML = "";

  menu.forEach(p => {
    const el = document.createElement("div");

    el.innerHTML = `
      <span>
        <b>${p.name}</b> | $${p.price} |Stock: ${p.stock ?? 0}

      </span>

      <span>
        <button 
          onclick="addToOrder(${p.id})"
          ${p.stock <= 0 ? "disabled" : ""}>
          +
        </button>
      </span>
    `;

    div.appendChild(el);
  });
}

// ===============================
// INVENTORY
// ===============================
function renderInventory() {
  const tb = document.getElementById("inventoryTable");
  if (!tb) return;

  tb.innerHTML = "";

  const header = document.createElement("tr");

  header.innerHTML = `
    <td colspan="4" style="text-align:right; padding:10px;">
      <button onclick="addProduct()">➕ Agregar Producto</button>
    </td>
  `;

  tb.appendChild(header);

  menu.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>$${p.price}</td>
<td>${p.stock ?? 0}</td>

      <td>
        <button onclick="editInv(${p.id})">✏️</button>
        <button onclick="addStock(${p.id})">📦</button>
      </td>
    `;

    tb.appendChild(tr);
  });
}

// ===============================
// NAV / VIEWS
// ===============================
function hideAll() {
  document.querySelectorAll(".panel").forEach(p => {
    p.classList.add("hidden");
  });
}

function showMenu() {
  hideAll();

  document.getElementById("salesView")?.classList.remove("hidden");
  document.getElementById("orderView")?.classList.remove("hidden");
}

function showInventory() {
  hideAll();

  document.getElementById("inventoryView")?.classList.remove("hidden");
}

// 🔥 FALTABAN ESTAS (ERAN EL BUG)

function showSalesHistory() {
  alert("📊 Historial en construcción 😅");
}

function showCorteHoy() {
  alert("💰 Corte del día en construcción 😅");
}

function showReports() {
  hideAll();

  const view = document.getElementById("reportsView");

  if (view) {
    view.classList.remove("hidden");
  } else {
    alert("❌ No existe reportsView");
  }
}

// ===============================
// ORDER
// ===============================
function addToOrder(id) {
  const p = menu.find(x => x.id === id);

  if (!p || p.stock <= 0) return;

  const ex = order.find(x => x.id === id);

  if (ex) {
    ex.qty++;
  } else {
    order.push({ ...p, qty: 1 });
  }

  renderOrder();
}

function renderOrder() {
  const d = document.getElementById("order");
  const t = document.getElementById("total");

  if (!d || !t) return;

  d.innerHTML = "";

  let total = 0;

  order.forEach(i => {
    const sub = i.price * i.qty;
    total += sub;

    const el = document.createElement("div");

    el.innerHTML = `
      ${i.name} x${i.qty} → $${sub}
      <button onclick="removeItem(${i.id})">✕</button>
    `;

    d.appendChild(el);
  });

  t.textContent = "$" + total;
}

function removeItem(id) {
  order = order.filter(x => x.id !== id);
  renderOrder();
}

// ===============================
// INVENTORY ACTIONS
// ===============================
async function editInv(id) {
  const p = menu.find(x => x.id === id);
  if (!p) return;

  const name = prompt("Nombre", p.name);
  const price = parseFloat(prompt("Precio", p.price));
  const stock = parseInt(prompt("Stock", p.stock));

  if (!name || isNaN(price) || isNaN(stock)) return;

  await fetch(`${API_URL}/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, stock })
  });

  loadMenu();
}

async function addStock(id) {
  const amount = parseInt(prompt("Cantidad"));
  if (!amount) return;

  const p = menu.find(x => x.id === id);
  if (!p) return;

  await fetch(`${API_URL}/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: p.name,
      price: p.price,
      stock: p.stock + amount
    })
  });

  loadMenu();
}

// ===============================
// ADD PRODUCT
// ===============================
async function addProduct() {
  const name = prompt("Nombre");
  const price = parseFloat(prompt("Precio"));
  const stock = parseInt(prompt("Stock"));

  if (!name || isNaN(price) || isNaN(stock)) return;

  await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, stock })
  });

  loadMenu();
}

// ===============================
// CHECKOUT
// ===============================
async function checkout() {
  if (!order.length) return;

  const total = order.reduce((s, i) => s + i.price * i.qty, 0);

  await fetch(`${API_URL}/api/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: order, total })
  });

  alert("Venta realizada: $" + total);

  // Limpiar orden
  order = [];
  renderOrder();

  // 🔥 FORZAR recarga real desde servidor
  await loadMenu();
}


// ===============================
// HISTORIAL
// ===============================
async function showSalesHistory() {

  hideAll();

  let view = document.getElementById("reportsView");
  view.classList.remove("hidden");

  view.innerHTML = "<h2>📊 Historial de Ventas</h2>";

  const res = await fetch("/api/sales");
  const data = await res.json();

  if (!data.length) {
    view.innerHTML += "<p>Sin ventas</p>";
    return;
  }

  data.forEach(sale => {

    let html = `
      <div style="border:1px solid #444;padding:10px;margin:10px;">
        <b>Venta #${sale.id}</b><br>
        Fecha: ${new Date(sale.created_at).toLocaleString()}<br>
        Total: $${sale.total}
        <ul>
    `;

    sale.items.forEach(i => {
      html += `
        <li>
          ${i.name} x${i.quantity} → $${i.price * i.quantity}
        </li>
      `;
    });

    html += "</ul></div>";

    view.innerHTML += html;

  });
}


// ===============================
// CORTE DEL DÍA
// ===============================
async function showCorteHoy() {

  const res = await fetch("/api/reports");
  const data = await res.json();

  alert(`
💰 CORTE DE HOY

Total: $${data.today}
  `);

}


// ===============================
// REPORTES
// ===============================
async function showReports() {

  hideAll();

  const res = await fetch("/api/reports");
  const data = await res.json();

  const view = document.getElementById("reportsView");

  view.classList.remove("hidden");

  view.innerHTML = `
    <h2>📈 Reportes</h2>

    <p>Hoy: $${data.today}</p>
    <p>Semana: $${data.week}</p>
    <p>Mes: $${data.month}</p>
  `;
}
