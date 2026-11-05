export const SCHEDULE_CATEGORIES = [
  "PSYCHOMETRY",
  "PYTHON_AI",
  "HEBREW_YAEL",
  "VOLUNTEERING",
  "IDENTITY_LEADERSHIP",
  "WORKSHOP",
  "FOOD_BREAK",
  "EXAM",
  "GENERAL",
] as const;

export const RECURRENCE_TYPES = ["WEEKLY", "BIWEEKLY", "ONCE"] as const;

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number];
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export type ScheduleItem = {
  id: string;
  titleHe: string;
  titleAr: string;
  courseId: string | null;
  courseCode: string | null;
  category: ScheduleCategory;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomOrLocation: string | null;
  instructorName: string | null;
  recurrenceType: RecurrenceType;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export function addDaysIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function weekStartSunday(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return addDaysIso(iso, -date.getUTCDay());
}

export function weekday(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function occursOn(
  item: Pick<ScheduleItem, "dayOfWeek" | "recurrenceType" | "startDate" | "endDate" | "isActive">,
  iso: string,
) {
  if (!item.isActive) return false;
  if (weekday(iso) !== item.dayOfWeek) return false;
  if (iso < item.startDate) return false;
  if (item.endDate && iso > item.endDate) return false;
  if (item.recurrenceType === "ONCE") return iso === item.startDate;
  if (item.recurrenceType === "BIWEEKLY") {
    const start = Date.parse(`${item.startDate}T00:00:00.000Z`);
    const current = Date.parse(`${iso}T00:00:00.000Z`);
    const weeks = Math.round((current - start) / (7 * 86_400_000));
    return weeks >= 0 && weeks % 2 === 0;
  }
  return true;
}

export function isHm(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
