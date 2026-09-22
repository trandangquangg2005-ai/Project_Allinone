// Vietnam is UTC+7 all year (no DST). Servers run in UTC, so every
// "today" / "this month" is computed explicitly in Vietnam time.

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VN_OFFSET = "+07:00";

const isoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayMonthYear = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dayMonth = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});
const time = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const weekday = new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TIME_ZONE, weekday: "long" });

/** Calendar date in Vietnam, e.g. "2026-09-22". */
export function toVNDate(date: Date = new Date()): string {
  return isoDate.format(date);
}

export function todayVN(): string {
  return toVNDate(new Date());
}

export function currentMonthVN(): string {
  return todayVN().slice(0, 7);
}

export function isValidMonth(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isValidDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Half-open date range [from, to) for `date` columns. */
export function monthDateRange(month: string) {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` };
}

/** Half-open instant range for `timestamptz` columns. */
export function monthInstantRange(month: string) {
  const { from, to } = monthDateRange(month);
  return { start: vnMidnight(from), end: vnMidnight(to) };
}

export function vnMidnight(date: string): Date {
  return new Date(`${date}T00:00:00${VN_OFFSET}`);
}

export function dayInstantRange(date: string) {
  const start = vnMidnight(date);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Combine a VN calendar date and "HH:mm" into an instant. */
export function vnDateTime(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${VN_OFFSET}`);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A bare "YYYY-MM-DD" is a VN calendar day; anchor it at VN noon before
// formatting so no timezone can shift it to another day.
function asInstant(value: Date | string): Date {
  return typeof value === "string" ? new Date(`${value}T12:00:00${VN_OFFSET}`) : value;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

export function formatDate(value: Date | string): string {
  return dayMonthYear.format(asInstant(value));
}

export function formatDayMonth(value: Date | string): string {
  return dayMonth.format(asInstant(value));
}

export function formatTime(value: Date): string {
  return time.format(value);
}

export function formatDateTime(value: Date): string {
  return `${time.format(value)}, ${dayMonthYear.format(value)}`;
}

export function formatWeekday(value: Date | string): string {
  const name = weekday.format(asInstant(value));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "Hôm nay", "Hôm qua" or "Thứ Hai, 21/09". */
export function formatRelativeDay(date: string, today: string = todayVN()): string {
  if (date === today) return "Hôm nay";
  if (date === addDays(today, -1)) return "Hôm qua";
  if (date === addDays(today, 1)) return "Ngày mai";
  return `${formatWeekday(date)}, ${formatDayMonth(date)}`;
}

/** 5400000 ms → "1 giờ 30 phút". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

/** Hours as a short decimal label: 5400000 ms → "1,5 giờ". */
export function formatHours(ms: number): string {
  const hours = ms / 3_600_000;
  return `${(Math.round(hours * 10) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ`;
}

/** "HH:mm" in Vietnam time, for <input type="time">. */
export function toVNTimeInput(value: Date): string {
  return time.format(value);
}

/** Server clock in ms (kept out of render bodies for the purity lint). */
export function serverTimestamp(): number {
  return Date.now();
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(time.format(now).slice(0, 2));
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}
