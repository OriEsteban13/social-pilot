const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSeconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 60) return RTF.format(diffSeconds, "second");
  if (abs < 3600) return RTF.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diffSeconds / 86400), "day");
  return RTF.format(Math.round(diffSeconds / (86400 * 30)), "month");
}

const DATE_FMT = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });
const DATE_TIME_FMT = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const WEEKDAY_FMT = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "short" });
const TIME_FMT = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

export function formatDate(date: Date | string): string {
  return DATE_FMT.format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateTime(date: Date | string): string {
  return DATE_TIME_FMT.format(typeof date === "string" ? new Date(date) : date);
}

export function formatWeekday(date: Date | string): string {
  return WEEKDAY_FMT.format(typeof date === "string" ? new Date(date) : date);
}

export function formatTime(date: Date | string): string {
  return TIME_FMT.format(typeof date === "string" ? new Date(date) : date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}
