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

export async function saveMonthStipendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const match = /^(\d{4})-(\d{2})$/.exec(field(formData, "period"));
  const studentId = field(formData, "studentId");
  const amount = Number(field(formData, "amount"));
  const notes = optional(formData, "notes");
  const requestedStatus = optional(formData, "status");
  const status = requestedStatus && STIPEND_STATUSES.has(requestedStatus) ? (requestedStatus as StipendStatus) : "PENDING";
  const deductionField = formData.has("deduction");
  const bonusField = formData.has("bonus");
  const deduction = deductionField ? Number(field(formData, "deduction") || "0") : 0;
  const bonus = bonusField ? Number(field(formData, "bonus") || "0") : 0;
  if (!match || !studentId || !Number.isFinite(amount) || amount < 0) return { error: dict.errors.invalid };
  if ((deductionField && (!Number.isFinite(deduction) || deduction < 0)) || (bonusField && (!Number.isFinite(bonus) || bonus < 0))) return { error: dict.errors.invalid };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const db = getPrisma();
  const student = await db.user.findFirst({
    where: { id: studentId, ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
    select: { id: true },
  });
  if (!student) return { error: dict.errors.notFound };
  const existing = await db.stipendPayment.findUnique({ where: { studentId_month_year: { studentId, month, year } } });
  const money = roundMoney(amount);
  const deductionAmount = deductionField ? roundMoney(deduction) : existing ? asNumber(existing.deductionAmount) : 0;
  const bonusAmount = bonusField ? roundMoney(bonus) : existing ? asNumber(existing.bonusAmount) : 0;
  const finalAmount = roundMoney(Math.max(0, money - deductionAmount + bonusAmount));
  const paidAt = status === "PAID" ? existing?.paidAt ?? new Date() : null;
  const amounts = { baseAmount: money, deductionAmount, bonusAmount, finalAmount, notes, status, paidAt };
  if (!existing) {
    await db.stipendPayment.create({ data: { studentId, month, year, ...amounts } });
  } else {
    await db.stipendPayment.update({ where: { id: existing.id }, data: amounts });
  }
  revalidatePath("/stipends");
  revalidatePath("/students");
  return { success: dict.common.saved };
}

export async function applyMonthAmountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const match = /^(\d{4})-(\d{2})$/.exec(field(formData, "period"));
  const amount = Number(field(formData, "amount"));
  const studentIds = formData.getAll("studentId").map(String).filter(Boolean);
  if (!match || !Number.isFinite(amount) || amount < 0 || studentIds.length === 0) return { error: dict.errors.invalid };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const db = getPrisma();
  const allowed = await db.user.findMany({
    where: { id: { in: studentIds }, ...activeStudentWhere() },
    select: { id: true },
  });
  const money = roundMoney(amount);
  for (const student of allowed) {
    const existing = await db.stipendPayment.findUnique({ where: { studentId_month_year: { studentId: student.id, month, year } } });
    if (existing?.status === "PAID") continue;
    if (!existing) {
      await db.stipendPayment.create({
        data: { studentId: student.id, month, year, baseAmount: money, deductionAmount: 0, bonusAmount: 0, finalAmount: money },
      });
    } else {
      await db.stipendPayment.update({
        where: { id: existing.id },
        data: { baseAmount: money, deductionAmount: 0, bonusAmount: 0, finalAmount: money },
      });
    }
  }
  revalidatePath("/stipends");
  revalidatePath("/students");
  return { success: dict.common.saved };
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

export async function deleteStipendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_stipends");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  if (!id) return { error: dict.errors.invalid };
  const existing = await getPrisma().stipendPayment.findUnique({ where: { id } });
  if (!existing) return { error: dict.errors.notFound };
  await getPrisma().stipendPayment.delete({ where: { id } });
  revalidatePath("/stipends");
  revalidatePath("/students");
  revalidatePath(`/students/${existing.studentId}`);
  return { success: dict.stipends.deleted };
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

export async function setSessionStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const dict = getDictionary(await getLocale());
  if (!actor.permissions.includes("manage_private_sessions") && !actor.permissions.includes("manage_users_and_roles")) {
    return { error: dict.errors.forbidden };
  }
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (!id || !SESSION_STATUSES.has(status)) return { error: dict.errors.invalid };
  const existing = await getPrisma().privateSession.findUnique({ where: { id } });
  if (!existing) return { error: dict.errors.invalid };
  if (existing.status !== status) {
    await getPrisma().privateSession.update({ where: { id }, data: { status: status as PrivateSessionStatus } });
    await notifySession(existing.studentId, actor.id, existing.title, existing.scheduledAt, existing.durationMinutes, false);
  }
  revalidatePath("/sessions");
  revalidatePath(`/students/${existing.studentId}`);
  return { success: dict.common.saved };
}
