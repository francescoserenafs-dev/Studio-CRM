const APP_TIME_ZONE = "Europe/Rome";

// Offset (in minutes) such that <local wall clock> = <UTC instant> + offset, at the given instant.
function getTimeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return (asUtc - instant.getTime()) / 60_000;
}

// Parses a wall-clock string from a <input type="datetime-local"> (e.g. "2026-09-17T18:00") as Europe/Rome
// local time, regardless of the server's own timezone (Vercel runs in UTC, which caused a 2h shift).
export function parseLocalDateTime(value: string): Date {
  const naiveUtc = new Date(`${value}:00.000Z`);
  if (Number.isNaN(naiveUtc.valueOf())) return naiveUtc;
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, APP_TIME_ZONE);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}

// "YYYY-MM-DD" del giorno in cui cade l'istante secondo il fuso applicativo.
export function toLocalDateKey(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export function toLocalTimeLabel(instant: Date): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

// 0 = domenica ... 6 = sabato, coerente con Date.prototype.getDay().
export function localWeekday(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

// Come l'interval di Postgres: se il giorno non esiste nel mese di arrivo si usa l'ultimo giorno del mese.
export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function isWeekendDateKey(dateKey: string): boolean {
  const weekday = localWeekday(dateKey);
  return weekday === 0 || weekday === 6;
}

export function sessionSaturdaySurchargeCents(scheduledAt: string, saturdaySurchargeCents: number): number {
  if (!scheduledAt) return 0;
  const instant = new Date(scheduledAt);
  if (Number.isNaN(instant.valueOf())) return 0;
  const dateKey = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt)
    ? scheduledAt.slice(0, 10)
    : toLocalDateKey(instant);
  return localWeekday(dateKey) === 6 ? saturdaySurchargeCents : 0;
}

export function suggestedSessionPrice({ packagePriceCents, scheduledAt, saturdaySurchargeCents }: {
  packagePriceCents: number | null;
  scheduledAt: string;
  saturdaySurchargeCents: number;
}): number | null {
  if (packagePriceCents === null) return null;
  return packagePriceCents + sessionSaturdaySurchargeCents(scheduledAt, saturdaySurchargeCents);
}
