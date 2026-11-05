export function appTimeZone() {
  return process.env.APP_TIMEZONE || "Asia/Jerusalem";
}

export function formatCalendarDate(date: Date, timeZone = appTimeZone()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayISO(timeZone = appTimeZone()) {
  return formatCalendarDate(new Date(), timeZone);
}

export function calendarDate(input: Date, timeZone = appTimeZone()) {
  return new Date(`${formatCalendarDate(input, timeZone)}T00:00:00.000Z`);
}

export function calendarDateFromISO(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("Invalid date");
  }
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function minutesOfDay(date: Date, timeZone = appTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}

export function formatTime(date: Date, timeZone = appTimeZone()) {
  const total = minutesOfDay(date, timeZone);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatMinutes(total: number | null | undefined) {
  if (total == null) return "—";
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function parseHm(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUTC - date.getTime();
}

export function zonedDateTime(isoDate: string, hm: string, timeZone = appTimeZone()) {
  if (!parseHm(hm) && parseHm(hm) !== 0) throw new Error("Invalid time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Invalid date");
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hm.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  const result = new Date(utcGuess.getTime() - offset);
  const corrected = timeZoneOffsetMs(result, timeZone);
  return corrected === offset ? result : new Date(utcGuess.getTime() - corrected);
}

export function parseDateTimeLocal(value: string, timeZone = appTimeZone()) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) return null;
  try {
    return zonedDateTime(match[1], match[2], timeZone);
  } catch {
    return null;
  }
}

export function formatDateTimeLocal(date: Date, timeZone = appTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = read("hour") === "24" ? "00" : read("hour");
  return `${read("year")}-${read("month")}-${read("day")}T${hour}:${read("minute")}`;
}

export function evaluateArrival(
  checkIn: Date,
  officialStartTime: string,
  lateGraceMinutes: number,
  timeZone = appTimeZone(),
) {
  const start = parseHm(officialStartTime) ?? 16 * 60;
  const cutoff = start + Math.max(0, lateGraceMinutes);
  const arrival = minutesOfDay(checkIn, timeZone);
  if (arrival <= cutoff) return { status: "ATTENDED" as const, minutesLate: 0 };
  return { status: "LATE" as const, minutesLate: arrival - cutoff };
}

export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function currentPeriod(timeZone = appTimeZone()) {
  const iso = todayISO(timeZone);
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}
