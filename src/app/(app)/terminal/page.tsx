import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Input, Select } from "@/components/ui/input";
import { simulateTerminalAction } from "@/server/actions/attendance";
import { getLocale, requirePermission } from "@/lib/auth";
import { TERMINAL_PAGE_ENABLED } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";

export default async function TerminalPage() {
  if (!TERMINAL_PAGE_ENABLED) redirect("/dashboard");
  await requirePermission("manage_attendance");
  const dict = getDictionary(await getLocale());
  const courses = await getPrisma().course.findMany({ where: { isActive: true }, orderBy: { title: "asc" } });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={dict.terminal.title} description={dict.terminal.subtitle} />
      <p className="mb-4 text-sm text-muted-foreground">{dict.terminal.hint}</p>
      <ActionForm action={simulateTerminalAction} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="grid gap-1 text-sm">
          {dict.terminal.badge}
          <Input name="hardwareBadgeId" autoComplete="off" placeholder="STU-1001" required className="h-14 text-center text-lg tracking-widest" />
        </label>
        <label className="grid gap-1 text-sm">
          {dict.terminal.timestamp}
          <Input type="datetime-local" name="timestamp" />
        </label>
        <label className="grid gap-1 text-sm">
          {dict.terminal.course}
          <Select name="courseId" defaultValue="">
            <option value="">{dict.attendance.allStudents}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
        </label>
        <SubmitButton label={dict.terminal.tap} pendingLabel={dict.common.saving} />
      </ActionForm>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium">{dict.terminal.apiTitle}</p>
        <p className="mt-1 text-muted-foreground">{dict.terminal.apiBody}</p>
      </div>
    </div>
  );
}
