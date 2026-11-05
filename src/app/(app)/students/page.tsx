import { redirect } from "next/navigation";
import { StudentsDirectory } from "@/components/students/directory";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { asNumber, formatDate, formatMoney, formatPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { archiveStudentWhere, activeStudentWhere } from "@/lib/cohort";
import { attendanceSnapshot } from "@/lib/stipends";
import { appTimeZone, currentPeriod, monthRange } from "@/lib/time";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const staff = hasAnyPermission(session.permissions, [
    "manage_users_and_roles",
    "manage_attendance",
    "manage_stipends",
    "manage_private_sessions",
    "manage_courses",
    "manage_exams_and_grades",
  ]);
  if (!staff && session.roleSlugs.includes("student")) redirect(`/students/${session.id}`);

  const archive = (await searchParams).view === "archive";
  const yearWhere = archive ? archiveStudentWhere() : activeStudentWhere();
  const db = getPrisma();
  const roleWhere = { roles: { some: { role: { slug: "student" } } } };
  const teacherWhere = staff ? {} : { enrollments: { some: { course: { teachers: { some: { userId: session.id } } } } } };
  const ids = (await db.user.findMany({
    where: { ...yearWhere, ...roleWhere, ...teacherWhere },
    select: { id: true },
  })).map((row) => row.id);
  const [activeCount, archiveCount] = await Promise.all([
    db.user.count({ where: { ...activeStudentWhere(), ...roleWhere, ...teacherWhere } }),
    db.user.count({ where: { ...archiveStudentWhere(), ...roleWhere, ...teacherWhere } }),
  ]);

  const period = currentPeriod();
  const range = monthRange(period.year, period.month);
  const [people, records, payments, sessions, studentRole] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids } },
      include: {
        studentProfile: true,
        enrollments: { include: { course: { select: { id: true, code: true, title: true } } } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    ids.length === 0
      ? Promise.resolve([])
      : db.attendanceRecord.findMany({
          where: { userId: { in: ids }, date: { gte: range.start, lt: range.end } },
          select: { userId: true, status: true },
        }),
    ids.length === 0
      ? Promise.resolve([])
      : db.stipendPayment.findMany({
          where: { studentId: { in: ids }, year: period.year, month: period.month },
          select: { studentId: true, status: true, finalAmount: true },
        }),
    ids.length === 0
      ? Promise.resolve([])
      : db.privateSession.groupBy({
          by: ["studentId"],
          where: { studentId: { in: ids } },
          _max: { scheduledAt: true },
        }),
    db.role.findUnique({ where: { slug: "student" }, select: { id: true } }),
  ]);

  const recordsByStudent = new Map<string, { status: "ATTENDED" | "LATE" | "ABSENT" | "EXCUSED" }[]>();
  for (const record of records) {
    const list = recordsByStudent.get(record.userId) ?? [];
    list.push({ status: record.status });
    recordsByStudent.set(record.userId, list);
  }
  const stipendByStudent = new Map(payments.map((payment) => [payment.studentId, payment]));
  const sessionByStudent = new Map(sessions.map((row) => [row.studentId, row._max.scheduledAt]));
  const courseOptions = new Map<string, string>();

  const students = people.map((student) => {
    const snapshot = attendanceSnapshot(recordsByStudent.get(student.id) ?? []);
    const stipend = stipendByStudent.get(student.id);
    const last = sessionByStudent.get(student.id);
    for (const enrollment of student.enrollments) {
      courseOptions.set(enrollment.course.id, `${enrollment.course.code} · ${enrollment.course.title}`);
    }
    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      badge: student.hardwareBadgeId,
      phone: student.phone,
      track: student.studentProfile?.academicTrack ?? null,
      courses: student.enrollments.map((enrollment) => ({
        id: enrollment.course.id,
        code: enrollment.course.code,
        title: enrollment.course.title,
      })),
      attendancePercent: snapshot.attendancePercent,
      attendanceLabel: formatPercent(snapshot.attendancePercent, locale),
      stipendStatus: stipend?.status ?? null,
      stipendLabel: stipend ? formatMoney(asNumber(stipend.finalAmount), locale) : null,
      lastSession: last ? formatDate(last, locale, appTimeZone()) : null,
      nameAr: student.studentProfile?.nameAr ?? null,
      nationalId: student.studentProfile?.nationalId ?? null,
      stipendApproval: student.studentProfile?.stipendApproval ?? null,
      bankConfirmed: student.studentProfile?.hasBankConfirmation ?? false,
      cohort: student.studentProfile?.cohort ?? null,
      volunteering: student.studentProfile?.volunteeringPlace ?? null,
      city: student.studentProfile?.city ?? null,
      psychometry: student.studentProfile?.psychometryTrack ?? null,
    };
  });

  const tracks = [...new Set(students.map((student) => student.track).filter((track): track is string => Boolean(track)))].sort((a, b) => a.localeCompare(b, locale));

  return (
    <div>
      <PageHeader title={dict.students.title} description={dict.students.subtitle} />
      <StudentsDirectory
        students={students}
        tracks={tracks}
        courses={[...courseOptions.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, locale))}
        studentRoleId={studentRole?.id ?? null}
        archive={archive}
        activeCount={activeCount}
        archiveCount={archiveCount}
        canAdd={hasPermission(session.permissions, "manage_users_and_roles") && !archive}
        canLog={hasPermission(session.permissions, "manage_private_sessions") && !archive}
        canStipend={hasPermission(session.permissions, "manage_stipends") && !archive}
        labels={{
          search: dict.students.search,
          all: dict.common.all,
          filterTrack: dict.students.filterTrack,
          tracks: dict.students.tracks,
          courses: dict.students.courses,
          addStudent: dict.students.addStudent,
          viewProfile: dict.students.viewProfile,
          logSession: dict.students.logSession,
          addStipend: dict.students.addStipend,
          lastSession: dict.students.lastSession,
          noSession: dict.students.noSession,
          noStipend: dict.students.noStipend,
          thisMonth: dict.students.thisMonth,
          attendance: dict.students.attendanceRate,
          name: dict.common.name,
          actions: dict.common.actions,
          empty: dict.common.empty,
          noMatches: dict.attendance.noMatches,
          saved: dict.common.saved,
          close: dict.attendance.close,
          create: dict.common.create,
          saving: dict.common.saving,
          firstName: dict.users.firstName,
          lastName: dict.users.lastName,
          email: dict.common.email,
          phone: dict.common.phone,
          password: dict.users.password,
          badge: dict.users.badge,
          track: dict.students.track,
          defaultStipend: dict.students.defaultStipend,
          city: dict.students.city,
          volunteering: dict.students.volunteering,
          cohort: dict.students.cohort,
          nationalId: dict.students.nationalId,
          psychometry: dict.students.psychometry,
          bank: dict.students.bankConfirmation,
          bankYes: dict.students.bankConfirmed,
          bankNo: dict.students.bankMissing,
          openProfile: dict.students.viewProfile,
          activeYear: dict.students.activeYear,
          archiveYear: dict.students.archiveYear,
          archiveNote: dict.students.archiveNote,
          statuses: {
            PENDING: dict.status.PENDING,
            APPROVED: dict.status.APPROVED,
            PAID: dict.status.PAID,
            CANCELLED: dict.status.CANCELLED,
          },
        }}
      />
    </div>
  );
}
