// Pembantu tanggal/periode + generator data contoh acak (riwayat pesanan & ulasan).
// Dimuat sebelum app.js. Fungsi di sini memakai `menus`, `sauces`, `carbs`
// dari app.js, tetapi baru dipanggil setelah app.js selesai mendefinisikannya.

const DEMO_DAYS = 120; // panjang riwayat contoh (± 4 bulan)

/* ---------- Tanggal & periode ---------- */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// type: "day" | "week" (Senin–Minggu) | "month"
function periodStart(type, d) {
  const x = startOfDay(d);
  if (type === "week") return addDays(x, -((x.getDay() + 6) % 7));
  if (type === "month") x.setDate(1);
  return x;
}
function periodShift(type, start, n) {
  if (type === "day") return addDays(start, n);
  if (type === "week") return addDays(start, 7 * n);
  const x = new Date(start);
  x.setMonth(x.getMonth() + n);
  return x;
}
const fmt = (opts) => new Intl.DateTimeFormat("id-ID", opts);
const fDayLong = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fDayShort = fmt({ day: "numeric", month: "short" });
const fDayNum = fmt({ day: "numeric" });
const fMonthLong = fmt({ month: "long", year: "numeric" });
const fMonthShort = fmt({ month: "short", year: "numeric" });
const fWeekday = fmt({ weekday: "short" });
const fDateTime = fmt({ day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function periodLabel(type, start, short = false) {
  if (type === "day") return short ? `${fWeekday.format(start)}, ${fDayShort.format(start)}` : fDayLong.format(start);
  if (type === "month") return short ? fMonthShort.format(start) : fMonthLong.format(start);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const a = sameMonth ? fDayNum.format(start) : fDayShort.format(start);
  return `${a} – ${fDayShort.format(end)}${short ? "" : " " + end.getFullYear()}`;
}
const periodNames = { day: "Harian", week: "Mingguan", month: "Bulanan" };
const prevNames = { day: "kemarin", week: "minggu lalu", month: "bulan lalu" };

/* ---------- Random ber-seed (hasil sama tiap kali untuk seed yang sama) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWeighted(rnd, pairs) {
  const total = pairs.reduce((n, p) => n + p[1], 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
}

const demoNames = [
  "Rizky", "Salsa", "Dimas", "Nadia", "Fajar", "Ayu", "Bima", "Citra", "Raka", "Putri",
  "Yoga", "Intan", "Arif", "Laras", "Hendra", "Maya", "Gilang", "Tasya", "Reza", "Dinda",
  "Bagas", "Nisa", "Ilham", "Wulan", "Farhan", "Sekar", "Andi", "Kirana", "Rendi", "Zahra",
];
const demoComments = {
  5: [
    "Ayamnya juicy banget, saus Hot Lava mantap!",
    "Porsinya bikin kenyang sampai kelas sore.",
    "Pesan lewat kiosk cepat, nggak perlu antre lama.",
    "Classic Cheese-nya creamy, favorit aku.",
    "Harga ramah kantong mahasiswa, rasa juara.",
    "Bayar QRIS gampang, makanan siap kurang dari 10 menit.",
    "Black Thunder enak, lada hitamnya pas.",
    "Langganan tiap habis praktikum, selalu konsisten.",
    "",
  ],
  4: [
    "Enak, cuma kentangnya kurang garing sedikit.",
    "Rasa oke, semoga ada menu minuman juga.",
    "Magic Mushroom enak, sausnya bisa ditambah lagi.",
    "Pelayanan cepat, tempat duduk agak terbatas.",
    "Porsi Medium pas buat makan siang.",
    "",
  ],
  3: [
    "Lumayan, tapi tadi nunggu agak lama pas jam istirahat.",
    "Rasa standar, nasinya agak dingin.",
    "Sausnya bisa lebih banyak lagi.",
  ],
  2: [
    "Antrean jam 12 lama sekali.",
    "Ayamnya agak alot hari ini.",
  ],
  1: [
    "Pesanan saya tertukar, semoga lebih teliti.",
    "Menunggu lebih dari 25 menit.",
  ],
};

function demoItem(menu, sauce, carb, qty) {
  return { id: menu.id, name: menu.name, price: menu.price, factor: menu.factor, sauce, carb, qty, key: `${menu.id}-${sauce}-${carb}` };
}

// Menambahkan riwayat pesanan & ulasan acak ke state `s`.
// Pesanan asli yang sudah ada tetap dipertahankan (ikut dinomori ulang).
function seedDemoHistory(s, seedNumber = 20261115) {
  const rnd = mulberry32(seedNumber);
  const now = new Date();
  const today = startOfDay(now);
  const hist = [];
  const reviews = [];
  const hourWeights = [
    [9, 2], [10, 4], [11, 9], [12, 12], [13, 8], [14, 4], [15, 4],
    [16, 5], [17, 8], [18, 9], [19, 6], [20, 3],
  ];

  for (let d = DEMO_DAYS; d >= 0; d--) {
    const day = addDays(today, -d);
    const wd = day.getDay(); // 0 = Minggu
    const weekdayFactor = wd === 0 ? 0.35 : wd === 6 ? 0.6 : wd === 5 ? 0.9 : 1;
    const trend = 1 + (DEMO_DAYS - d) / DEMO_DAYS * 0.25; // pelan-pelan makin ramai
    const count = Math.round((16 + rnd() * 12) * weekdayFactor * trend);
    for (let i = 0; i < count; i++) {
      const t = new Date(day);
      t.setHours(pickWeighted(rnd, hourWeights), Math.floor(rnd() * 60), Math.floor(rnd() * 60));
      if (t > now) continue;
      const lines = rnd() < 0.72 ? 1 : rnd() < 0.8 ? 2 : 3;
      const items = [];
      for (let l = 0; l < lines; l++) {
        const menu = pickWeighted(rnd, [[menus[0], 35], [menus[1], 42], [menus[2], 23]]);
        const sauce = pickWeighted(rnd, [["classic", 34], ["lava", 28], ["thunder", 21], ["mushroom", 17]]);
        const carb = rnd() < 0.62 ? "rice" : "fries";
        const qty = rnd() < 0.88 ? 1 : 2;
        const old = items.find((x) => x.key === `${menu.id}-${sauce}-${carb}`);
        old ? (old.qty += qty) : items.push(demoItem(menu, sauce, carb, qty));
      }
      const method = rnd() < 0.63 ? "qris" : "cash";
      const order = {
        id: 0,
        createdAt: t.toISOString(),
        items,
        total: items.reduce((n, x) => n + x.price * x.qty, 0),
        method,
        payment: "paid",
        status: "completed",
        stockApplied: true,
        demo: true,
      };
      hist.push(order);
      if (rnd() < 0.32) {
        // Jam sibuk (12:00) sedikit lebih sering dapat rating rendah
        const busy = t.getHours() === 12 ? 1 : 0;
        const rating = pickWeighted(rnd, [[5, 52 - busy * 10], [4, 30], [3, 10 + busy * 5], [2, 5 + busy * 3], [1, 3 + busy * 2]]);
        const pool = demoComments[rating];
        const rt = new Date(t.getTime() + (20 + rnd() * 180) * 60000);
        reviews.push({
          id: 0,
          order,
          name: demoNames[Math.floor(rnd() * demoNames.length)],
          rating,
          comment: pool[Math.floor(rnd() * pool.length)],
          createdAt: (rt > now ? now : rt).toISOString(),
          demo: true,
        });
      }
    }
  }

  // Gabungkan dengan pesanan asli lalu nomori ulang berurutan sesuai waktu.
  const all = [...hist, ...s.orders].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  all.forEach((o, i) => (o.id = i + 1));
  s.orders = all.reverse(); // terbaru di depan, sama seperti aplikasi asli
  s.nextOrder = all.length + 1;

  const allReviews = [
    ...reviews.map((r) => {
      const { order, ...rest } = r;
      return { ...rest, orderId: order.id, menu: order.items[0].name };
    }),
    ...(s.reviews || []),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  allReviews.forEach((r, i) => (r.id = allReviews.length - i));
  s.reviews = allReviews;
  s.demoSeeded = true;
  return s;
}

// Hapus data contoh lama lalu buat ulang dengan seed baru.
function regenerateDemo(s) {
  s.orders = s.orders.filter((o) => !o.demo);
  s.reviews = (s.reviews || []).filter((r) => !r.demo);
  return seedDemoHistory(s, Date.now() & 0xffffffff);
}
