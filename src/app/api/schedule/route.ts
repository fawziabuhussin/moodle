import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma, RecurrenceType, ScheduleCategory } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { notifyUsers, recipientIdsForAudience } from "@/lib/notifications";
import { activeStudentWhere } from "@/lib/cohort";
import { isHm, isIsoDate, RECURRENCE_TYPES, SCHEDULE_CATEGORIES } from "@/lib/schedule";
import { calendarDateFromISO } from "@/lib/time";

export const dynamic = "force-dynamic";

function canEdit(permissions: string[]) {
  return hasAnyPermission(permissions, ["manage_courses", "manage_attendance"]);
}

function readItem(body: Record<string, unknown>) {
  const titleHe = String(body.titleHe ?? "").trim();
  const titleAr = String(body.titleAr ?? "").trim();
  const category = String(body.category ?? "");
  const recurrenceType = String(body.recurrenceType ?? "WEEKLY");
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  const startDate = String(body.startDate ?? "");
  const endDate = body.endDate ? String(body.endDate) : "";
  const dayOfWeek = Number(body.dayOfWeek);
  const courseId = body.courseId ? String(body.courseId) : null;
  if (!titleHe || !titleAr) return { error: "Title is required." };
  if (!SCHEDULE_CATEGORIES.includes(category as ScheduleCategory)) return { error: "Invalid category." };
  if (!RECURRENCE_TYPES.includes(recurrenceType as RecurrenceType)) return { error: "Invalid repetition." };
  if (!isHm(startTime) || !isHm(endTime) || startTime >= endTime) return { error: "Invalid time range." };
  if (!isIsoDate(startDate) || (endDate && !isIsoDate(endDate))) return { error: "Invalid date." };
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { error: "Invalid day." };
  const data: Prisma.WeekPlanItemUncheckedCreateInput = {
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
    courseId,
    isActive: body.isActive !== false,
  };
  return { data, notify: body.notify === true };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await getPrisma().weekPlanItem.findMany({
    where: { isActive: true },
    include: { course: { select: { code: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      titleHe: item.titleHe,
      titleAr: item.titleAr,
      courseId: item.courseId,
      courseCode: item.course?.code ?? null,
      category: item.category,
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      roomOrLocation: item.roomOrLocation,
      instructorName: item.instructorName,
      recurrenceType: item.recurrenceType,
      startDate: item.startDate.toISOString().slice(0, 10),
      endDate: item.endDate ? item.endDate.toISOString().slice(0, 10) : null,
      isActive: item.isActive,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.permissions)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = readItem((await request.json()) as Record<string, unknown>);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const item = await getPrisma().weekPlanItem.create({
    data: { ...parsed.data, createdById: session.id },
  });
  if (parsed.notify) {
    const ids = parsed.data.courseId
      ? await recipientIdsForAudience("COURSE", { courseId: parsed.data.courseId })
      : (await getPrisma().user.findMany({
          where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
          select: { id: true },
        })).map((row) => row.id);
    await notifyUsers({
      recipientIds: ids,
      title: parsed.data.titleHe,
      body: `${parsed.data.startTime}–${parsed.data.endTime} · ${parsed.data.titleAr}`,
      audience: parsed.data.courseId ? "COURSE" : "ALL_STUDENTS",
      courseId: parsed.data.courseId,
      createdById: session.id,
      linkUrl: "/dashboard",
      priority: "NORMAL",
    });
  }
  revalidatePath("/dashboard");
  return NextResponse.json({ id: item.id });
}
