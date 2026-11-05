import "server-only";

import type { AttendanceSource, AttendanceStatus } from "@prisma/client";
import { isClosedAttendanceWeekday } from "@/lib/attendance-days";
import { getPrisma } from "@/lib/prisma";
import {
  calendarDate,
  calendarDateFromISO,
  evaluateArrival,
  formatCalendarDate,
  monthRange,
} from "@/lib/time";

export type AttendanceClosure = "weekday" | "offline" | null;

export async function attendanceClosure(iso: string): Promise<AttendanceClosure> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  if (isClosedAttendanceWeekday(iso)) return "weekday";
  const row = await getPrisma().attendanceOfflineDay.findUnique({ where: { date: calendarDateFromISO(iso) } });
  return row ? "offline" : null;
}

export async function getAttendanceSetting(courseId?: string | null) {
  const db = getPrisma();
  if (courseId) {
    const courseSetting = await db.attendanceSetting.findUnique({ where: { scopeKey: courseId } });
    if (courseSetting) return courseSetting;
  }
  return db.attendanceSetting.findUnique({ where: { scopeKey: "global" } });
}

export async function resolveArrivalStatus(checkIn: Date, courseId?: string | null) {
  const setting = await getAttendanceSetting(courseId);
  return {
    setting,
    ...evaluateArrival(checkIn, setting?.officialStartTime ?? "16:00", setting?.lateGraceMinutes ?? 0),
  };
}

export type TerminalTapResult =
  | {
      ok: true;
      action: "CHECK_IN" | "CHECK_OUT";
      student: { id: string; firstName: string; lastName: string; hardwareBadgeId: string | null };
      record: {
        id: string;
        status: AttendanceStatus;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        minutesLate: number | null;
        totalMinutes: number | null;
        date: Date;
      };
    }
  | { ok: false; error: "UNKNOWN_BADGE" | "UNKNOWN_COURSE" | "ALREADY_COMPLETE" | "INVALID_TIME" | "CLOSED_DAY" };

export async function recordTerminalTap(input: {
  hardwareBadgeId: string;
  timestamp?: Date;
  courseId?: string | null;
  source: Extract<AttendanceSource, "TERMINAL_MACHINE" | "KIOSK">;
}): Promise<TerminalTapResult> {
  const db = getPrisma();
  const badge = input.hardwareBadgeId.trim();
  const byBadge = await db.user.findUnique({ where: { hardwareBadgeId: badge } });
  const user =
    byBadge ??
    (await db.user.findFirst({
      where: { terminalPin: badge, isActive: true },
    }));

  if (!user || !user.isActive) return { ok: false, error: "UNKNOWN_BADGE" };

  const courseId = input.courseId ?? null;
  if (courseId) {
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) return { ok: false, error: "UNKNOWN_COURSE" };
  }

  const when = input.timestamp ?? new Date();
  if (Number.isNaN(when.getTime())) return { ok: false, error: "INVALID_TIME" };

  const date = calendarDate(when);
  const iso = formatCalendarDate(date, "UTC");
  if (isClosedAttendanceWeekday(iso) || (await db.attendanceOfflineDay.findUnique({ where: { date } }))) {
    return { ok: false, error: "CLOSED_DAY" };
  }
  const courseScope = courseId ?? "none";
  const existing = await db.attendanceRecord.findUnique({
    where: { userId_date_courseScope: { userId: user.id, date, courseScope } },
  });

  const student = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    hardwareBadgeId: user.hardwareBadgeId,
  };

  if (!existing || !existing.checkInTime) {
    const arrival = await resolveArrivalStatus(when, courseId);
    const record = existing
      ? await db.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            checkInTime: when,
            checkOutTime: null,
            totalMinutes: null,
            status: arrival.status,
            minutesLate: arrival.minutesLate,
            source: input.source,
          },
        })
      : await db.attendanceRecord.create({
          data: {
            userId: user.id,
            courseId,
            courseScope,
            date,
            status: arrival.status,
            checkInTime: when,
            minutesLate: arrival.minutesLate,
            source: input.source,
          },
        });
    return { ok: true, action: "CHECK_IN", student, record };
  }

  if (!existing.checkOutTime) {
    if (when.getTime() < existing.checkInTime.getTime()) return { ok: false, error: "INVALID_TIME" };
    const totalMinutes = Math.max(0, Math.round((when.getTime() - existing.checkInTime.getTime()) / 60000));
    const record = await db.attendanceRecord.update({
      where: { id: existing.id },
      data: { checkOutTime: when, totalMinutes },
    });
    return { ok: true, action: "CHECK_OUT", student, record };
  }

  return { ok: false, error: "ALREADY_COMPLETE" };
}

export async function monthAttendance(studentId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return getPrisma().attendanceRecord.findMany({
    where: { userId: studentId, date: { gte: start, lt: end } },
  });
}
