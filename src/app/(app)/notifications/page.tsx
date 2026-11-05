import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getLocale, requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { Timestamp } from "@/components/ltr";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone } from "@/lib/time";
import { fullName, safeHttpUrl } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction, sendBroadcastAction } from "@/server/actions/notify";

export default async function NotificationsPage() {
  const session = await requireUser();
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const manager = hasPermission(session.permissions, "send_global_notifications");
  const db = getPrisma();
  const [items, courses, students] = await Promise.all([
    db.userNotification.findMany({
      where: { userId: session.id },
      include: { notification: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    manager ? db.course.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }) : Promise.resolve([]),
    manager
      ? db.user.findMany({ where: { isActive: true, roles: { some: { role: { slug: "student" } } } }, orderBy: { firstName: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title={dict.notifications.title} description={dict.notifications.subtitle} />
      {manager ? (
        <ActionForm action={sendBroadcastAction} className="mb-4 grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
          <h2 className="font-semibold">{dict.notifications.composer}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              {dict.notifications.audience}
              <Select name="audience" defaultValue="ALL_STUDENTS">
                <option value="ALL_USERS">{dict.notifications.allUsers}</option>
                <option value="ALL_STUDENTS">{dict.notifications.allStudents}</option>
                <option value="ALL_TEACHERS">{dict.notifications.allTeachers}</option>
                <option value="COURSE">{dict.notifications.course}</option>
                <option value="INDIVIDUAL">{dict.notifications.individual}</option>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              {dict.notifications.course}
              <Select name="courseId" defaultValue="">
                <option value="">{dict.common.all}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              {dict.notifications.individual}
              <Select name="userId" defaultValue="">
                <option value="">{dict.common.all}</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{fullName(student)}</option>
                ))}
              </Select>
            </label>
          </div>
          <Input name="title" placeholder={dict.notifications.messageTitle} required />
          <Textarea name="body" placeholder={dict.notifications.body} required />
          <Select name="priority" defaultValue="NORMAL">
            <option value="NORMAL">{dict.status.NORMAL}</option>
            <option value="IMPORTANT">{dict.status.IMPORTANT}</option>
            <option value="URGENT">{dict.status.URGENT}</option>
          </Select>
          <SubmitButton label={dict.notifications.send} pendingLabel={dict.common.saving} />
          <p className="text-xs text-muted-foreground">{dict.notifications.pushNote}</p>
        </ActionForm>
      ) : null}
      <div className="mb-3">
        <ActionForm action={markAllNotificationsReadAction}>
          <SubmitButton label={dict.notifications.markAll} pendingLabel={dict.common.saving} variant="outline" />
        </ActionForm>
      </div>
      <div className="grid gap-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{dict.notifications.empty}</p> : null}
        {items.map((item) => {
          const href = safeHttpUrl(item.notification.linkUrl) ?? (item.notification.linkUrl?.startsWith("/") ? item.notification.linkUrl : null);
          return (
            <article key={item.id} className={`rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 ${item.readAt ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium">{item.notification.title}</h2>
                <Badge tone={item.notification.priority}>{dict.status[item.notification.priority]}</Badge>
              </div>
              <p className="mt-2 text-sm">{item.notification.body}</p>
              <p className="mt-2 text-xs text-muted-foreground"><Timestamp value={item.createdAt} locale={locale} timeZone={appTimeZone()} /></p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {href ? <a href={href} className="text-sm text-primary">{href}</a> : null}
                {!item.readAt ? (
                  <ActionForm action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton label={dict.notifications.markRead} pendingLabel={dict.common.saving} variant="ghost" size="sm" />
                  </ActionForm>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
