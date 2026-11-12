import { CoursesCatalog } from "@/components/courses/catalog";
import { courseProgress } from "@/components/courses/course-theme";
import { CreateCourseDialog } from "@/components/courses/create-course-dialog";
import { PageHeader } from "@/components/page-header";
import { isStudentPortal } from "@/lib/access";
import { getLocale, requireUser } from "@/lib/auth";
import { activeStudentWhere } from "@/lib/cohort";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export default async function CoursesPage() {
  const session = await requireUser();
  const dict = getDictionary(await getLocale());
  const portal = isStudentPortal(session);
  const manager = hasPermission(session.permissions, "manage_courses");
  const db = getPrisma();
  const [courses, students] = await Promise.all([
    db.course.findMany({
      where: manager
        ? {}
        : { OR: [{ teachers: { some: { userId: session.id } } }, { enrollments: { some: { userId: session.id } } }] },
      include: {
        _count: { select: { teachers: true } },
        enrollments: { where: { user: activeStudentWhere() }, select: { userId: true } },
      },
      orderBy: { code: "asc" },
    }),
    manager
      ? db.user.findMany({
          where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
          select: { id: true, firstName: true, lastName: true, hardwareBadgeId: true, studentProfile: { select: { psychometryTrack: true } } },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="min-w-0">
      <PageHeader
        title={portal ? dict.nav.studentCourses : dict.courses.title}
        description={portal ? undefined : dict.courses.subtitle}
        action={
          manager ? (
            <CreateCourseDialog
              label={dict.courses.createButton}
              title={dict.courses.createTitle}
              codeLabel={dict.courses.code}
              courseTitleLabel={dict.courses.postTitle}
              descriptionLabel={dict.courses.description}
              startLabel={dict.courses.startDate}
              endLabel={dict.courses.endDate}
              rosterLabel={dict.courses.rosterPick}
              searchLabel={dict.courses.rosterSearch}
              selectAllLabel={dict.courses.selectAll}
              select800Label={dict.courses.select800}
              selectBaseLabel={dict.courses.selectBase}
              clearLabel={dict.courses.clearRoster}
              selectedLabel={dict.courses.selectedCount}
              saveLabel={dict.common.create}
              savingLabel={dict.common.saving}
              closeLabel={dict.attendance.close}
              students={students.map((student) => ({
                id: student.id,
                name: fullName(student),
                badge: student.hardwareBadgeId,
                psychometry: student.studentProfile?.psychometryTrack ?? null,
              }))}
            />
          ) : null
        }
      />
      <CoursesCatalog
        courses={courses.map((course) => ({
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description,
          students: course.enrollments.length,
          teachers: course._count.teachers,
          active: course.isActive,
          startDate: isoDate(course.startDate),
          endDate: isoDate(course.endDate),
          progress: courseProgress(course.startDate, course.endDate),
        }))}
        searchLabel={dict.courses.search}
        studentsLabel={dict.courses.students}
        teachersLabel={dict.courses.teachers}
        inactiveLabel={dict.courses.inactive}
        activeLabel={dict.common.active}
        allLabel={dict.attendance.all}
        coursesLabel={portal ? dict.nav.studentCourses : dict.courses.title}
        emptyLabel={dict.courses.empty}
      />
    </div>
  );
}
