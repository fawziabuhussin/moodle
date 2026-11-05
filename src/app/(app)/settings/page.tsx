import { SyncRosterButton } from "@/components/files/sync-button";
import { SeedAccountsButton } from "@/components/users/seed-accounts-button";
import { ActionForm, SubmitButton } from "@/components/form";
import { Ltr } from "@/components/ltr";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { saveCourseAttendanceSettingsAction, saveGlobalAttendanceSettingsAction } from "@/server/actions/attendance";
import { getLocale, requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const session = await requirePermission("configure_attendance_settings");
  const canSeed = hasPermission(session.permissions, "manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const db = getPrisma();
  const [globalSetting, courses, overrides] = await Promise.all([
    db.attendanceSetting.findUnique({ where: { scopeKey: "global" } }),
    db.course.findMany({ where: { isActive: true }, orderBy: { title: "asc" } }),
    db.attendanceSetting.findMany({ where: { isGlobal: false }, include: { course: true } }),
  ]);

  return (
    <div>
      <PageHeader title={dict.settings.title} description={dict.settings.subtitle} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dict.settings.globalTitle}</CardTitle>
            <CardDescription>{dict.settings.hint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveGlobalAttendanceSettingsAction} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                {dict.settings.startTime}
                <Input type="time" name="officialStartTime" defaultValue={globalSetting?.officialStartTime ?? "16:00"} required />
              </label>
              <label className="grid gap-1 text-sm">
                {dict.settings.grace}
                <Input type="number" name="lateGraceMinutes" min={0} max={180} defaultValue={globalSetting?.lateGraceMinutes ?? 0} />
              </label>
              <label className="grid gap-1 text-sm">
                {dict.settings.autoCheckout}
                <Input type="time" name="autoCheckoutTime" defaultValue={globalSetting?.autoCheckoutTime ?? ""} />
              </label>
              <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dict.settings.courseOverride}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ActionForm action={saveCourseAttendanceSettingsAction} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                {dict.settings.course}
                <Select name="courseId" defaultValue={courses[0]?.id ?? ""} required>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-sm">
                {dict.settings.startTime}
                <Input type="time" name="officialStartTime" defaultValue="16:00" required />
              </label>
              <label className="grid gap-1 text-sm">
                {dict.settings.grace}
                <Input type="number" name="lateGraceMinutes" min={0} max={180} defaultValue={0} />
              </label>
              <label className="grid gap-1 text-sm">
                {dict.settings.autoCheckout}
                <Input type="time" name="autoCheckoutTime" />
              </label>
              <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
            </ActionForm>
            <ul className="grid gap-2 text-sm">
              {overrides.map((setting) => (
                <li key={setting.id} className="rounded-xl bg-secondary px-3 py-2">
                  {setting.course?.title}: <Ltr>{setting.officialStartTime}</Ltr> + <Ltr>{setting.lateGraceMinutes}</Ltr>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{dict.nav.files}</CardTitle>
            <CardDescription>2026-2027 · 2025-2026</CardDescription>
          </CardHeader>
          <CardContent>
            <SyncRosterButton label="סנכרון הרשימה האמיתית" pendingLabel={dict.common.saving} done={dict.common.saved} />
          </CardContent>
        </Card>
        {canSeed ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{dict.users.seedAccounts}</CardTitle>
              <CardDescription>{dict.users.seedDone.replace("{n}", "45")}</CardDescription>
            </CardHeader>
            <CardContent>
              <SeedAccountsButton label={dict.users.seedAccounts} pendingLabel={dict.common.saving} done={dict.users.seedDone} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
