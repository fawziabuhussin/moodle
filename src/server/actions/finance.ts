"use server";

import { revalidatePath } from "next/cache";
import type { PrivateSessionStatus, StipendStatus } from "@prisma/client";
import { monthAttendance } from "@/lib/attendance";
import { getLocale, requirePermission, requireUser } from "@/lib/auth";
import { canSeeStaffNotes } from "@/lib/access";
import { asNumber, formatDateTime, roundMoney } from "@/lib/format";
import { field, optional } from "@/lib/form";
import { fill, getDictionary } from "@/lib/i18n";
import { notifyUsers } from "@/lib/notifications";
import { getPrisma } from "@/lib/prisma";
import { activeStudentWhere } from "@/lib/cohort";
import { attendanceSnapshot, computeStipend } from "@/lib/stipends";
import { appTimeZone, currentPeriod, parseDateTimeLocal } from "@/lib/time";
import type { ActionState } from "@/lib/types";

const STIPEND_STATUSES = new Set(["PENDING", "APPROVED", "PAID", "CANCELLED"]);
const SESSION_STATUSES = new Set(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]);

export async function generateStipendsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const match = /^(\d{4})-(\d{2})$/.exec(field(formData, "period"));
  if (!match) return { error: dict.errors.invalid };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const db = getPrisma();
  const students = await db.user.findMany({
    where: { ...activeStudentWhere(), studentProfile: { isNot: null } },
    include: { studentProfile: true },
  });
  for (const student of students) {
    const existing = await db.stipendPayment.findUnique({
      where: { studentId_month_year: { studentId: student.id, month, year } },
    });
    if (existing) continue;
    const records = await monthAttendance(student.id, year, month);
    const snapshot = attendanceSnapshot(records);
    const base = asNumber(student.studentProfile?.defaultStipendAmount);
    const volunteeringCompliant = Boolean(student.studentProfile?.volunteeringPlace?.trim());
    const amounts = computeStipend({
      baseAmount: base,
      bonusAmount: 0,
      absenceCount: snapshot.absenceCount,
      lateCount: snapshot.lateCount,
      volunteeringCompliant,
    });
    await db.stipendPayment.create({
      data: {
        studentId: student.id,
        month,
        year,
        baseAmount: base,
        deductionAmount: amounts.deductionAmount,
        bonusAmount: 0,
        finalAmount: amounts.finalAmount,
        absenceCount: snapshot.absenceCount,
        lateCount: snapshot.lateCount,
        attendancePercent: snapshot.attendancePercent,
        notes: amounts.volunteerDays ? "missing-volunteering" : null,
      },
    });
  }
  revalidatePath("/stipends");
  revalidatePath("/students");
  return { success: dict.stipends.generated };
}

export async function updateStipendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  const status = field(formData, "status");
  const baseAmount = Number(field(formData, "baseAmount"));
  const deductionAmount = Number(field(formData, "deductionAmount"));
  const bonusAmount = Number(field(formData, "bonusAmount"));
  if (!id || !STIPEND_STATUSES.has(status) || [baseAmount, deductionAmount, bonusAmount].some((value) => !Number.isFinite(value) || value < 0)) {
    return { error: dict.errors.invalid };
  }
  const existing = await getPrisma().stipendPayment.findUnique({ where: { id } });
  if (!existing) return { error: dict.errors.invalid };
  await getPrisma().stipendPayment.update({
    where: { id },
    data: {
      baseAmount,
      deductionAmount,
      bonusAmount,
      finalAmount: roundMoney(Math.max(0, baseAmount - deductionAmount + bonusAmount)),
      status: status as StipendStatus,
      notes: optional(formData, "notes"),
      paidAt: status === "PAID" ? existing.paidAt ?? new Date() : null,
    },
  });
  revalidatePath("/stipends");
  revalidatePath(`/students/${existing.studentId}`);
  return { success: dict.common.saved };
}

export async function setStipendStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (!id || !STIPEND_STATUSES.has(status)) return { error: dict.errors.invalid };
  const existing = await getPrisma().stipendPayment.findUnique({ where: { id } });
  if (!existing) return { error: dict.errors.notFound };
  await getPrisma().stipendPayment.update({
    where: { id },
    data: {
      status: status as "PENDING" | "APPROVED" | "PAID" | "CANCELLED",
      paidAt: status === "PAID" ? existing.paidAt ?? new Date() : null,
    },
  });
  revalidatePath("/stipends");
  revalidatePath("/students");
  revalidatePath(`/students/${existing.studentId}`);
  return { success: dict.common.saved };
}

export async function bulkApproveStipendsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (ids.length === 0) return { error: getDictionary(await getLocale()).errors.invalid };
  const result = await getPrisma().stipendPayment.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { status: "APPROVED", paidAt: null },
  });
  revalidatePath("/stipends");
  revalidatePath("/students");
  return { success: String(result.count) };
}

export async function bulkPayStipendsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (ids.length === 0) return { error: getDictionary(await getLocale()).errors.invalid };
  const result = await getPrisma().stipendPayment.updateMany({
    where: { id: { in: ids }, status: "APPROVED" },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidatePath("/stipends");
  revalidatePath("/students");
  return { success: String(result.count) };
}

export async function ensureStudentStipendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const studentId = field(formData, "studentId");
  if (!studentId) return { error: dict.errors.invalid };
  const db = getPrisma();
  const { year, month } = currentPeriod();
  const existing = await db.stipendPayment.findUnique({ where: { studentId_month_year: { studentId, month, year } } });
  if (!existing) {
    const student = await db.user.findFirst({
      where: { id: studentId, ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
      include: { studentProfile: true },
    });
    if (!student) return { error: dict.errors.notFound };
    const base = asNumber(student.studentProfile?.defaultStipendAmount);
    const summary = attendanceSnapshot(await monthAttendance(studentId, year, month));
    const volunteeringCompliant = Boolean(student.studentProfile?.volunteeringPlace?.trim());
    const money = computeStipend({
      baseAmount: base,
      bonusAmount: 0,
      absenceCount: summary.absenceCount,
      lateCount: summary.lateCount,
      volunteeringCompliant,
    });
    await db.stipendPayment.create({
      data: {
        studentId,
        month,
        year,
        baseAmount: base,
        deductionAmount: money.deductionAmount,
        bonusAmount: 0,
        finalAmount: money.finalAmount,
        absenceCount: summary.absenceCount,
        lateCount: summary.lateCount,
        attendancePercent: summary.attendancePercent,
        notes: money.volunteerDays ? "missing-volunteering" : null,
      },
    });
  }
  revalidatePath("/stipends");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { success: dict.stipends.generated };
}

async function notifySession(studentId: string, staffId: string, title: string, when: Date, duration: number, created: boolean) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  await notifyUsers({
    recipientIds: [studentId],
    title: fill(created ? dict.sessions.scheduledNotice : dict.sessions.updatedNotice, { title }),
    body: fill(dict.sessions.noticeBody, {
      when: formatDateTime(when, locale, appTimeZone()),
      duration,
    }),
    audience: "INDIVIDUAL",
    createdById: staffId,
    linkUrl: "/sessions",
    priority: "IMPORTANT",
  });
}

export async function createSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("manage_private_sessions");
  const dict = getDictionary(await getLocale());
  const studentId = field(formData, "studentId");
  const title = field(formData, "title");
  const whenRaw = field(formData, "scheduledAt");
  const duration = Number(field(formData, "durationMinutes") || "45");
  const scheduledAt = parseDateTimeLocal(whenRaw);
  if (!studentId || !title || !scheduledAt || !Number.isFinite(duration) || duration < 10) {
    return { error: dict.errors.invalid };
  }
  const student = await getPrisma().user.findUnique({ where: { id: studentId } });
  if (!student) return { error: dict.errors.invalid };
  await getPrisma().privateSession.create({
    data: {
      studentId,
      staffId: session.id,
      title,
      scheduledAt,
      durationMinutes: duration,
      locationOrLink: optional(formData, "locationOrLink"),
      agenda: optional(formData, "agenda"),
      studentVisibleNotes: optional(formData, "studentVisibleNotes"),
      confidentialStaffNotes: optional(formData, "confidentialStaffNotes"),
      actionItems: optional(formData, "actionItems"),
    },
  });
  await notifySession(studentId, session.id, title, scheduledAt, duration, true);
  revalidatePath("/sessions");
  revalidatePath(`/students/${studentId}`);
  return { success: dict.sessions.saved };
}

export async function updateSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!canSeeStaffNotes(actor) && actor.roleSlugs.includes("student")) return { error: dict.errors.forbidden };
  if (!actor.permissions.includes("manage_private_sessions") && !actor.permissions.includes("manage_users_and_roles")) {
    return { error: dict.errors.forbidden };
  }
  const id = field(formData, "id");
  const status = field(formData, "status");
  const title = field(formData, "title");
  const whenRaw = field(formData, "scheduledAt");
  const duration = Number(field(formData, "durationMinutes") || "45");
  const scheduledAt = parseDateTimeLocal(whenRaw);
  if (!id || !title || !SESSION_STATUSES.has(status) || !scheduledAt) return { error: dict.errors.invalid };
  const existing = await getPrisma().privateSession.findUnique({ where: { id } });
  if (!existing) return { error: dict.errors.invalid };
  await getPrisma().privateSession.update({
    where: { id },
    data: {
      title,
      scheduledAt,
      durationMinutes: duration,
      locationOrLink: optional(formData, "locationOrLink"),
      status: status as PrivateSessionStatus,
      agenda: optional(formData, "agenda"),
      studentVisibleNotes: optional(formData, "studentVisibleNotes"),
      confidentialStaffNotes: optional(formData, "confidentialStaffNotes"),
      actionItems: optional(formData, "actionItems"),
    },
  });
  await notifySession(existing.studentId, actor.id, title, scheduledAt, duration, false);
  revalidatePath("/sessions");
  revalidatePath(`/students/${existing.studentId}`);
  return { success: dict.sessions.saved };
}
