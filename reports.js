// Laporan (harian/mingguan/bulanan), rekap penjualan, dan ulasan pelanggan.
// Dimuat sebelum app.js; memakai `state`, `money`, `recipeCost`, `menus`, dll. saat dipanggil.

let report = { type: "day", start: null }; // start: timestamp awal periode (null = periode berjalan)
let recapType = "day";
let reviewFilter = { rating: 0, limit: 12 };

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));

/* ---------- Perhitungan ---------- */
function stats(from, to) {
  const a = +from, b = +to;
  const orders = state.orders.filter((o) => {
    if (o.payment !== "paid") return false;
    const t = Date.parse(o.createdAt);
    return t >= a && t < b;
  });
  const s = {
    orders, revenue: 0, cogs: 0, transactions: orders.length, portions: 0, cash: 0, qris: 0,
    byMenu: {}, bySauce: {}, byCarb: {}, byHour: Array(24).fill(0),
  };
  for (const o of orders) {
    s.revenue += o.total;
    s[o.method] += o.total;
    s.byHour[new Date(o.createdAt).getHours()] += o.total;
    for (const i of o.items) {
      s.cogs += recipeCost(i) * i.qty;
      s.portions += i.qty;
      const m = (s.byMenu[i.id] ||= { qty: 0, revenue: 0 });
      m.qty += i.qty;
      m.revenue += i.price * i.qty;
      s.bySauce[i.sauce] = (s.bySauce[i.sauce] || 0) + i.qty;
      s.byCarb[i.carb] = (s.byCarb[i.carb] || 0) + i.qty;
    }
  }
  s.profit = s.revenue - s.cogs;
  s.avgTicket = s.transactions ? s.revenue / s.transactions : 0;
  s.reviews = (state.reviews || []).filter((r) => {
    const t = Date.parse(r.createdAt);
    return t >= a && t < b;
  });
  s.rating = s.reviews.length ? s.reviews.reduce((n, r) => n + r.rating, 0) / s.reviews.length : 0;
  return s;
}
function delta(cur, prev) {
  if (!prev) return cur ? `<span class="delta up">baru</span>` : "";
  const p = ((cur - prev) / prev) * 100;
  const cls = p > 0.5 ? "up" : p < -0.5 ? "down" : "flat";
  const arrow = cls === "up" ? "▲" : cls === "down" ? "▼" : "•";
  return `<span class="delta ${cls}">${arrow} ${Math.abs(p).toFixed(1).replace(".", ",")}%</span>`;
}

/* ---------- Grafik batang sederhana (satu seri) ---------- */
function barChart(points, { height = 180, labelEvery = 1, valueFmt = money } = {}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const top = points.reduce((b, p) => (p.value > b.value ? p : b), points[0] || { value: 0 });
  return `<div class="chart" style="--h:${height}px"><div class="chart-max">${valueFmt(max)}</div><div class="bars" role="img" aria-label="Grafik batang">${points
    .map(
      (p, i) =>
        `<div class="bar-col${p.onclick ? " clickable" : ""}" ${p.onclick ? `onclick="${p.onclick}"` : ""}><div class="bar-tip"><b>${esc(p.tip || p.label)}</b><br>${valueFmt(p.value)}${p.extra ? `<br>${p.extra}` : ""}</div><div class="bar${p === top && p.value ? " top" : ""}" style="height:${(p.value / max) * 100}%"></div><div class="bar-label">${i % labelEvery === 0 ? esc(p.label) : ""}</div></div>`,
    )
    .join("")}</div></div>`;
}
function shareRows(entries, total, nameOf) {
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const pct = total ? (v / total) * 100 : 0;
      return `<div class="share-row"><div class="share-top"><span>${esc(nameOf(k))}</span><span><b>${num(v)}</b> porsi · ${pct.toFixed(0)}%</span></div><div class="share-bar"><div style="width:${pct}%"></div></div></div>`;
    })
    .join("") || `<div class="empty-state small">Belum ada data.</div>`;
}
function segmented(current, fn) {
  return `<div class="segmented">${["day", "week", "month"].map((t) => `<button class="${current === t ? "active" : ""}" onclick="${fn}('${t}')">${periodNames[t]}</button>`).join("")}</div>`;
}

/* ---------- Tab: Laporan ---------- */
function reportView() {
  const type = report.type;
  const start = report.start ? new Date(report.start) : periodStart(type, new Date());
  const end = periodShift(type, start, 1);
  const prevStart = periodShift(type, start, -1);
  const now = new Date();
  const isCurrent = end > now;
  const s = stats(start, end);
  // Periode berjalan dibandingkan dengan rentang yang setara di periode lalu (mis. 1–15 Nov vs 1–15 Okt)
  const prevEnd = isCurrent ? new Date(Math.min(+start, +prevStart + (now - start))) : start;
  const p = stats(prevStart, prevEnd);
  const firstOrder = state.orders.length ? new Date(state.orders[state.orders.length - 1].createdAt) : new Date();
  const canPrev = prevStart >= periodStart(type, firstOrder);

  let points, chartTitle, labelEvery = 1;
  if (type === "day") {
    chartTitle = "Omzet per jam";
    points = s.byHour.map((v, h) => ({ label: String(h).padStart(2, "0"), tip: `${String(h).padStart(2, "0")}.00–${String(h + 1).padStart(2, "0")}.00`, value: v })).slice(8, 22);
  } else {
    chartTitle = "Omzet per hari";
    points = [];
    for (let d = new Date(start); d < end; d = addDays(d, 1)) {
      const ds = stats(d, addDays(d, 1));
      points.push({
        label: type === "week" ? fWeekday.format(d) : fDayNum.format(d),
        tip: fDayLong.format(d),
        value: ds.revenue,
        extra: `${ds.transactions} transaksi`,
        onclick: `openReport('day',${+d})`,
      });
    }
    if (type === "month") labelEvery = 2;
  }
  const busiest = s.byHour.indexOf(Math.max(...s.byHour));
  const topMenu = Object.entries(s.byMenu).sort((a, b) => b[1].qty - a[1].qty)[0];
  const menuName = (id) => menus.find((m) => m.id === id)?.name || id;
  const sauceName = (id) => sauces.find((x) => x.id === id)?.name || id;
  const carbName = (id) => carbs.find((x) => x.id === id)?.name || id;

  return `<section class="report">
  <div class="panel report-head">
    <div class="report-controls no-print">${segmented(type, "setReportType")}
      <div class="period-nav"><button class="btn btn-outline" ${canPrev ? "" : "disabled"} onclick="shiftReport(-1)" aria-label="Periode sebelumnya">‹</button><button class="btn btn-outline" ${isCurrent ? "disabled" : ""} onclick="shiftReport(1)" aria-label="Periode berikutnya">›</button>${isCurrent ? "" : `<button class="btn btn-outline" onclick="openReport('${type}',null)">${{ day: "Hari ini", week: "Minggu ini", month: "Bulan ini" }[type]}</button>`}<button class="btn btn-primary" onclick="window.print()">Cetak / PDF</button></div>
    </div>
    <div class="eyebrow">Laporan ${periodNames[type].toLowerCase()}${isCurrent ? " · berjalan" : ""}</div>
    <h2 class="report-title">${periodLabel(type, start)}</h2>
    <p class="hint">Dibandingkan dengan ${prevNames[type]} (${periodLabel(type, prevStart)})${isCurrent ? " sampai jam yang sama" : ""}. Hanya pesanan yang sudah dibayar.</p>
  </div>
  <div class="kpi-grid">
    <div class="metric"><div class="metric-label">Omzet</div><div class="metric-value">${money(s.revenue)}</div>${delta(s.revenue, p.revenue)}</div>
    <div class="metric"><div class="metric-label">Transaksi</div><div class="metric-value">${num(s.transactions)}</div>${delta(s.transactions, p.transactions)}</div>
    <div class="metric"><div class="metric-label">Porsi terjual</div><div class="metric-value">${num(s.portions)}</div>${delta(s.portions, p.portions)}</div>
    <div class="metric"><div class="metric-label">Rata-rata / transaksi</div><div class="metric-value">${money(s.avgTicket)}</div>${delta(s.avgTicket, p.avgTicket)}</div>
    <div class="metric"><div class="metric-label">Laba kotor estimasi</div><div class="metric-value positive">${money(s.profit)}</div>${delta(s.profit, p.profit)}</div>
    <div class="metric"><div class="metric-label">Rating pelanggan</div><div class="metric-value">${s.reviews.length ? `<span class="star-ink">★</span> ${s.rating.toFixed(1).replace(".", ",")}` : "–"}</div><span class="hint-inline">${s.reviews.length} ulasan</span></div>
  </div>
  <div class="panel"><div class="panel-head"><div><h2>${chartTitle}</h2><p class="hint">${type === "day" ? `Jam tersibuk: <b>${s.revenue ? `${String(busiest).padStart(2, "0")}.00–${String(busiest + 1).padStart(2, "0")}.00` : "–"}</b>` : "Klik batang untuk membuka laporan harian."}</p></div></div>${barChart(points, { labelEvery })}</div>
  <div class="report-grid">
    <div class="panel"><div class="panel-head"><h2>Menu terjual</h2></div>
      <table class="table"><thead><tr><th>Menu</th><th class="r">Porsi</th><th class="r">Omzet</th></tr></thead><tbody>${menus
        .map((m) => { const v = s.byMenu[m.id] || { qty: 0, revenue: 0 }; return `<tr><td>${m.name}${topMenu && topMenu[0] === m.id ? ` <span class="pill ready">Terlaris</span>` : ""}</td><td class="r">${num(v.qty)}</td><td class="r">${money(v.revenue)}</td></tr>`; })
        .join("")}</tbody><tfoot><tr><td>Total</td><td class="r">${num(s.portions)}</td><td class="r">${money(s.revenue)}</td></tr></tfoot></table>
    </div>
    <div class="panel"><div class="panel-head"><h2>Saus favorit</h2></div>${shareRows(Object.entries(s.bySauce), s.portions, sauceName)}
      <div class="panel-head" style="margin-top:18px"><h2>Karbo</h2></div>${shareRows(Object.entries(s.byCarb), s.portions, carbName)}</div>
    <div class="panel"><div class="panel-head"><h2>Keuangan</h2></div><div class="breakdown">
      <div class="break-row"><span>Omzet</span><b>${money(s.revenue)}</b></div>
      <div class="break-row"><span>Estimasi HPP</span><b>${money(s.cogs)}</b></div>
      <div class="break-row"><span>Laba kotor</span><b class="positive">${money(s.profit)}</b></div>
      <div class="break-row"><span>Margin</span><b>${s.revenue ? ((s.profit / s.revenue) * 100).toFixed(1).replace(".", ",") : 0}%</b></div>
      <div class="break-row"><span>QRIS</span><b>${money(s.qris)}</b></div>
      <div class="break-row"><span>Tunai</span><b>${money(s.cash)}</b></div>
    </div></div>
  </div>
  <div class="panel"><div class="panel-head"><div><h2>Ulasan periode ini</h2><p class="hint">${s.reviews.length} ulasan · ${s.reviews.length ? Math.round((s.reviews.filter((r) => r.rating >= 4).length / s.reviews.length) * 100) : 0}% pelanggan puas (4–5 bintang)</p></div><button class="btn btn-outline no-print" onclick="setTab('reviews')">Semua ulasan</button></div>
    <div class="review-list">${s.reviews.slice(0, 4).map(reviewCard).join("") || `<div class="empty-state small">Belum ada ulasan pada periode ini.</div>`}</div></div>
</section>`;
}

/* ---------- Tab: Rekap penjualan ---------- */
function recapRows(type) {
  const count = { day: 30, week: 12, month: 6 }[type];
  const cur = periodStart(type, new Date());
  const rows = [];
  for (let i = 0; i < count; i++) {
    const start = periodShift(type, cur, -i);
    const s = stats(start, periodShift(type, start, 1));
    rows.push({ start, s });
  }
  return rows; // terbaru dulu
}
function recapView() {
  const rows = recapRows(recapType);
  const tot = rows.reduce(
    (t, { s }) => {
      ["transactions", "portions", "revenue", "cogs", "profit", "qris", "cash"].forEach((k) => (t[k] += s[k]));
      t.rSum += s.rating * s.reviews.length;
      t.rN += s.reviews.length;
      return t;
    },
    { transactions: 0, portions: 0, revenue: 0, cogs: 0, profit: 0, qris: 0, cash: 0, rSum: 0, rN: 0 },
  );
  const avgPer = tot.revenue / rows.length;
  const best = rows.reduce((b, r) => (r.s.revenue > b.s.revenue ? r : b), rows[0]);
  const unit = { day: "hari", week: "minggu", month: "bulan" }[recapType];
  const points = rows
    .slice()
    .reverse()
    .map(({ start, s }) => ({
      label: recapType === "day" ? fDayNum.format(start) : recapType === "week" ? fDayShort.format(start) : fMonthShort.format(start).replace(" ", "\n"),
      tip: periodLabel(recapType, start),
      value: s.revenue,
      extra: `${s.transactions} transaksi`,
      onclick: `openReport('${recapType}',${+start})`,
    }));
  return `<section class="report">
  <div class="panel">
    <div class="panel-head wrap"><div><h2>Rekap penjualan ${periodNames[recapType].toLowerCase()}</h2><p class="hint">${rows.length} ${unit} terakhir · klik baris atau batang untuk melihat laporan lengkapnya.</p></div>
      <div class="report-controls no-print">${segmented(recapType, "setRecapType")}<button class="btn btn-outline" onclick="downloadRecap()">Unduh CSV</button><button class="btn btn-primary" onclick="window.print()">Cetak / PDF</button></div></div>
    <div class="kpi-grid three">
      <div class="metric"><div class="metric-label">Total omzet (${rows.length} ${unit})</div><div class="metric-value">${money(tot.revenue)}</div></div>
      <div class="metric"><div class="metric-label">Rata-rata per ${unit}</div><div class="metric-value">${money(avgPer)}</div></div>
      <div class="metric"><div class="metric-label">${unit[0].toUpperCase() + unit.slice(1)} terbaik</div><div class="metric-value small">${periodLabel(recapType, best.start, true)}</div><span class="hint-inline">${money(best.s.revenue)}</span></div>
    </div>
    ${barChart(points, { labelEvery: recapType === "day" ? 3 : 1 })}
  </div>
  <div class="panel"><div class="table-wrap"><table class="table recap-table"><thead><tr><th>Periode</th><th class="r">Transaksi</th><th class="r">Porsi</th><th class="r">Omzet</th><th class="r">HPP</th><th class="r">Laba kotor</th><th class="r">QRIS</th><th class="r">Tunai</th><th class="r">Rating</th></tr></thead><tbody>${rows
    .map(
      ({ start, s }) =>
        `<tr class="clickable" onclick="openReport('${recapType}',${+start})"><td>${periodLabel(recapType, start, true)}</td><td class="r">${num(s.transactions)}</td><td class="r">${num(s.portions)}</td><td class="r">${money(s.revenue)}</td><td class="r muted">${money(s.cogs)}</td><td class="r positive">${money(s.profit)}</td><td class="r">${money(s.qris)}</td><td class="r">${money(s.cash)}</td><td class="r">${s.reviews.length ? `<span class="star-ink">★</span> ${s.rating.toFixed(1).replace(".", ",")}` : "–"}</td></tr>`,
    )
    .join("")}</tbody><tfoot><tr><td>Total</td><td class="r">${num(tot.transactions)}</td><td class="r">${num(tot.portions)}</td><td class="r">${money(tot.revenue)}</td><td class="r">${money(tot.cogs)}</td><td class="r">${money(tot.profit)}</td><td class="r">${money(tot.qris)}</td><td class="r">${money(tot.cash)}</td><td class="r">${tot.rN ? `<span class="star-ink">★</span> ${(tot.rSum / tot.rN).toFixed(1).replace(".", ",")}` : "–"}</td></tr></tfoot></table></div>
    <div class="demo-note no-print"><span>Riwayat sebelum hari ini adalah <b>data contoh acak</b> untuk demo.</span><button class="btn btn-outline" ${busy ? "disabled" : ""} onclick="resetDemo()">${busy ? "Memproses…" : "Acak ulang data contoh"}</button></div>
  </div>
</section>`;
}
function downloadRecap() {
  const rows = recapRows(recapType);
  const head = ["Periode", "Mulai", "Transaksi", "Porsi", "Omzet", "HPP", "Laba kotor", "QRIS", "Tunai", "Jumlah ulasan", "Rating rata-rata"];
  const lines = [head, ...rows.map(({ start, s }) => [periodLabel(recapType, start), start.toLocaleDateString("sv-SE"), s.transactions, s.portions, s.revenue, Math.round(s.cogs), Math.round(s.profit), s.qris, s.cash, s.reviews.length, s.reviews.length ? s.rating.toFixed(2).replace(".", ",") : ""])];
  const csv = "﻿" + lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `rekap-${{ day: "harian", week: "mingguan", month: "bulanan" }[recapType]}-chic-kampus-${new Date().toLocaleDateString("sv-SE")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Tab: Ulasan pelanggan ---------- */
function reviewCard(r) {
  return `<article class="review"><div class="review-top"><div class="avatar">${esc(r.name[0] || "?")}</div><div><b>${esc(r.name)}</b><div class="hint-inline">${fDateTime.format(new Date(r.createdAt))}${r.orderId ? ` · Pesanan #${r.orderId}` : ""}${r.menu ? ` · ${esc(r.menu)}` : ""}</div></div><div class="review-stars" aria-label="${r.rating} dari 5 bintang">${stars(r.rating)}</div></div>${r.comment ? `<p>${esc(r.comment)}</p>` : `<p class="muted"><i>Tanpa komentar</i></p>`}</article>`;
}
function reviewsView() {
  const all = state.reviews || [];
  const n = all.length;
  const avg = n ? all.reduce((s, r) => s + r.rating, 0) / n : 0;
  const dist = [5, 4, 3, 2, 1].map((k) => [k, all.filter((r) => r.rating === k).length]);
  const list = reviewFilter.rating ? all.filter((r) => r.rating === reviewFilter.rating) : all;
  const cur = periodStart("week", new Date());
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const st = periodShift("week", cur, -i);
    const rs = stats(st, periodShift("week", st, 1)).reviews;
    weeks.push({ label: fDayShort.format(st), tip: periodLabel("week", st), value: rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0, extra: `${rs.length} ulasan` });
  }
  const r1 = (v) => v.toFixed(1).replace(".", ",");
  return `<section class="reviews-grid">
  <div class="panel review-summary">
    <h2>Respon pelanggan</h2>
    <div class="big-rating">${r1(avg)}<span>/5</span></div>
    <div class="review-stars large">${stars(avg)}</div>
    <p class="hint">${num(n)} ulasan · ${n ? Math.round((all.filter((r) => r.rating >= 4).length / n) * 100) : 0}% pelanggan puas</p>
    <div class="dist">${dist
      .map(([k, c]) => `<button class="dist-row ${reviewFilter.rating === k ? "active" : ""}" onclick="filterReviews(${k})"><span>${k} ★</span><div class="share-bar"><div style="width:${n ? (c / n) * 100 : 0}%"></div></div><span class="r">${num(c)}</span></button>`)
      .join("")}</div>
    <h3 class="sub">Rata-rata rating per minggu</h3>
    ${barChart(weeks, { height: 120, valueFmt: (v) => (v ? `★ ${r1(v)}` : "–") })}
  </div>
  <div class="panel">
    <div class="panel-head wrap"><div><h2>Ulasan terbaru</h2><p class="hint">${reviewFilter.rating ? `Menampilkan ulasan ${reviewFilter.rating} bintang (${list.length}).` : "Semua ulasan, terbaru di atas."}</p></div>
      <div class="chips"><button class="${reviewFilter.rating === 0 ? "active" : ""}" onclick="filterReviews(0)">Semua</button>${[5, 4, 3, 2, 1].map((k) => `<button class="${reviewFilter.rating === k ? "active" : ""}" onclick="filterReviews(${k})">${k} ★</button>`).join("")}</div></div>
    <div class="review-list">${list.slice(0, reviewFilter.limit).map(reviewCard).join("") || `<div class="empty-state small">Belum ada ulasan.</div>`}</div>
    ${list.length > reviewFilter.limit ? `<button class="btn btn-outline full" onclick="moreReviews()">Tampilkan lebih banyak (${list.length - reviewFilter.limit} lagi)</button>` : ""}
  </div>
</section>`;
}

/* ---------- Handler ---------- */
window.setReportType = (t) => { report = { type: t, start: null }; render(); };
window.shiftReport = (n) => {
  const start = report.start ? new Date(report.start) : periodStart(report.type, new Date());
  report.start = +periodShift(report.type, start, n);
  render();
};
window.openReport = (type, start) => { report = { type, start }; ownerTab = "report"; render(); window.scrollTo(0, 0); };
window.setRecapType = (t) => { recapType = t; render(); };
window.downloadRecap = downloadRecap;
window.filterReviews = (k) => { reviewFilter = { rating: reviewFilter.rating === k ? 0 : k, limit: 12 }; render(); };
window.moreReviews = () => { reviewFilter.limit += 12; render(); };
window.resetDemo = async () => {
  if (!confirm("Acak ulang semua data contoh (riwayat pesanan & ulasan)? Pesanan & ulasan asli tetap disimpan. Proses ini butuh beberapa detik.")) return;
  db.bulk = true;
  busy = true;
  render();
  const { error } = await sb.rpc("reset_demo");
  busy = false;
  if (error) alert("Gagal mengacak ulang: " + niceError(error));
  await Promise.all([loadOwnerData(), loadRating()]);
  db.bulk = false;
  render();
};
