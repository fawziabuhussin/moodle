"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { recordTerminalTap, resolveArrivalStatus } from "@/lib/attendance";
import { activeStudentWhere } from "@/lib/cohort";
import { getLocale, requirePermission } from "@/lib/auth";
import { field, optional } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import { calendarDateFromISO, parseHm, zonedDateTime } from "@/lib/time";
import type { ActionState } from "@/lib/types";

const STATUSES = new Set(["ATTENDED", "LATE", "ABSENT", "EXCUSED"]);

function refreshAttendance(courseId: string | null) {
  revalidatePath("/attendance");
  if (courseId) revalidatePath(`/courses/${courseId}`);
}

export async function saveAttendanceStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("manage_attendance");
  const dict = getDictionary(await getLocale());
  const userId = field(formData, "userId");
  const date = field(formData, "date");
  const status = field(formData, "status");
  const courseId = optional(formData, "courseId");
  if (!userId || !STATUSES.has(status)) return { error: dict.errors.invalid };
  let day: Date;
  try {
    day = calendarDateFromISO(date);
  } catch {
    return { error: dict.errors.invalid };
  }
  await getPrisma().attendanceRecord.upsert({
    where: { userId_date_courseScope: { userId, date: day, courseScope: courseId ?? "none" } },
    create: {
      userId,
      courseId,
      courseScope: courseId ?? "none",
      date: day,
      status: status as AttendanceStatus,
      source: "MANUAL",
      recordedById: session.id,
      minutesLate: status === "LATE" ? null : 0,
    },
    update: {
      status: status as AttendanceStatus,
      source: "MANUAL",
      recordedById: session.id,
    },
  });
  refreshAttendance(courseId);
  return { success: dict.common.saved };
}

export async function saveAttendanceTimesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("manage_attendance");
  const dict = getDictionary(await getLocale());
  const userId = field(formData, "userId");
  const date = field(formData, "date");
  const courseId = optional(formData, "courseId");
  const checkIn = field(formData, "checkIn");
  const checkOut = field(formData, "checkOut");
  if (!userId || !parseHm(checkIn)) return { error: dict.errors.invalid };
  let day: Date;
  let checkInTime: Date;
  let checkOutTime: Date | null = null;
  try {
    day = calendarDateFromISO(date);
    checkInTime = zonedDateTime(date, checkIn);
    if (checkOut) {
      if (!parseHm(checkOut)) return { error: dict.errors.invalid };
      checkOutTime = zonedDateTime(date, checkOut);
    }
  } catch {
    return { error: dict.errors.invalid };
  }
  if (checkOutTime && checkOutTime.getTime() < checkInTime.getTime()) return { error: dict.errors.invalid };
  const arrival = await resolveArrivalStatus(checkInTime, courseId);
  const totalMinutes = checkOutTime ? Math.max(0, Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000)) : null;
  await getPrisma().attendanceRecord.upsert({
    where: { userId_date_courseScope: { userId, date: day, courseScope: courseId ?? "none" } },
    create: {
      userId,
      courseId,
      courseScope: courseId ?? "none",
      date: day,
      status: arrival.status,
      checkInTime,
      checkOutTime,
      minutesLate: arrival.minutesLate,
      totalMinutes,
      source: "MANUAL",
      recordedById: session.id,
    },
    update: {
      status: arrival.status,
      checkInTime,
      checkOutTime,
      minutesLate: arrival.minutesLate,
      totalMinutes,
      source: "MANUAL",
      recordedById: session.id,
    },
  });
  refreshAttendance(courseId);
  return { success: dict.common.saved };
}

export async function clearAttendanceTimesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_attendance");
  const dict = getDictionary(await getLocale());
  const userId = field(formData, "userId");
  const date = field(formData, "date");
  const courseId = optional(formData, "courseId");
  if (!userId) return { error: dict.errors.invalid };
  let day: Date;
  try {
    day = calendarDateFromISO(date);
  } catch {
    return { error: dict.errors.invalid };
  }
  await getPrisma().attendanceRecord.updateMany({
    where: { userId, date: day, courseScope: courseId ?? "none" },
    data: { checkInTime: null, checkOutTime: null, totalMinutes: null, minutesLate: null },
  });
  refreshAttendance(courseId);
  return { success: dict.common.saved };
}

export async function markAllAttendedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("manage_attendance");
  const dict = getDictionary(await getLocale());
  const date = field(formData, "date");
  const courseId = optional(formData, "courseId");
  const ids = formData.getAll("userId").filter((value): value is string => typeof value === "string" && value.length > 0);
  if (ids.length === 0) return { error: dict.errors.invalid };
  let day: Date;
  try {
    day = calendarDateFromISO(date);
  } catch {
    return { error: dict.errors.invalid };
  }
  const db = getPrisma();
  const currentYear = activeStudentWhere();
  const allowed = await db.user.findMany({
    where: courseId
      ? { id: { in: ids }, ...currentYear, enrollments: { some: { courseId } } }
      : { id: { in: ids }, ...currentYear, roles: { some: { role: { slug: "student" } } } },
    select: { id: true },
  });
  if (allowed.length === 0) return { error: dict.errors.invalid };
  const scope = courseId ?? "none";
  await db.$transaction(
    allowed.map((student) =>
      db.attendanceRecord.upsert({
        where: { userId_date_courseScope: { userId: student.id, date: day, courseScope: scope } },
        create: {
          userId: student.id,
          courseId,
          courseScope: scope,
          date: day,
          status: "ATTENDED",
          source: "MANUAL",
          recordedById: session.id,
          minutesLate: 0,
        },
        update: { status: "ATTENDED", source: "MANUAL", recordedById: session.id },
      }),
    ),
  );
  refreshAttendance(courseId);
  return { success: String(allowed.length) };
}

export async function saveGlobalAttendanceSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("configure_attendance_settings");
  const dict = getDictionary(await getLocale());
  const officialStartTime = field(formData, "officialStartTime");
  const grace = Number(field(formData, "lateGraceMinutes") || "0");
  const autoCheckoutTime = optional(formData, "autoCheckoutTime");
  if (!parseHm(officialStartTime) || !Number.isFinite(grace) || grace < 0 || grace > 180) return { error: dict.errors.invalid };
  if (autoCheckoutTime && !parseHm(autoCheckoutTime)) return { error: dict.errors.invalid };
  await getPrisma().attendanceSetting.upsert({
    where: { scopeKey: "global" },
    create: {
      scopeKey: "global",
      isGlobal: true,
      officialStartTime,
      lateGraceMinutes: grace,
      autoCheckoutTime,
    },
    update: { officialStartTime, lateGraceMinutes: grace, autoCheckoutTime, isGlobal: true },
  });
  revalidatePath("/settings");
  return { success: dict.settings.saved };
}

export async function saveCourseAttendanceSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("configure_attendance_settings");
  const dict = getDictionary(await getLocale());
  const courseId = field(formData, "courseId");
  const officialStartTime = field(formData, "officialStartTime");
  const grace = Number(field(formData, "lateGraceMinutes") || "0");
  const autoCheckoutTime = optional(formData, "autoCheckoutTime");
  if (!courseId || !parseHm(officialStartTime) || !Number.isFinite(grace) || grace < 0) return { error: dict.errors.invalid };
  const course = await getPrisma().course.findUnique({ where: { id: courseId } });
  if (!course) return { error: dict.errors.invalid };
  await getPrisma().attendanceSetting.upsert({
    where: { scopeKey: courseId },
    create: {
      scopeKey: courseId,
      courseId,
      isGlobal: false,
      officialStartTime,
      lateGraceMinutes: grace,
      autoCheckoutTime,
    },
    update: { officialStartTime, lateGraceMinutes: grace, autoCheckoutTime },
  });
  revalidatePath("/settings");
  return { success: dict.settings.saved };
}

export async function simulateTerminalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_attendance");
  const dict = getDictionary(await getLocale());
  const badge = field(formData, "hardwareBadgeId");
  const timestampRaw = field(formData, "timestamp");
  const courseId = optional(formData, "courseId");
  if (!badge) return { error: dict.errors.invalid };
  let timestamp: Date | undefined;
  if (timestampRaw) {
    timestamp = new Date(timestampRaw);
    if (Number.isNaN(timestamp.getTime())) return { error: dict.terminal.invalidTime };
  }
  const result = await recordTerminalTap({
    hardwareBadgeId: badge,
    timestamp,
    courseId,
    source: "KIOSK",
  });
  revalidatePath("/attendance");
  revalidatePath("/terminal");
  if (!result.ok) {
    if (result.error === "UNKNOWN_BADGE") return { error: dict.terminal.unknown };
    if (result.error === "UNKNOWN_COURSE") return { error: dict.terminal.unknownCourse };
    if (result.error === "ALREADY_COMPLETE") return { error: dict.terminal.already };
    return { error: dict.terminal.invalidTime };
  }
  const name = `${result.student.firstName} ${result.student.lastName}`;
  const label = result.action === "CHECK_IN" ? dict.terminal.checkIn : dict.terminal.checkOut;
  return { success: `${label}: ${name} · ${dict.status[result.record.status]}` };
}
