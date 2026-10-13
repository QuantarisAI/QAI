export const TZ = "Europe/Stockholm";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
/** YYYY-MM-DD in Europe/Stockholm */
export function stockholmDay(ts: number): string {
  return fmt.format(new Date(ts));
}
function toUtcDays(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function diffDays(a: string, b: string): number {
  return toUtcDays(b) - toUtcDays(a);
}
export function addDays(day: string, n: number): string {
  const t = (toUtcDays(day) + n) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
export function isValidDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
}
