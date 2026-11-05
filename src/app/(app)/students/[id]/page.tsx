import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr, Timestamp } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { TabLinks } from "@/components/tab-links";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { canSeeFinance, canSeeStaffNotes, canViewStudent, isStudentPortal } from "@/lib/access";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { asNumber, formatDate, formatMoney, formatMonth, formatPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { attendanceSnapshot } from "@/lib/stipends";
import { appTimeZone, formatMinutes, formatTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { updateStudentProfileAction } from "@/server/actions/people";

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const { id } = await params;
  if (isStudentPortal(session)) redirect(id === session.id ? "/student-board" : "/dashboard?notice=forbidden");
  if (!(await canViewStudent(session, id))) redirect("/dashboard?notice=forbidden");
  const db = getPrisma();
  const student = await db.user.findUnique({
    where: { id },
    include: {
      studentProfile: true,
      enrollments: { include: { course: true } },
      attendanceRecords: { orderBy: { date: "desc" }, take: 40 },
      stipendPayments: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      studentSessions: { include: { staff: true }, orderBy: { scheduledAt: "desc" } },
    },
  });
  if (!student) notFound();

  const requested = (await searchParams).tab;
  const tab = requested === "attendance" || requested === "stipends" || requested === "sessions" || requested === "courses" ? requested : "profile";
  const finance = canSeeFinance(session, student.id);
  const staffNotes = canSeeStaffNotes(session);
  const canEdit = hasPermission(session.permissions, "manage_users_and_roles");
  const snapshot = attendanceSnapshot(student.attendanceRecords);
  const hours = student.attendanceRecords.reduce((sum, record) => sum + (record.totalMinutes ?? 0), 0);
  const base = `/students/${student.id}`;
  const profile = student.studentProfile;

  return (
    <div>
      <PageHeader title={fullName(student)} description={profile?.academicTrack || <Ltr>{student.email}</Ltr>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label={dict.students.attendanceRate} value={formatPercent(snapshot.attendancePercent, locale)} progress={snapshot.attendancePercent} />
        <Stat label={dict.students.lateCount} value={String(snapshot.lateCount)} />
        <Stat label={dict.students.absences} value={String(snapshot.absenceCount)} />
        <Stat label={dict.students.totalHours} value={formatMinutes(hours)} />
      </div>
      <TabLinks
        current={tab}
        tabs={[
          { key: "profile", href: base, label: dict.students.profile },
          { key: "attendance", href: `${base}?tab=attendance`, label: dict.students.attendance },
          { key: "stipends", href: `${base}?tab=stipends`, label: dict.students.stipends },
          { key: "sessions", href: `${base}?tab=sessions`, label: dict.students.sessions },
          { key: "courses", href: `${base}?tab=courses`, label: dict.students.courses },
        ]}
      />

      {tab === "attendance" ? (
        <div className="min-w-0">
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm md:hidden">
            {student.attendanceRecords.map((record) => (
              <li key={record.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDate(record.date, locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    <Ltr>{`${record.checkInTime ? formatTime(record.checkInTime) : "—"} → ${record.checkOutTime ? formatTime(record.checkOutTime) : "—"} · ${formatMinutes(record.totalMinutes)}`}</Ltr>
                  </p>
                </div>
                <Badge tone={record.status}>{dict.status[record.status]}</Badge>
              </li>
            ))}
            {student.attendanceRecords.length === 0 ? <li className="p-4 text-sm text-muted-foreground">{dict.common.empty}</li> : null}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200/80 bg-card shadow-sm md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-3 py-2 text-start">{dict.common.date}</th>
                <th className="px-3 py-2 text-start">{dict.common.status}</th>
                <th className="px-3 py-2 text-start">{dict.attendance.checkIn}</th>
                <th className="px-3 py-2 text-start">{dict.attendance.checkOut}</th>
                <th className="px-3 py-2 text-start">{dict.attendance.totalTime}</th>
              </tr>
            </thead>
            <tbody>
              {student.attendanceRecords.map((record) => (
                <tr key={record.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{formatDate(record.date, locale)}</td>
                  <td className="px-3 py-2"><Badge tone={record.status}>{dict.status[record.status]}</Badge></td>
                  <td className="px-3 py-2">{record.checkInTime ? <Ltr>{formatTime(record.checkInTime)}</Ltr> : "—"}</td>
                  <td className="px-3 py-2">{record.checkOutTime ? <Ltr>{formatTime(record.checkOutTime)}</Ltr> : "—"}</td>
                  <td className="px-3 py-2"><Ltr>{formatMinutes(record.totalMinutes)}</Ltr></td>
                </tr>
              ))}
            </tbody>
          </table>
          {student.attendanceRecords.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{dict.common.empty}</p> : null}
          </div>
        </div>
      ) : null}

      {tab === "stipends" ? (
        <div className="grid gap-2">
          {student.stipendPayments.length === 0 ? <p className="text-sm text-muted-foreground">{dict.stipends.none}</p> : null}
          {student.stipendPayments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-s-4 border-slate-200/80 border-s-orange-400 bg-card px-4 py-3 text-sm shadow-sm">
              <div>
                <p className="font-medium">{formatMonth(payment.year, payment.month, locale)}</p>
                <p className="text-muted-foreground">{formatPercent(asNumber(payment.attendancePercent), locale)} · {dict.stipends.absences} {payment.absenceCount}</p>
              </div>
              <div className="flex items-center gap-2">
                <Ltr>{formatMoney(asNumber(payment.finalAmount), locale)}</Ltr>
                <Badge tone={payment.status}>{dict.status[payment.status]}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "sessions" ? (
        <div className="grid gap-3">
          {hasPermission(session.permissions, "manage_private_sessions") ? (
            <Link href={`/sessions?studentId=${student.id}`} className="text-sm font-medium text-primary">{dict.sessions.createTitle}</Link>
          ) : null}
          {student.studentSessions.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{item.title}</h2>
                <Badge tone={item.status}>{dict.status[item.status]}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground"><Timestamp value={item.scheduledAt} locale={locale} timeZone={appTimeZone()} /> · {fullName(item.staff)}</p>
              {item.studentVisibleNotes ? <p className="mt-2">{item.studentVisibleNotes}</p> : null}
              {staffNotes && item.confidentialStaffNotes ? <p className="mt-2 rounded-xl bg-secondary px-3 py-2">{item.confidentialStaffNotes}</p> : null}
            </article>
          ))}
          {student.studentSessions.length === 0 ? <p className="text-sm text-muted-foreground">{dict.sessions.none}</p> : null}
        </div>
      ) : null}

      {tab === "courses" ? (
        <div className="grid gap-2">
          {student.enrollments.map((enrollment) => (
            <Link key={enrollment.courseId} href={`/courses/${enrollment.courseId}`} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm px-4 py-3 hover:bg-accent">
              <span className="font-medium">{enrollment.course.title}</span>
              <Ltr className="ms-2 text-sm text-muted-foreground">{enrollment.course.code}</Ltr>
            </Link>
          ))}
          {student.enrollments.length === 0 ? <p className="text-sm text-muted-foreground">{dict.courses.empty}</p> : null}
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 text-sm">
            <h2 className="font-semibold">{dict.students.contact}</h2>
            <dl className="mt-3 grid gap-2">
              <Row label={dict.common.email} value={student.email} ltr />
              <Row label={dict.common.phone} value={student.phone} ltr />
              <Row label={dict.students.nationalId} value={profile?.nationalId} ltr />
              <Row label={dict.students.dob} value={profile?.dateOfBirth ? formatDate(profile.dateOfBirth, locale) : null} />
              <Row label={dict.students.nameAr} value={profile?.nameAr} />
              <Row label={dict.students.cohort} value={profile?.cohort} />
              <Row label={dict.students.psychometry} value={profile?.psychometryTrack} />
              <Row label={dict.students.volunteering} value={profile?.volunteeringPlace} />
              <Row label={dict.students.city} value={profile?.city} />
              <Row label={dict.students.address} value={profile?.address} />
              <Row label={dict.students.emergencyName} value={profile?.emergencyContactName} />
              <Row label={dict.students.emergencyPhone} value={profile?.emergencyContactPhone} ltr />
            </dl>
            {profile?.bio ? <p className="mt-3 text-muted-foreground">{profile.bio}</p> : null}
          </section>
          {finance ? (
            <section className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 text-sm">
              <h2 className="font-semibold">{dict.students.payment}</h2>
              <dl className="mt-3 grid gap-2">
                <Row label={dict.students.defaultStipend} value={formatMoney(asNumber(profile?.defaultStipendAmount), locale)} ltr />
                <Row label={dict.students.bankName} value={profile?.bankName} />
                <Row label={dict.students.bankBranch} value={profile?.bankBranch} ltr />
                <Row label={dict.students.bankAccount} value={profile?.bankAccountNumber} ltr />
                <Row label={dict.students.stipendApproval} value={profile?.stipendApproval} />
                <Row label={dict.students.bankConfirmation} value={profile?.hasBankConfirmation ? dict.students.bankConfirmed : dict.students.bankMissing} />
                <Row label={dict.users.badge} value={student.hardwareBadgeId} ltr />
                <Row label={dict.users.pin} value={student.terminalPin} ltr />
              </dl>
            </section>
          ) : null}
          {canEdit ? (
            <ActionForm action={updateStudentProfileAction} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 lg:col-span-2">
              <input type="hidden" name="userId" value={student.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="email" type="email" defaultValue={student.email} placeholder={dict.common.email} />
                <Input name="phone" defaultValue={student.phone ?? ""} placeholder={dict.common.phone} />
                <Input name="nationalId" defaultValue={profile?.nationalId ?? ""} placeholder={dict.students.nationalId} />
                <Input name="dateOfBirth" type="date" defaultValue={profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : ""} />
                <Input name="academicTrack" defaultValue={profile?.academicTrack ?? ""} placeholder={dict.students.track} />
                <Input name="city" defaultValue={profile?.city ?? ""} placeholder={dict.students.city} />
                <Input name="address" defaultValue={profile?.address ?? ""} placeholder={dict.students.address} />
                <Input name="emergencyContactName" defaultValue={profile?.emergencyContactName ?? ""} placeholder={dict.students.emergencyName} />
                <Input name="emergencyContactPhone" defaultValue={profile?.emergencyContactPhone ?? ""} placeholder={dict.students.emergencyPhone} />
                <Input name="defaultStipendAmount" type="number" min={0} step="0.01" defaultValue={asNumber(profile?.defaultStipendAmount)} />
                <Input name="bankName" defaultValue={profile?.bankName ?? ""} placeholder={dict.students.bankName} />
                <Input name="bankBranch" defaultValue={profile?.bankBranch ?? ""} placeholder={dict.students.bankBranch} />
                <Input name="bankAccountNumber" defaultValue={profile?.bankAccountNumber ?? ""} placeholder={dict.students.bankAccount} />
              </div>
              <Textarea name="bio" defaultValue={profile?.bio ?? ""} placeholder={dict.students.bio} />
              <Textarea name="notes" defaultValue={profile?.notes ?? ""} placeholder={dict.students.staffNotes} />
              <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
            </ActionForm>
          ) : staffNotes && profile?.notes ? (
            <section className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 text-sm">
              <h2 className="font-semibold">{dict.students.staffNotes}</h2>
              <p className="mt-2">{profile.notes}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, progress }: { label: string; value: string; progress?: number | null }) {
  const width = progress == null ? null : Math.max(0, Math.min(100, progress));
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-card px-4 py-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold"><Ltr>{value}</Ltr></p>
      {width != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-lime-600" style={{ width: `${width}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, ltr = false }: { label: string; value: string | null | undefined; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{ltr ? <Ltr>{value || "—"}</Ltr> : value || "—"}</dd>
    </div>
  );
}
