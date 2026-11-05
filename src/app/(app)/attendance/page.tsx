import Link from "next/link";
import { AttendanceBoard } from "@/components/attendance/board";
import { SyncAttendanceButton } from "@/components/attendance/sync-button";
import { Ltr } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { getAttendanceSetting } from "@/lib/attendance";
import { getLocale, requirePermission } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import { activeStudentWhere } from "@/lib/cohort";
import { TERMINAL_PAGE_ENABLED } from "@/lib/constants";
import { appTimeZone, calendarDateFromISO, formatTime, todayISO } from "@/lib/time";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; courseId?: string }> }) {
  await requirePermission("manage_attendance");
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const query = await searchParams;
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : todayISO();
  const courseId = query.courseId || "";
  const db = getPrisma();
  const [courses, setting] = await Promise.all([
    db.course.findMany({ where: { isActive: true }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    getAttendanceSetting(courseId || null),
  ]);
  const currentYear = activeStudentWhere();
  const students = courseId
    ? (
        await db.courseEnrollment.findMany({
          where: { courseId, user: currentYear },
          include: { user: true },
          orderBy: { user: { firstName: "asc" } },
        })
      ).map((row) => row.user)
    : await db.user.findMany({
        where: { ...currentYear, roles: { some: { role: { slug: "student" } } } },
        orderBy: { firstName: "asc" },
      });
  const records = await db.attendanceRecord.findMany({
    where: { date: calendarDateFromISO(date), courseScope: courseId || "none", userId: { in: students.map((student) => student.id) } },
  });
  const byUser = new Map(records.map((record) => [record.userId, record]));

  return (
    <div>
      <PageHeader
        title={dict.attendance.title}
        description={dict.attendance.subtitle}
        action={<SyncAttendanceButton label={dict.attendance.sync} pendingLabel={dict.attendance.syncing} />}
      />
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>{dict.attendance.machine}</span>
        <Ltr>{setting?.officialStartTime ?? "16:00"}</Ltr>
        {TERMINAL_PAGE_ENABLED ? <Link href="/terminal" className="font-medium text-primary">{dict.nav.terminal}</Link> : null}
        <Ltr>POST /api/v1/attendance/terminal</Ltr>
      </p>
      <AttendanceBoard
        students={students.map((student) => {
          const record = byUser.get(student.id);
          return {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            badge: student.hardwareBadgeId,
            status: record?.status ?? null,
            checkIn: record?.checkInTime ? formatTime(record.checkInTime) : null,
            checkOut: record?.checkOutTime ? formatTime(record.checkOutTime) : null,
            minutesLate: record?.minutesLate ?? null,
            totalMinutes: record?.totalMinutes ?? null,
          };
        })}
        courses={courses}
        date={date}
        courseId={courseId}
        officialStart={setting?.officialStartTime ?? "16:00"}
        graceMinutes={setting?.lateGraceMinutes ?? 0}
        timeZone={appTimeZone()}
        labels={{
          search: dict.attendance.search,
          all: dict.attendance.all,
          unmarked: dict.attendance.unmarked,
          attended: dict.status.ATTENDED,
          late: dict.status.LATE,
          absent: dict.status.ABSENT,
          excused: dict.attendance.excusedShort,
          markAll: dict.attendance.markAll,
          marked: dict.attendance.marked,
          present: dict.attendance.present,
          lateCount: dict.attendance.lateCount,
          absentCount: dict.attendance.absentCount,
          addHours: dict.attendance.addHours,
          checkIn: dict.attendance.checkIn,
          checkOut: dict.attendance.checkOut,
          now: dict.attendance.now,
          officialStart: dict.attendance.officialStart,
          plusTwo: dict.attendance.plusTwo,
          save: dict.attendance.saveTimes,
          clearTimes: dict.attendance.clearTimes,
          lateTag: dict.attendance.lateTag,
          hoursTitle: dict.attendance.hoursTitle,
          close: dict.attendance.close,
          noStudents: dict.attendance.noStudents,
          noMatches: dict.attendance.noMatches,
          saved: dict.common.saved,
          invalid: dict.errors.invalid,
          date: dict.common.date,
          course: dict.attendance.course,
          allStudents: dict.attendance.allStudents,
          student: dict.common.name,
          status: dict.common.status,
          hours: dict.attendance.totalTime,
          previous: dict.attendance.previous,
          today: dict.attendance.today,
          next: dict.attendance.next,
        }}
      />
    </div>
  );
}
