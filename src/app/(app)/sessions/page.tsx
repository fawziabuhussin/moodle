import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SessionsBoard } from "@/components/sessions/board";
import { canSeeStaffNotes, isStudentPortal } from "@/lib/access";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { activeStudentWhere } from "@/lib/cohort";
import { appTimeZone, formatDateTimeLocal, formatTime } from "@/lib/time";
import { fullName } from "@/lib/utils";

function sessionStamp(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${formatTime(date, timeZone)} - ${parts}`;
}

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  if (isStudentPortal(session)) redirect("/dashboard?notice=forbidden");
  const manager = hasPermission(session.permissions, "manage_private_sessions");
  if (!manager) redirect("/dashboard?notice=forbidden");
  const preselect = (await searchParams).studentId ?? "";
  const db = getPrisma();
  const zone = appTimeZone();
  const now = Date.now();
  const sessions = await db.privateSession.findMany({
    where: { student: { isActive: true } },
    include: { student: { include: { studentProfile: { select: { nationalId: true } } } } },
    orderBy: { scheduledAt: "asc" },
  });
  const students = await db.user.findMany({
    where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
    include: { studentProfile: { select: { nationalId: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return (
    <div>
      <PageHeader title={dict.sessions.title} />
      <SessionsBoard
        preselect={preselect}
        showStaffNotes={canSeeStaffNotes(session)}
        students={students.map((student) => ({
          id: student.id,
          name: fullName(student),
          nationalId: student.studentProfile?.nationalId ?? "",
        }))}
        rows={sessions.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          when: formatDateTimeLocal(item.scheduledAt, zone),
          stamp: sessionStamp(item.scheduledAt, zone),
          upcoming: item.status === "SCHEDULED" && item.scheduledAt.getTime() >= now,
          duration: item.durationMinutes,
          location: item.locationOrLink ?? "",
          agenda: item.agenda ?? "",
          visibleNotes: item.studentVisibleNotes ?? "",
          staffNotes: item.confidentialStaffNotes ?? "",
          actionItems: item.actionItems ?? "",
          studentId: item.studentId,
          studentName: fullName(item.student),
          nationalId: item.student.studentProfile?.nationalId ?? "",
        }))}
        labels={{
          title: dict.sessions.title,
          meetingTitle: dict.courses.postTitle,
          create: dict.sessions.createTitle,
          createButton: dict.sessions.createButton,
          save: dict.common.save,
          saving: dict.common.saving,
          close: dict.common.cancel,
          edit: dict.common.edit,
          upcoming: dict.sessions.upcoming,
          past: dict.sessions.past,
          upcomingCount: dict.sessions.upcomingCount,
          none: dict.sessions.none,
          meetingType: dict.sessions.meetingType,
          academic: dict.sessions.academic,
          absence: dict.sessions.absence,
          committee: dict.sessions.committee,
          mentoring: dict.sessions.mentoring,
          academicAgenda: dict.sessions.academicAgenda,
          absenceAgenda: dict.sessions.absenceAgenda,
          committeeAgenda: dict.sessions.committeeAgenda,
          mentoringAgenda: dict.sessions.mentoringAgenda,
          markCompleted: dict.sessions.markCompleted,
          cancelMeeting: dict.sessions.cancelMeeting,
          general: dict.sessions.general,
          chooseStudent: dict.sessions.chooseStudent,
          student: dict.sessions.student,
          when: dict.sessions.when,
          duration: dict.sessions.duration,
          location: dict.sessions.location,
          agenda: dict.sessions.agenda,
          visibleNotes: dict.sessions.visibleNotes,
          staffNotes: dict.sessions.staffNotes,
          actionItems: dict.sessions.actionItems,
          status: dict.common.status,
          statuses: {
            SCHEDULED: dict.status.SCHEDULED,
            COMPLETED: dict.status.COMPLETED,
            CANCELLED: dict.status.CANCELLED,
            NO_SHOW: dict.status.NO_SHOW,
          },
        }}
      />
    </div>
  );
}
