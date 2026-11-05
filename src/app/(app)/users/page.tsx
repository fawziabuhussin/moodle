import { PageHeader } from "@/components/page-header";
import { SeedAccountsButton } from "@/components/users/seed-accounts-button";
import { UsersConsole } from "@/components/users/users-console";
import { getLocale, requirePermission } from "@/lib/auth";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";

export default async function UsersPage() {
  const session = await requirePermission("manage_users_and_roles");
  const locale = (await getLocale()) as Locale;
  const dict = getDictionary(locale);
  const db = getPrisma();
  const [users, roles, courses] = await Promise.all([
    db.user.findMany({
      include: {
        roles: { include: { role: true } },
        studentProfile: { select: { nationalId: true, cohort: true, nameAr: true, nameHe: true } },
        enrollments: { select: { courseId: true } },
      },
      orderBy: { firstName: "asc" },
    }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } }),
    db.course.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, title: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title={dict.users.title}
        description={dict.users.subtitle}
        action={<SeedAccountsButton label={dict.users.seedAccounts} pendingLabel={dict.common.saving} done={dict.users.seedDone} />}
      />
      <UsersConsole
        locale={locale}
        currentUserId={session.id}
        roles={roles}
        courses={courses}
        users={users.map((user) => ({
          id: user.id,
          email: user.email,
          phone: user.phone,
          loginPassword: user.loginPassword,
          isActive: user.isActive,
          firstName: user.firstName,
          lastName: user.lastName,
          nameAr: user.nameAr || user.studentProfile?.nameAr || null,
          nameHe: user.nameHe || user.studentProfile?.nameHe || null,
          nationalId: user.studentProfile?.nationalId ?? null,
          cohort: user.studentProfile?.cohort ?? null,
          hardwareBadgeId: user.hardwareBadgeId,
          roles: user.roles.map((entry) => ({ id: entry.role.id, slug: entry.role.slug, name: entry.role.name })),
          courseIds: user.enrollments.map((entry) => entry.courseId),
        }))}
        labels={{
          addButton: dict.users.addButton,
          editUser: dict.users.editUser,
          createTitle: dict.users.createTitle,
          kpiActive: dict.users.kpiActive,
          kpiManagers: dict.users.kpiManagers,
          kpiTeachers: dict.users.kpiTeachers,
          kpiStudents: dict.users.kpiStudents,
          kpiCohort: dict.users.kpiCohort,
          filterAll: dict.users.filterAll,
          filterManagers: dict.users.filterManagers,
          filterTeachers: dict.users.filterTeachers,
          filterStudents: dict.users.filterStudents,
          filterArchived: dict.users.filterArchived,
          search: dict.users.search,
          nameAr: dict.users.nameAr,
          nameHe: dict.users.nameHe,
          email: dict.common.email,
          nationalId: dict.students.nationalId,
          phone: dict.common.phone,
          password: dict.users.password,
          passwordHint: dict.users.passwordHint,
          passwordStudentHint: dict.users.passwordStudentHint,
          primaryRole: dict.users.primaryRole,
          roleManager: dict.users.roleManager,
          roleTeacher: dict.users.roleTeacher,
          roleStudent: dict.users.roleStudent,
          extraRoles: dict.users.extraRoles,
          linkCourses: dict.users.linkCourses,
          cohort: dict.students.cohort,
          accountState: dict.users.accountState,
          active: dict.common.active,
          archived: dict.users.archived,
          archive: dict.users.archive,
          restore: dict.users.restore,
          archiveConfirm: dict.users.archiveConfirm,
          restoreConfirm: dict.users.restoreConfirm,
          status: dict.common.status,
          actions: dict.common.actions,
          user: dict.common.name,
          contact: dict.users.contact,
          close: dict.attendance.close,
          save: dict.common.save,
          create: dict.common.create,
          saving: dict.common.saving,
          deleteAccount: dict.users.deleteAccount,
          deleteConfirm: dict.users.deleteConfirm,
          cancel: dict.common.cancel,
          noResults: dict.users.noResults,
          fullProfile: dict.users.fullProfile,
          passwordReset: dict.users.passwordReset,
        }}
      />
    </div>
  );
}
