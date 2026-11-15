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
// Data diisi dari Supabase (lihat db.js)
const state = { ingredients: [], orders: [], reviews: [] };
let busy = false; // mencegah klik ganda saat menunggu server
let loginError = "";
const app = document.querySelector("#app");
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
  return recipe(item).every((r) => ing(r.id) && ing(r.id).stock >= r.qty);
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
    !recipe(item).every((r) => ing(r.id) && ing(r.id).stock >= r.qty * (item.qty + 1))
  ) {
    alert("Stok tidak cukup untuk menambah pesanan ini.");
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((x) => x.key !== key);
  render();
}
async function makeOrder(method) {
  if (busy) return;
  busy = true;
  render();
  try {
    const items = cart.map((x) => ({ id: x.id, sauce: x.sauce, carb: x.carb, qty: x.qty }));
    const { data, error } = await sb.rpc("place_order", { p_items: items, p_method: method });
    if (error) throw error;
    cart = [];
    modal = { type: "success", order: orderFromDb(data) };
  } catch (e) {
    alert("Pesanan gagal dibuat: " + niceError(e));
  }
  busy = false;
  render();
}
async function ownerAction(fn, args) {
  if (busy) return;
  busy = true;
  render();
  const { error } = await sb.rpc(fn, args);
  busy = false;
  if (error) alert("Gagal: " + niceError(error));
  render(); // perubahan data datang lewat realtime
}
const confirmCash = (id) => ownerAction("confirm_cash", { p_id: id });
const changeStatus = (id, status) => ownerAction("set_order_status", { p_id: id, p_status: status });
function addStock(id, value) {
  const qty = Number(value || 0);
  if (!(qty > 0)) return alert("Isi jumlah restok terlebih dahulu.");
  ownerAction("restock", { p_id: id, p_qty: qty });
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
  return `<header class="topbar"><div class="brand"><img class="brand-logo" src="assets/logo-chic-kampus.jpg" alt="Logo Chic Kampus"><div>CHIC <span>KAMPUS</span></div></div><nav class="mode-switch" aria-label="Mode demo"><button class="${screen === "kiosk" ? "active" : ""}" onclick="setScreen('kiosk')">Kiosk pelanggan</button><button class="${screen === "owner" ? "active" : ""}" onclick="setScreen('owner')">Dashboard owner</button>${db.session ? `<button class="logout" onclick="doLogout()" title="Keluar dari akun owner">Keluar</button>` : ""}</nav></header>`;
}
function kiosk() {
  return `<main class="kiosk"><div class="kiosk-grid"><section><div class="hero"><div class="eyebrow">Self-service ordering</div><h1>Pilih menu favoritmu.</h1><p>Pesan cepat, ambil nomor antrean, lalu kami siapkan pesananmu.</p><button class="btn btn-outline review-cta" onclick="openReview()">★ Beri ulasan${db.rating.count ? ` · rating ${avgRating()} dari ${db.rating.count.toLocaleString("id-ID")} pelanggan` : ""}</button></div><div class="menu-grid">${menus.map((m) => `<article class="menu-card"><div class="menu-visual">${m.icon}</div><h3>${m.name}</h3><p>${m.description}</p><div class="price">Mulai ${money(m.price)}</div><br><button class="btn btn-primary" onclick="addMenuById('${m.id}')">Pilih menu</button></article>`).join("")}</div></section>${cartView()}</div></main>`;
}
function cartView() {
  return `<aside class="cart"><h2>Pesananmu</h2><p class="cart-sub">Periksa sebelum lanjut pembayaran.</p>${cart.length ? cart.map((i) => `<div class="cart-item"><div class="cart-title"><span>${i.name}</span><span>${money(i.price * i.qty)}</span></div><div class="cart-detail">${sauces.find((s) => s.id === i.sauce).name} · ${carbs.find((c) => c.id === i.carb).name}</div><div class="qty-row"><div class="qty"><button aria-label="Kurangi" onclick="adjust('${i.key}',-1)">−</button><b>${i.qty}</b><button aria-label="Tambah" onclick="adjust('${i.key}',1)">+</button></div><button class="btn btn-danger" onclick="adjust('${i.key}',-${i.qty})">Hapus</button></div></div>`).join("") : `<div class="cart-empty">Keranjang masih kosong.<br>Pilih menu untuk memulai.</div>`}<div class="cart-total"><span>Total</span><span>${money(cartTotal())}</span></div><button class="btn btn-primary" ${cart.length ? "" : "disabled"} onclick="openCheckout()">Lanjut pembayaran</button></aside>`;
}
function loginView() {
  return `<main class="owner"><section class="panel login-card"><div class="eyebrow">Owner center</div><h2>Masuk sebagai owner</h2><p class="hint">Dashboard berisi data penjualan, jadi hanya owner yang boleh masuk.</p><form onsubmit="doLogin(event)"><label class="field">Email<input class="input" id="login-email" type="email" autocomplete="username" required></label><label class="field">Password<input class="input" id="login-pass" type="password" autocomplete="current-password" required></label>${loginError ? `<div class="form-error">${esc(loginError)}</div>` : ""}<button class="btn btn-primary full" ${busy ? "disabled" : ""}>${busy ? "Memeriksa…" : "Masuk"}</button></form></section></main>`;
}
function owner() {
  if (!db.session) return loginView();
  if (!db.isOwner)
    return `<main class="owner"><section class="panel login-card"><h2>Akun ini bukan owner</h2><p class="hint">Akun <b>${esc(db.session.user.email)}</b> belum terdaftar sebagai owner Chic Kampus.</p><button class="btn btn-outline full" onclick="doLogout()">Keluar</button></section></main>`;
  if (!db.ownerLoaded)
    return `<main class="owner"><div class="loading">Memuat data penjualan…</div></main>`;
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
  return db.rating.count ? db.rating.avg.toFixed(1).replace(".", ",") : "–";
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
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="eyebrow">Pembayaran</div><h2>Pilih metode pembayaran</h2><p>Total pesananmu <b>${money(cartTotal())}</b>.</p><div class="choice-grid"><button class="choice ${modal.method === "qris" ? "active" : ""}" onclick="choosePay('qris')">QRIS<br><small>Scan kode QR</small></button><button class="choice ${modal.method === "cash" ? "active" : ""}" onclick="choosePay('cash')">Tunai<br><small>Bayar ke owner</small></button></div><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Kembali</button><button class="btn btn-primary" ${busy ? "disabled" : ""} onclick="makeOrder('${modal.method}')">${busy ? "Memproses…" : modal.method === "cash" ? "Buat pesanan" : "Bayar dengan QRIS"}</button></div></section></div>`;
  if (modal.type === "review") {
    const r = modal.rating;
    const labels = ["", "Kecewa", "Kurang", "Cukup", "Puas", "Sangat puas"];
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="eyebrow">Ulasan pelanggan</div><h2>Bagaimana pengalamanmu?</h2><p>Penilaianmu membantu Chic Kampus jadi lebih baik.</p><div class="star-picker" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((k) => `<button role="radio" aria-checked="${r === k}" aria-label="${k} bintang" class="${k <= r ? "on" : ""}" onclick="setRating(${k})">★</button>`).join("")}<span class="star-text">${labels[r] || "Pilih bintang"}</span></div><label class="field">Nama (opsional)<input class="input" maxlength="30" value="${esc(modal.name)}" oninput="modal.name=this.value" placeholder="Contoh: Rizky"></label><label class="field">Nomor pesanan (opsional)<input class="input" type="number" value="${esc(modal.orderId)}" oninput="modal.orderId=this.value" placeholder="Lihat di struk / layar pesanan"></label><label class="field">Komentar<textarea class="input" rows="3" maxlength="240" oninput="modal.comment=this.value" placeholder="Ceritakan rasa, porsi, atau pelayanannya…">${esc(modal.comment)}</textarea></label><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" ${r && !busy ? "" : "disabled"} onclick="submitReview()">${busy ? "Mengirim…" : "Kirim ulasan"}</button></div></section></div>`;
  }
  if (modal.type === "thanks")
    return `<div class="modal-backdrop"><section class="modal"><div class="success"><div class="check">★</div><div class="eyebrow">Ulasan terkirim</div><h2>Terima kasih atas ulasanmu!</h2><p>Sampai jumpa lagi di Chic Kampus.</p><button class="btn btn-primary" onclick="closeModal()">Selesai</button></div></section></div>`;
  const o = modal.order;
  return `<div class="modal-backdrop"><section class="modal"><div class="success"><div class="check">✓</div><div class="eyebrow">Pesanan berhasil dibuat</div><div class="order-number">#${o.id}</div><h2>${o.method === "cash" ? "Silakan bayar di kasir" : "Pembayaran QRIS berhasil"}</h2><p>${o.method === "cash" ? "Pesanan mulai diproses setelah owner mengonfirmasi pembayaran tunai." : "Pesananmu sedang masuk ke antrean dapur."}</p><div class="ticket-note">Tunjukkan nomor pesanan ini saat mengambil makanan.</div><br><div class="modal-actions"><button class="btn btn-outline" onclick="openReview(${o.id})">Beri ulasan</button><button class="btn btn-primary" onclick="closeModal()">Selesai</button></div></div></section></div>`;
}
function render() {
  const banner = db.error ? `<div class="net-error">${esc(db.error)} <button class="btn btn-outline" onclick="location.reload()">Muat ulang</button></div>` : "";
  if (!db.ready && !db.error) {
    app.innerHTML = `<div class="app">${topbar()}<div class="loading">Menghubungkan ke server…</div></div>`;
    return;
  }
  app.innerHTML = `<div class="app">${topbar()}${banner}${screen === "kiosk" ? kiosk() : owner()}${modalView()}</div>`;
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
window.submitReview = async () => {
  if (busy) return;
  busy = true;
  render();
  const { error } = await sb.rpc("submit_review", {
    p_name: modal.name || "",
    p_rating: modal.rating,
    p_comment: modal.comment || "",
    p_order_id: modal.orderId ? Number(modal.orderId) : null,
  });
  busy = false;
  if (error) {
    alert("Ulasan gagal dikirim: " + niceError(error));
    render();
    return;
  }
  modal = { type: "thanks" };
  await loadRating();
  render();
};
window.doLogin = async (ev) => {
  ev.preventDefault();
  loginError = "";
  busy = true;
  render();
  const email = ev.target.querySelector("#login-email")?.value || "";
  const pass = ev.target.querySelector("#login-pass")?.value || "";
  try {
    await login(email.trim(), pass);
  } catch (e) {
    loginError = niceError(e);
  }
  busy = false;
  render();
};
window.doLogout = async () => {
  await logout();
  screen = "kiosk";
  render();
};
window.confirmCash = confirmCash;
window.changeStatus = changeStatus;
window.restock = (id) =>
  addStock(id, document.querySelector(`#stock-${id}`).value);
window.seedDemoOrder = () =>
  ownerAction("place_order", {
    p_items: [{ id: "medium", sauce: "classic", carb: "rice", qty: 1 }],
    p_method: "qris",
  });
render();
initDb();
