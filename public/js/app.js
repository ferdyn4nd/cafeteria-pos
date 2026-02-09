// ===============================
// CONFIG
// ===============================
const API_URL = "https://cafeteria-pos.onrender.com";

let menu = [];
let order = [];

// INIT
loadMenu();
showMenu();
setInterval(loadMenu, 5000);

// ===============================
// LOAD
// ===============================
async function loadMenu() {
  const res = await fetch(`${API_URL}/api/products`);
  menu = await res.json();
  renderMenu();
  renderInventory();
}

// ===============================
// MENU
// ===============================
function renderMenu() {
  const div = document.getElementById("menu");
  div.innerHTML = "";

  menu.forEach((p) => {
    const el = document.createElement("div");

    el.innerHTML = `
      <span>
        <b>${p.name}</b> | $${p.price} | Stock: ${p.stock}
      </span>
      <span>
        <button onclick="addToOrder(${p.id})" ${
      p.stock <= 0 ? "disabled" : ""
    }>+</button>
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
  tb.innerHTML = "";

  const header = document.createElement("tr");

  header.innerHTML = `
    <td colspan="4" style="text-align:right; padding:10px;">
      <button onclick="addProduct()" class="btn agregar">
        ➕ Agregar Producto
      </button>
    </td>
  `;

  tb.appendChild(header);

  menu.forEach((p) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name}</td>
      <td>$${p.price}</td>
      <td>${p.stock}</td>
      <td>
        <button onclick="editInv(${p.id})">✏️</button>
        <button onclick="addStock(${p.id})">📦</button>
      </td>
    `;

    tb.appendChild(tr);
  });
}

// ===============================
// VIEWS
// ===============================
function showMenu() {
  hideAll();
  document.getElementById("salesView").classList.remove("hidden");
  document.getElementById("orderView").classList.remove("hidden");
}

function showInventory() {
  hideAll();
  document.getElementById("inventoryView").classList.remove("hidden");
}

function hideAll() {
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.add("hidden");
  });
}

// ===============================
// ORDER
// ===============================
function addToOrder(id) {
  const p = menu.find((x) => x.id === id);

  if (!p || p.stock <= 0) return;

  const ex = order.find((x) => x.id === id);

  if (ex) ex.qty++;
  else order.push({ ...p, qty: 1 });

  renderOrder();
}

function renderOrder() {
  const d = document.getElementById("order");
  const t = document.getElementById("total");

  d.innerHTML = "";

  let total = 0;

  order.forEach((i) => {
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
  order = order.filter((x) => x.id !== id);
  renderOrder();
}

// ===============================
// INVENTORY ACTIONS
// ===============================
async function editInv(id) {
  const p = menu.find((x) => x.id === id);

  const name = prompt("Nombre", p.name);
  const price = parseFloat(prompt("Precio", p.price));
  const stock = parseInt(prompt("Stock", p.stock));

  if (!name || isNaN(price) || isNaN(stock)) return;

  await fetch(`${API_URL}/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, stock }),
  });

  loadMenu();
}

async function addStock(id) {
  const a = parseInt(prompt("Cantidad"));

  if (!a) return;

  const p = menu.find((x) => x.id === id);

  await fetch(`${API_URL}/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: p.name,
      price: p.price,
      stock: p.stock + a,
    }),
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

  if (!name || isNaN(price) || stock < 0) return;

  await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, stock }),
  });

  loadMenu();
}

// ===============================
// CHECKOUT
// ===============================
async function checkout() {
  if (!order.length) return;

  const total = order.reduce(
    (s, i) => s + i.price * i.qty,
    0
  );

  await fetch(`${API_URL}/api/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: order, total }),
  });

  alert("Venta registrada");

  order = [];
  renderOrder();
  loadMenu();
}

// ===============================
// REPORTES
// ===============================
async function showSalesHistory() {
  const r = await fetch(`${API_URL}/api/sales`);
  const d = await r.json();

  let t = "📊 HISTORIAL\n\n";

  d.forEach((s) => {
    t += `$${s.total} | ${s.created_at}\n`;
  });

  alert(t);
}
