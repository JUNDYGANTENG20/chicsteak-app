// Koneksi ke Supabase: data pesanan, stok, ulasan & login owner tersimpan online.
// Kunci "publishable" memang aman ditaruh di kode frontend: keamanan data dijaga
// oleh Row Level Security & fungsi RPC di database (lihat supabase/schema.sql).

const SUPABASE_URL = "https://sohtggdghnkyvvbavjmz.supabase.co";
const SUPABASE_KEY = "sb_publishable_eozvHoqMaZxbgSawqUcZwg_DNlf1LHy";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Status koneksi & sesi
const db = {
  ready: false, // data dasar (stok, rating) sudah dimuat
  error: "", // pesan error koneksi
  session: null, // sesi login owner
  isOwner: false,
  ownerLoading: false,
  ownerLoaded: false,
  bulk: false, // true saat reset data contoh (abaikan event realtime massal)
  rating: { avg: 0, count: 0 },
};

const orderFromDb = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  items: r.items,
  total: r.total,
  method: r.method,
  payment: r.payment,
  status: r.status,
  demo: r.demo,
});
const reviewFromDb = (r) => ({
  id: r.id,
  orderId: r.order_id,
  name: r.name,
  rating: r.rating,
  comment: r.comment,
  menu: r.menu,
  createdAt: r.created_at,
  demo: r.demo,
});
const ingFromDb = (r) => ({ ...r, stock: Number(r.stock), initial: Number(r.initial) });

// Ambil semua baris (PostgREST membatasi 1000 baris per permintaan)
async function fetchAll(table, map) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...data.map(map));
    if (data.length < 1000) return out;
  }
}

async function loadIngredients() {
  const { data, error } = await sb.from("ingredients").select("*").order("id");
  if (error) throw error;
  // urutkan sesuai tampilan asli
  const order = ["chicken", "classic", "mushroom", "lava", "thunder", "rice", "fries", "packaging"];
  state.ingredients = data.map(ingFromDb).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
async function loadRating() {
  const { data, error } = await sb.rpc("rating_summary");
  if (error) throw error;
  db.rating = { avg: Number(data.avg), count: Number(data.count) };
}
async function loadOwnerData() {
  db.ownerLoading = true;
  render();
  try {
    const [orders, reviews] = await Promise.all([
      fetchAll("orders", orderFromDb),
      fetchAll("reviews", reviewFromDb),
    ]);
    state.orders = orders;
    state.reviews = reviews;
    db.ownerLoaded = true;
  } catch (e) {
    db.error = "Gagal memuat data owner: " + e.message;
  }
  db.ownerLoading = false;
  render();
}
async function checkOwner() {
  db.isOwner = false;
  if (!db.session) return;
  const { data } = await sb.rpc("is_owner");
  db.isOwner = !!data;
}

/* ---------- Realtime: pesanan, ulasan & stok berubah langsung di layar ---------- */
let renderTimer = null;
function softRender() {
  // Jangan ganggu pelanggan yang sedang mengisi form ulasan
  if (modal && modal.type === "review") return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}
function upsertById(list, row) {
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = row;
  else list.unshift(row);
}
function subscribeRealtime() {
  sb.channel("chic-kampus")
    .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, (p) => {
      if (p.new && p.new.id) upsertById(state.ingredients, ingFromDb(p.new));
      softRender();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
      if (db.bulk || !db.ownerLoaded) return;
      if (p.eventType === "DELETE") state.orders = state.orders.filter((o) => o.id !== p.old.id);
      else upsertById(state.orders, orderFromDb(p.new));
      softRender();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, (p) => {
      if (db.bulk || !db.ownerLoaded) return;
      if (p.eventType === "DELETE") state.reviews = state.reviews.filter((r) => r.id !== p.old.id);
      else upsertById(state.reviews, reviewFromDb(p.new));
      loadRating().then(softRender);
    })
    .subscribe();
}

/* ---------- Auth owner ---------- */
async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  db.session = data.session;
  await checkOwner();
  if (db.isOwner) {
    resubscribe();
    await loadOwnerData();
  }
}
async function logout() {
  await sb.auth.signOut();
  db.session = null;
  db.isOwner = false;
  db.ownerLoaded = false;
  state.orders = [];
  state.reviews = [];
  render();
}
// Setelah login, channel realtime perlu dibuat ulang agar memakai token owner (RLS)
function resubscribe() {
  sb.removeAllChannels();
  subscribeRealtime();
}

async function initDb() {
  try {
    const { data } = await sb.auth.getSession();
    db.session = data.session;
    await Promise.all([loadIngredients(), loadRating(), checkOwner()]);
    db.ready = true;
    subscribeRealtime();
    render();
    if (db.isOwner) await loadOwnerData();
  } catch (e) {
    db.error = "Tidak bisa terhubung ke server: " + e.message;
    render();
  }
}

// Ubah pesan error database menjadi kalimat yang ramah
function niceError(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return "Email atau password salah.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Koneksi internet bermasalah. Coba lagi.";
  return m;
}
