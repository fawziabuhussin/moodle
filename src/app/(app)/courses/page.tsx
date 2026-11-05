import Link from "next/link";
import { Ltr } from "@/components/ltr";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Input, Textarea } from "@/components/ui/input";
import { getLocale, requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { activeStudentWhere } from "@/lib/cohort";
import { createCourseAction } from "@/server/actions/learning";

export default async function CoursesPage() {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  const manager = hasPermission(session.permissions, "manage_courses");
  const courses = await getPrisma().course.findMany({
    where: manager
      ? {}
      : { OR: [{ teachers: { some: { userId: session.id } } }, { enrollments: { some: { userId: session.id } } }] },
    include: {
      _count: { select: { teachers: true } },
      enrollments: { where: { user: activeStudentWhere() }, select: { userId: true } },
    },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <PageHeader title={dict.courses.title} description={dict.courses.subtitle} />
      {manager ? (
        <ActionForm action={createCourseAction} className="mb-4 grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{dict.courses.createTitle}</h2>
          <Input name="code" placeholder={dict.courses.code} required />
          <Input name="title" placeholder={dict.courses.postTitle} required />
          <Textarea name="description" placeholder={dict.courses.description} className="md:col-span-2" />
          <div className="md:col-span-2">
            <SubmitButton label={dict.common.create} pendingLabel={dict.common.saving} />
          </div>
        </ActionForm>
      ) : null}
      {courses.length === 0 ? <p className="text-sm text-muted-foreground">{dict.courses.empty}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4 hover:bg-accent">
            <p className="text-xs text-muted-foreground"><Ltr>{course.code}</Ltr></p>
            <h2 className="font-semibold">{course.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {course.enrollments.length} · {course._count.teachers}
              {!course.isActive ? ` · ${dict.courses.inactive}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
