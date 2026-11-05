import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { Timestamp } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { canSeeStaffNotes } from "@/lib/access";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone, formatDateTimeLocal } from "@/lib/time";
import { fullName, safeHttpUrl } from "@/lib/utils";
import { createSessionAction, updateSessionAction } from "@/server/actions/finance";

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const manager = hasPermission(session.permissions, "manage_private_sessions");
  const isStudent = session.roleSlugs.includes("student");
  if (!manager && !isStudent) redirect("/dashboard?notice=forbidden");
  const preselect = (await searchParams).studentId ?? "";
  const db = getPrisma();
  const sessions = await db.privateSession.findMany({
    where: manager ? {} : { studentId: session.id },
    include: { student: true, staff: true },
    orderBy: { scheduledAt: "desc" },
  });
  const students = manager
    ? await db.user.findMany({
        where: { isActive: true, roles: { some: { role: { slug: "student" } } } },
        orderBy: { firstName: "asc" },
      })
    : [];
  const staffNotes = canSeeStaffNotes(session);

  return (
    <div>
      <PageHeader title={dict.sessions.title} description={dict.sessions.subtitle} />
      {manager ? (
        <ActionForm action={createSessionAction} className="mb-4 grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{dict.sessions.createTitle}</h2>
          <label className="grid gap-1 text-sm">
            {dict.sessions.student}
            <Select name="studentId" defaultValue={preselect} required>
              <option value="">{dict.common.all}</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{fullName(student)}</option>
              ))}
            </Select>
          </label>
          <Input name="title" placeholder={dict.courses.postTitle} required />
          <Input name="scheduledAt" type="datetime-local" required />
          <Input name="durationMinutes" type="number" min={10} defaultValue={45} placeholder={dict.sessions.duration} />
          <Input name="locationOrLink" placeholder={dict.sessions.location} className="md:col-span-2" />
          <Textarea name="agenda" placeholder={dict.sessions.agenda} />
          <Textarea name="studentVisibleNotes" placeholder={dict.sessions.visibleNotes} />
          <Textarea name="actionItems" placeholder={dict.sessions.actionItems} />
          <Textarea name="confidentialStaffNotes" placeholder={dict.sessions.staffNotes} />
          <div className="md:col-span-2">
            <SubmitButton label={dict.common.create} pendingLabel={dict.common.saving} />
          </div>
        </ActionForm>
      ) : null}
      <div className="grid gap-3">
        {sessions.length === 0 ? <p className="text-sm text-muted-foreground">{dict.sessions.none}</p> : null}
        {sessions.map((item) => {
          const link = safeHttpUrl(item.locationOrLink);
          return (
            <details key={item.id} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4" open={!manager}>
              <summary className="cursor-pointer list-none">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      <Timestamp value={item.scheduledAt} locale={locale} timeZone={appTimeZone()} /> · {fullName(manager ? item.student : item.staff)}
                    </span>
                  </span>
                  <Badge tone={item.status}>{dict.status[item.status]}</Badge>
                </span>
              </summary>
              <div className="mt-3 text-sm">
                {item.agenda ? <p>{item.agenda}</p> : null}
                {item.studentVisibleNotes ? <p className="mt-2">{item.studentVisibleNotes}</p> : null}
                {item.actionItems ? <p className="mt-2">{item.actionItems}</p> : null}
                {link ? <a className="mt-2 block text-primary" href={link}>{link}</a> : item.locationOrLink ? <p className="mt-2">{item.locationOrLink}</p> : null}
                {staffNotes && item.confidentialStaffNotes ? <p className="mt-2 rounded-xl bg-secondary px-3 py-2">{item.confidentialStaffNotes}</p> : null}
              </div>
              {manager ? (
                <ActionForm action={updateSessionAction} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="id" value={item.id} />
                  <Input name="title" defaultValue={item.title} required />
                  <Select name="status" defaultValue={item.status}>
                    {(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const).map((status) => (
                      <option key={status} value={status}>{dict.status[status]}</option>
                    ))}
                  </Select>
                  <Input name="scheduledAt" type="datetime-local" defaultValue={formatDateTimeLocal(item.scheduledAt)} required />
                  <Input name="durationMinutes" type="number" min={10} defaultValue={item.durationMinutes} />
                  <Input name="locationOrLink" defaultValue={item.locationOrLink ?? ""} className="md:col-span-2" />
                  <Textarea name="agenda" defaultValue={item.agenda ?? ""} />
                  <Textarea name="studentVisibleNotes" defaultValue={item.studentVisibleNotes ?? ""} />
                  <Textarea name="actionItems" defaultValue={item.actionItems ?? ""} />
                  {staffNotes ? <Textarea name="confidentialStaffNotes" defaultValue={item.confidentialStaffNotes ?? ""} /> : null}
                  <div className="md:col-span-2">
                    <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
                  </div>
                </ActionForm>
              ) : null}
            </details>
          );
        })}
      </div>
    </div>
  );
}
