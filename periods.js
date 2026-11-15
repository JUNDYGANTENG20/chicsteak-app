// Pembantu tanggal & periode (harian / mingguan Senin–Minggu / bulanan).
// Data contoh sekarang dibuat di database oleh fungsi `seed_demo()` (lihat supabase/schema.sql).

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
