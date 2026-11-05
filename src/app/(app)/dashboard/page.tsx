import { CommandCenter } from "@/components/dashboard/command-center";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { activeStudentWhere } from "@/lib/cohort";
import type { Locale } from "@/lib/constants";
import { dashboardCopy } from "@/lib/dashboard-copy";
import { formatDateTime } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasAnyPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { occursOn, type ScheduleItem } from "@/lib/schedule";
import { appTimeZone, calendarDate, todayISO } from "@/lib/time";
import { fullName } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const copy = dashboardCopy(locale);
  const notice = (await searchParams).notice;
  const db = getPrisma();
  const today = calendarDate(new Date());
  const todayKey = todayISO();
  const zone = appTimeZone();
  const executive = hasAnyPermission(session.permissions, ["manage_users_and_roles", "manage_attendance", "manage_courses", "manage_stipends"]);
  const current = activeStudentWhere();

  const [studentCount, track800, trackBase, courses, records, pending, plan, announcements, upcoming] = await Promise.all([
    db.user.count({ where: { ...current, roles: { some: { role: { slug: "student" } } } } }),
    db.courseEnrollment.count({ where: { course: { code: "PSY-800" }, user: current } }),
    db.courseEnrollment.count({ where: { course: { code: "PSY-BASE" }, user: current } }),
    db.course.findMany({ where: { isActive: true }, select: { id: true, code: true, title: true }, orderBy: { title: "asc" } }),
    db.attendanceRecord.groupBy({
      by: ["status"],
      where: { date: today, courseScope: "none", user: current },
      _count: { _all: true },
    }),
    db.studentProfile.count({
      where: {
        user: current,
        OR: [{ stipendApproval: { in: ["טרם אושר", "להגיש מחדש"] } }, { hasBankConfirmation: false }],
      },
    }),
    db.weekPlanItem.findMany({
      where: { isActive: true },
      include: { course: { select: { code: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    db.notification.findMany({
      where: { audience: { in: ["ALL_STUDENTS", "COURSE"] } },
      include: {
        course: { select: { code: true, title: true } },
        createdBy: { select: { firstName: true, lastName: true, roles: { include: { role: { select: { name: true } } } } } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.privateSession.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: new Date() },
        student: current,
        ...(executive ? {} : session.permissions.includes("manage_private_sessions") ? { OR: [{ staffId: session.id }, { studentId: session.id }] } : { studentId: session.id }),
      },
      include: { student: true, staff: true },
      orderBy: { scheduledAt: "asc" },
      take: 3,
    }),
  ]);

  const counts = { ATTENDED: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
  for (const row of records) counts[row.status] = row._count._all;
  const rate = studentCount === 0 ? 0 : Math.round(((counts.ATTENDED + counts.LATE) / studentCount) * 100);
  const items: ScheduleItem[] = plan.map((item) => ({
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
  }));
  const todayLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : locale === "en" ? "en-GB" : "he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
    timeZone: zone,
  }).format(new Date());

  return (
    <div>
      <PageHeader title={dict.dashboard.title} />
      <CommandCenter
        copy={copy}
        locale={locale}
        name={fullName(session)}
        role={session.roleNames[0] ?? ""}
        todayLabel={todayLabel}
        todayIso={todayKey}
        executive={executive}
        canSchedule={hasAnyPermission(session.permissions, ["manage_courses", "manage_attendance"])}
        canAnnounce={hasAnyPermission(session.permissions, ["post_course_feed", "send_global_notifications", "manage_courses"])}
        canModerate={hasAnyPermission(session.permissions, ["send_global_notifications", "manage_users_and_roles", "manage_courses"])}
        canAttend={session.permissions.includes("manage_attendance")}
        kpis={{
          students: studentCount,
          track800,
          trackBase,
          present: counts.ATTENDED,
          late: counts.LATE,
          absent: counts.ABSENT,
          rate,
          pending,
          courses: courses.length,
          todayClasses: items.filter((item) => occursOn(item, todayKey)).length,
        }}
        items={items}
        courses={courses}
        announcements={announcements.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          priority: item.priority,
          isPinned: item.isPinned,
          when: formatDateTime(item.createdAt, locale, zone),
          author: item.createdBy ? fullName(item.createdBy) : "",
          role: item.createdBy?.roles[0]?.role.name ?? "",
          course: item.course ? item.course.code : null,
        }))}
        sessions={upcoming.map((item) => ({
          id: item.id,
          title: item.title,
          when: formatDateTime(item.scheduledAt, locale, zone),
          person: fullName(session.roleSlugs.includes("student") ? item.staff : item.student),
          badge: session.roleSlugs.includes("student") ? null : item.student.hardwareBadgeId,
        }))}
        notice={notice === "forbidden" ? dict.errors.forbidden : null}
      />
    </div>
  );
}
