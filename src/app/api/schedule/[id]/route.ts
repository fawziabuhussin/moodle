import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma, RecurrenceType, ScheduleCategory } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { isHm, isIsoDate, RECURRENCE_TYPES, SCHEDULE_CATEGORIES } from "@/lib/schedule";
import { calendarDateFromISO } from "@/lib/time";

export const dynamic = "force-dynamic";

function canEdit(permissions: string[]) {
  return hasAnyPermission(permissions, ["manage_courses", "manage_attendance"]);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.permissions)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const titleHe = String(body.titleHe ?? "").trim();
  const titleAr = String(body.titleAr ?? "").trim();
  const category = String(body.category ?? "");
  const recurrenceType = String(body.recurrenceType ?? "");
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  const startDate = String(body.startDate ?? "");
  const endDate = body.endDate ? String(body.endDate) : "";
  const dayOfWeek = Number(body.dayOfWeek);
  if (!titleHe || !titleAr) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!SCHEDULE_CATEGORIES.includes(category as ScheduleCategory)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  if (!RECURRENCE_TYPES.includes(recurrenceType as RecurrenceType)) return NextResponse.json({ error: "Invalid repetition." }, { status: 400 });
  if (!isHm(startTime) || !isHm(endTime) || startTime >= endTime) return NextResponse.json({ error: "Invalid time range." }, { status: 400 });
  if (!isIsoDate(startDate) || (endDate && !isIsoDate(endDate))) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return NextResponse.json({ error: "Invalid day." }, { status: 400 });
  const data: Prisma.WeekPlanItemUncheckedUpdateInput = {
    titleHe,
    titleAr,
    category: category as ScheduleCategory,
    recurrenceType: recurrenceType as RecurrenceType,
    dayOfWeek,
    startTime,
    endTime,
    startDate: calendarDateFromISO(startDate),
    endDate: endDate ? calendarDateFromISO(endDate) : null,
    roomOrLocation: body.roomOrLocation ? String(body.roomOrLocation).trim() : null,
    instructorName: body.instructorName ? String(body.instructorName).trim() : null,
    courseId: body.courseId ? String(body.courseId) : null,
    isActive: body.isActive !== false,
  };
  const existing = await getPrisma().weekPlanItem.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await getPrisma().weekPlanItem.update({ where: { id }, data });
  revalidatePath("/dashboard");
  return NextResponse.json({ id });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.permissions)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  await getPrisma().weekPlanItem.deleteMany({ where: { id } });
  revalidatePath("/dashboard");
  return NextResponse.json({ id });
}
