const money = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const dateText = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());
const seed = {
  ingredients: [
    {
      id: "chicken",
      name: "Ayam",
      unit: "porsi dasar",
      stock: 40,
      initial: 40,
      cost: 6500,
    },
    {
      id: "classic",
      name: "Saus Classic Cheese",
      unit: "takaran",
      stock: 20,
      initial: 20,
      cost: 1000,
    },
    {
      id: "mushroom",
      name: "Saus Magic Mushroom",
      unit: "takaran",
      stock: 20,
      initial: 20,
      cost: 1100,
    },
    {
      id: "lava",
      name: "Saus Hot Lava",
      unit: "takaran",
      stock: 20,
      initial: 20,
      cost: 1000,
    },
    {
      id: "thunder",
      name: "Saus Black Thunder",
      unit: "takaran",
      stock: 20,
      initial: 20,
      cost: 1100,
    },
    {
      id: "rice",
      name: "Nasi",
      unit: "porsi",
      stock: 40,
      initial: 40,
      cost: 1500,
    },
    {
      id: "fries",
      name: "Kentang",
      unit: "porsi",
      stock: 30,
      initial: 30,
      cost: 2500,
    },
    {
      id: "packaging",
      name: "Kemasan",
      unit: "pcs",
      stock: 50,
      initial: 50,
      cost: 700,
    },
  ],
  orders: [],
  nextOrder: 101,
};
let cart = [];
let screen = "kiosk";
let ownerTab = "orders";
let modal = null;
const menus = [
  {
    id: "small",
    name: "CK Steak Small",
    price: 15000,
    icon: "🍗",
    description: "Porsi hemat untuk jeda kuliah.",
    factor: 1,
  },
  {
    id: "medium",
    name: "CK Steak Medium",
    price: 17000,
    icon: "🍗",
    description: "Porsi pas untuk makan siang.",
    factor: 1.2,
  },
  {
    id: "large",
    name: "CK Steak Large",
    price: 22000,
    icon: "🍗",
    description: "Porsi besar, lebih mengenyangkan.",
    factor: 1.5,
  },
];
const sauces = [
  { id: "classic", name: "Classic Cheese" },
  { id: "mushroom", name: "Magic Mushroom" },
  { id: "lava", name: "Hot Lava" },
  { id: "thunder", name: "Black Thunder" },
];
const carbs = [
  { id: "rice", name: "Nasi" },
  { id: "fries", name: "Kentang" },
];
const STORE_KEY = "chic-kampus-state";
function loadState() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch {}
  s = s || structuredClone(seed);
  s.reviews ||= [];
  if (!s.demoSeeded) seedDemoHistory(s); // isi riwayat & ulasan contoh sekali saja
  return s;
}
let state = loadState();
save();
const app = document.querySelector("#app");
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Gagal menyimpan data", e);
  }
}
function ing(id) {
  return state.ingredients.find((x) => x.id === id);
}
function recipe(item) {
  return [
    { id: "chicken", qty: item.factor },
    { id: item.sauce, qty: item.factor },
    { id: item.carb, qty: item.factor },
    { id: "packaging", qty: 1 },
  ];
}
function recipeCost(item) {
  return recipe(item).reduce((n, r) => n + ing(r.id).cost * r.qty, 0);
}
function available(item) {
  return recipe(item).every((r) => ing(r.id).stock >= r.qty);
}
function cartTotal() {
  return cart.reduce((n, x) => n + x.price * x.qty, 0);
}
function orderSummary(order) {
  return order.items
    .map(
      (x) =>
        `${x.qty}× ${x.name} (${sauces.find((s) => s.id === x.sauce).name}, ${carbs.find((c) => c.id === x.carb).name})`,
    )
    .join("<br>");
}
function addMenu(menu) {
  modal = { type: "customize", menu, sauce: "classic", carb: "rice" };
  render();
}
function addConfigured() {
  const { menu, sauce, carb } = modal;
  const item = {
    ...menu,
    sauce,
    carb,
    qty: 1,
    key: `${menu.id}-${sauce}-${carb}`,
  };
  if (!available(item)) {
    alert("Bahan untuk pilihan ini sedang tidak mencukupi.");
    return;
  }
  const old = cart.find((x) => x.key === item.key);
  old ? old.qty++ : cart.push(item);
  modal = null;
  render();
}
function adjust(key, delta) {
  const item = cart.find((x) => x.key === key);
  if (!item) return;
  if (
    delta > 0 &&
    !recipe(item).every((r) => ing(r.id).stock >= r.qty * (item.qty + 1))
  ) {
    alert("Stok tidak cukup untuk menambah pesanan ini.");
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((x) => x.key !== key);
  render();
}
function deduct(order) {
  order.items.forEach((item) =>
    recipe(item).forEach(
      (r) =>
        (ing(r.id).stock = Math.max(0, ing(r.id).stock - r.qty * item.qty)),
    ),
  );
  order.stockApplied = true;
}
function makeOrder(method) {
  const order = {
    id: state.nextOrder++,
    createdAt: new Date().toISOString(),
    items: structuredClone(cart),
    total: cartTotal(),
    method,
    payment: method === "cash" ? "waiting" : "paid",
    status: method === "cash" ? "waiting" : "processing",
    stockApplied: false,
  };
  if (method === "qris") deduct(order);
  state.orders.unshift(order);
  cart = [];
  save();
  modal = { type: "success", order };
  render();
}
function confirmCash(id) {
  const order = state.orders.find((o) => o.id === id);
  order.payment = "paid";
  order.status = "processing";
  deduct(order);
  save();
  render();
}
function changeStatus(id, status) {
  const order = state.orders.find((o) => o.id === id);
  order.status = status;
  save();
  render();
}
function addStock(id, value) {
  const item = ing(id);
  item.stock += Number(value || 0);
  item.initial = Math.max(item.initial, item.stock);
  save();
  render();
}
function paidOrders(from, to) {
  return state.orders.filter((o) => {
    if (o.payment !== "paid") return false;
    const t = Date.parse(o.createdAt);
    return t >= +from && t < +to;
  });
}
// Default: hari ini saja
function finance(from = startOfDay(new Date()), to = addDays(startOfDay(new Date()), 1)) {
  const orders = paidOrders(from, to);
  const revenue = orders.reduce((n, o) => n + o.total, 0);
  const cogs = orders.reduce(
    (n, o) => n + o.items.reduce((a, i) => a + recipeCost(i) * i.qty, 0),
    0,
  );
  return {
    revenue,
    cogs,
    profit: revenue - cogs,
    transactions: orders.length,
    cash: orders
      .filter((o) => o.method === "cash")
      .reduce((n, o) => n + o.total, 0),
    qris: orders
      .filter((o) => o.method === "qris")
      .reduce((n, o) => n + o.total, 0),
  };
}
function topbar() {
  return `<header class="topbar"><div class="brand"><img class="brand-logo" src="assets/logo-chic-kampus.jpg" alt="Logo Chic Kampus"><div>CHIC <span>KAMPUS</span></div></div><nav class="mode-switch" aria-label="Mode demo"><button class="${screen === "kiosk" ? "active" : ""}" onclick="setScreen('kiosk')">Kiosk pelanggan</button><button class="${screen === "owner" ? "active" : ""}" onclick="setScreen('owner')">Dashboard owner</button></nav></header>`;
}
function kiosk() {
  return `<main class="kiosk"><div class="kiosk-grid"><section><div class="hero"><div class="eyebrow">Self-service ordering</div><h1>Pilih menu favoritmu.</h1><p>Pesan cepat, ambil nomor antrean, lalu kami siapkan pesananmu.</p><button class="btn btn-outline review-cta" onclick="openReview()">★ Beri ulasan · rating ${avgRating()} dari ${(state.reviews || []).length} pelanggan</button></div><div class="menu-grid">${menus.map((m) => `<article class="menu-card"><div class="menu-visual">${m.icon}</div><h3>${m.name}</h3><p>${m.description}</p><div class="price">Mulai ${money(m.price)}</div><br><button class="btn btn-primary" onclick="addMenuById('${m.id}')">Pilih menu</button></article>`).join("")}</div></section>${cartView()}</div></main>`;
}
function cartView() {
  return `<aside class="cart"><h2>Pesananmu</h2><p class="cart-sub">Periksa sebelum lanjut pembayaran.</p>${cart.length ? cart.map((i) => `<div class="cart-item"><div class="cart-title"><span>${i.name}</span><span>${money(i.price * i.qty)}</span></div><div class="cart-detail">${sauces.find((s) => s.id === i.sauce).name} · ${carbs.find((c) => c.id === i.carb).name}</div><div class="qty-row"><div class="qty"><button aria-label="Kurangi" onclick="adjust('${i.key}',-1)">−</button><b>${i.qty}</b><button aria-label="Tambah" onclick="adjust('${i.key}',1)">+</button></div><button class="btn btn-danger" onclick="adjust('${i.key}',-${i.qty})">Hapus</button></div></div>`).join("") : `<div class="cart-empty">Keranjang masih kosong.<br>Pilih menu untuk memulai.</div>`}<div class="cart-total"><span>Total</span><span>${money(cartTotal())}</span></div><button class="btn btn-primary" ${cart.length ? "" : "disabled"} onclick="openCheckout()">Lanjut pembayaran</button></aside>`;
}
function owner() {
  const f = finance();
  return `<main class="owner"><div class="owner-head"><div><div class="eyebrow">Owner center · ${dateText}</div><h1>Halo, Chic Kampus.</h1><p>Pantau antrean, bahan baku, dan hasil penjualan dari satu tempat.</p></div><div class="tabs"><button class="${ownerTab === "orders" ? "active" : ""}" onclick="setTab('orders')">Pesanan aktif</button><button class="${ownerTab === "stock" ? "active" : ""}" onclick="setTab('stock')">Stok bahan</button><button class="${ownerTab === "finance" ? "active" : ""}" onclick="setTab('finance')">Keuangan</button><button class="${ownerTab === "report" ? "active" : ""}" onclick="setTab('report')">Laporan</button><button class="${ownerTab === "recap" ? "active" : ""}" onclick="setTab('recap')">Rekap penjualan</button><button class="${ownerTab === "reviews" ? "active" : ""}" onclick="setTab('reviews')">Ulasan</button></div></div><section class="metrics"><div class="metric"><div class="metric-label">Omzet hari ini</div><div class="metric-value">${money(f.revenue)}</div></div><div class="metric"><div class="metric-label">Transaksi berhasil</div><div class="metric-value">${f.transactions}</div></div><div class="metric"><div class="metric-label">Laba kotor estimasi</div><div class="metric-value positive">${money(f.profit)}</div></div><div class="metric"><div class="metric-label">Menunggu tunai</div><div class="metric-value">${state.orders.filter((o) => o.payment === "waiting").length}</div></div><div class="metric"><div class="metric-label">Rating pelanggan</div><div class="metric-value"><span class="star-ink">★</span> ${avgRating()}</div></div></section>${ownerContent()}</main>`;
}
function statusLabel(status) {
  return {
    waiting: "Menunggu tunai",
    processing: "Diproses",
    ready: "Siap diambil",
    completed: "Selesai",
  }[status];
}
function avgRating() {
  const r = state.reviews || [];
  return r.length ? (r.reduce((n, x) => n + x.rating, 0) / r.length).toFixed(1).replace(".", ",") : "–";
}
function ownerContent() {
  if (ownerTab === "report") return reportView();
  if (ownerTab === "recap") return recapView();
  if (ownerTab === "reviews") return reviewsView();
  if (ownerTab === "orders") {
    const current = state.orders.filter((o) => o.status !== "completed");
    return `<section class="panel"><div class="panel-head"><div><h2>Antrean pesanan</h2><p class="hint">Pesanan terbaru muncul di sini secara langsung.</p></div><button class="btn btn-outline" onclick="seedDemoOrder()">+ Simulasikan pesanan</button></div><div class="orders">${current.length ? current.map((o) => `<article class="order"><div><div class="order-number-small">#${o.id}</div><span class="pill ${o.status}">${statusLabel(o.status)}</span></div><div class="order-items">${orderSummary(o)}</div><div><b>${money(o.total)}</b><div class="hint">${o.method === "cash" ? "Tunai" : "QRIS"}</div></div><div class="order-actions">${o.payment === "waiting" ? `<button class="btn btn-primary" onclick="confirmCash(${o.id})">Tunai diterima</button>` : ""}${o.status === "processing" ? `<button class="btn btn-outline" onclick="changeStatus(${o.id},'ready')">Tandai siap</button>` : ""}${o.status === "ready" ? `<button class="btn btn-outline" onclick="changeStatus(${o.id},'completed')">Sudah diambil</button>` : ""}</div></article>`).join("") : `<div class="empty-state">Belum ada pesanan aktif. Pesanan dari kiosk akan muncul otomatis di sini.</div>`}</div></section>`;
  }
  if (ownerTab === "stock") {
    return `<section class="panel"><div class="panel-head"><div><h2>Stok bahan baku</h2><p class="hint">Warna merah berarti stok di bawah 25% dari stok awal.</p></div></div><div class="stock-grid">${state.ingredients
      .map((i) => {
        const pct = Math.min(100, (i.stock / i.initial) * 100);
        const low = pct <= 25;
        return `<article class="stock-item"><div class="stock-top"><span>${i.name}</span><span>${i.stock} ${i.unit}</span></div><small>Harga acuan ${money(i.cost)} / ${i.unit}</small><div class="stock-bar"><div class="stock-fill ${low ? "low" : ""}" style="width:${pct}%"></div></div><div class="stock-controls"><span class="${low ? "positive" : ""}">${low ? "Perlu restok" : "Stok aman"}</span><div><input id="stock-${i.id}" type="number" min="1" placeholder="Qty"><button class="btn btn-outline" onclick="restock('${i.id}')">Tambah</button></div></div></article>`;
      })
      .join("")}</div></section>`;
  }
  const f = finance();
  return `<section class="finance-grid"><div class="panel"><div class="panel-head"><div><h2>Ringkasan hari ini</h2><p class="hint">Laporan dihitung dari pembayaran yang sudah terkonfirmasi.</p></div></div><div class="breakdown"><div class="break-row"><span>Omzet</span><b>${money(f.revenue)}</b></div><div class="break-row"><span>Estimasi biaya bahan (HPP)</span><b>${money(f.cogs)}</b></div><div class="break-row"><span>Laba kotor estimasi</span><b class="positive">${money(f.profit)}</b></div><div class="break-row"><span>Jumlah transaksi</span><b>${f.transactions}</b></div></div></div><div class="panel"><div class="panel-head"><h2>Metode pembayaran</h2></div><div class="breakdown"><div class="break-row"><span>QRIS</span><b>${money(f.qris)}</b></div><div class="break-row"><span>Tunai</span><b>${money(f.cash)}</b></div><div class="break-row"><span>Total</span><b>${money(f.revenue)}</b></div></div><p class="hint">Data bahan dan harga merupakan asumsi demo, dan dapat disesuaikan sesuai pembelian aktual.</p></div></section>`;
}
function modalView() {
  if (!modal) return "";
  if (modal.type === "customize") {
    const { menu, sauce, carb } = modal;
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="eyebrow">Sesuaikan pesanan</div><h2>${menu.name} · ${money(menu.price)}</h2><label class="field">Pilih saus<div class="choice-grid">${sauces.map((s) => `<button class="choice ${sauce === s.id ? "active" : ""}" onclick="setChoice('sauce','${s.id}')">${s.name}</button>`).join("")}</div></label><label class="field">Pilih karbo<div class="choice-grid">${carbs.map((c) => `<button class="choice ${carb === c.id ? "active" : ""}" onclick="setChoice('carb','${c.id}')">${c.name}</button>`).join("")}</div></label><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="addConfigured()">Tambah ke pesanan</button></div></section></div>`;
  }
  if (modal.type === "checkout")
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="eyebrow">Pembayaran</div><h2>Pilih metode pembayaran</h2><p>Total pesananmu <b>${money(cartTotal())}</b>.</p><div class="choice-grid"><button class="choice ${modal.method === "qris" ? "active" : ""}" onclick="choosePay('qris')">QRIS<br><small>Scan kode QR</small></button><button class="choice ${modal.method === "cash" ? "active" : ""}" onclick="choosePay('cash')">Tunai<br><small>Bayar ke owner</small></button></div><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Kembali</button><button class="btn btn-primary" onclick="makeOrder('${modal.method}')">${modal.method === "cash" ? "Buat pesanan" : "Bayar dengan QRIS"}</button></div></section></div>`;
  if (modal.type === "review") {
    const r = modal.rating;
    const labels = ["", "Kecewa", "Kurang", "Cukup", "Puas", "Sangat puas"];
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="eyebrow">Ulasan pelanggan</div><h2>Bagaimana pengalamanmu?</h2><p>Penilaianmu membantu Chic Kampus jadi lebih baik.</p><div class="star-picker" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((k) => `<button role="radio" aria-checked="${r === k}" aria-label="${k} bintang" class="${k <= r ? "on" : ""}" onclick="setRating(${k})">★</button>`).join("")}<span class="star-text">${labels[r] || "Pilih bintang"}</span></div><label class="field">Nama (opsional)<input class="input" maxlength="30" value="${esc(modal.name)}" oninput="modal.name=this.value" placeholder="Contoh: Rizky"></label><label class="field">Nomor pesanan (opsional)<input class="input" type="number" value="${esc(modal.orderId)}" oninput="modal.orderId=this.value" placeholder="Contoh: ${state.nextOrder - 1}"></label><label class="field">Komentar<textarea class="input" rows="3" maxlength="240" oninput="modal.comment=this.value" placeholder="Ceritakan rasa, porsi, atau pelayanannya…">${esc(modal.comment)}</textarea></label><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" ${r ? "" : "disabled"} onclick="submitReview()">Kirim ulasan</button></div></section></div>`;
  }
  if (modal.type === "thanks")
    return `<div class="modal-backdrop"><section class="modal"><div class="success"><div class="check">★</div><div class="eyebrow">Ulasan terkirim</div><h2>Terima kasih atas ulasanmu!</h2><p>Sampai jumpa lagi di Chic Kampus.</p><button class="btn btn-primary" onclick="closeModal()">Selesai</button></div></section></div>`;
  const o = modal.order;
  return `<div class="modal-backdrop"><section class="modal"><div class="success"><div class="check">✓</div><div class="eyebrow">Pesanan berhasil dibuat</div><div class="order-number">#${o.id}</div><h2>${o.method === "cash" ? "Silakan bayar di kasir" : "Pembayaran QRIS berhasil"}</h2><p>${o.method === "cash" ? "Pesanan mulai diproses setelah owner mengonfirmasi pembayaran tunai." : "Pesananmu sedang masuk ke antrean dapur."}</p><div class="ticket-note">Tunjukkan nomor pesanan ini saat mengambil makanan.</div><br><div class="modal-actions"><button class="btn btn-outline" onclick="openReview(${o.id})">Beri ulasan</button><button class="btn btn-primary" onclick="closeModal()">Selesai</button></div></div></section></div>`;
}
function render() {
  app.innerHTML = `<div class="app">${topbar()}${screen === "kiosk" ? kiosk() : owner()}${modalView()}</div>`;
}
window.setScreen = (s) => {
  screen = s;
  modal = null;
  render();
};
window.setTab = (t) => {
  ownerTab = t;
  render();
};
window.addMenuById = (id) => addMenu(menus.find((m) => m.id === id));
window.adjust = adjust;
window.setChoice = (k, v) => {
  modal[k] = v;
  render();
};
window.closeModal = () => {
  modal = null;
  render();
};
window.addConfigured = addConfigured;
window.openCheckout = () => {
  modal = { type: "checkout", method: "qris" };
  render();
};
window.choosePay = (m) => {
  modal.method = m;
  render();
};
window.makeOrder = makeOrder;
window.openReview = (orderId = "") => {
  modal = { type: "review", rating: 0, name: "", comment: "", orderId };
  render();
};
window.setRating = (k) => {
  modal.rating = k;
  render();
};
window.submitReview = () => {
  const order = state.orders.find((o) => o.id === Number(modal.orderId));
  state.reviews.unshift({
    id: state.reviews.reduce((n, r) => Math.max(n, r.id), 0) + 1,
    orderId: order ? order.id : null,
    menu: order ? order.items[0].name : "",
    name: (modal.name || "").trim() || "Pelanggan",
    rating: modal.rating,
    comment: (modal.comment || "").trim(),
    createdAt: new Date().toISOString(),
  });
  save();
  modal = { type: "thanks" };
  render();
};
window.confirmCash = confirmCash;
window.changeStatus = changeStatus;
window.restock = (id) =>
  addStock(id, document.querySelector(`#stock-${id}`).value);
window.seedDemoOrder = () => {
  const item = {
    ...menus[1],
    sauce: "classic",
    carb: "rice",
    qty: 1,
    key: "medium-classic-rice",
  };
  if (!available(item)) {
    alert("Stok tidak cukup untuk membuat pesanan contoh.");
    return;
  }
  const order = {
    id: state.nextOrder++,
    createdAt: new Date().toISOString(),
    items: [item],
    total: item.price,
    method: "qris",
    payment: "paid",
    status: "processing",
    stockApplied: false,
  };
  deduct(order);
  state.orders.unshift(order);
  save();
  render();
};
render();
