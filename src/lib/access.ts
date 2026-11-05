import "server-only";

import { getPrisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const STUDENT_VIEW_PERMISSIONS = [
  "manage_users_and_roles",
  "manage_stipends",
  "manage_private_sessions",
  "manage_attendance",
  "manage_exams_and_grades",
  "manage_courses",
] as const;

export async function canViewStudent(session: SessionUser, studentId: string) {
  if (session.id === studentId) return true;
  if (hasAnyPermission(session.permissions, STUDENT_VIEW_PERMISSIONS)) return true;
  const shared = await getPrisma().courseTeacher.findFirst({
    where: {
      userId: session.id,
      course: { enrollments: { some: { userId: studentId } } },
    },
  });
  return Boolean(shared);
}

export function canSeeFinance(session: SessionUser, studentId: string) {
  return (
    session.id === studentId ||
    hasAnyPermission(session.permissions, ["manage_users_and_roles", "manage_stipends"])
  );
}

export function canSeeStaffNotes(session: SessionUser) {
  return hasAnyPermission(session.permissions, ["manage_users_and_roles", "manage_private_sessions"]);
}

export async function loadCourseForSession(session: SessionUser, courseId: string) {
  const course = await getPrisma().course.findUnique({
    where: { id: courseId },
    include: {
      teachers: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
      enrollments: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              hardwareBadgeId: true,
              studentProfile: { select: { cohort: true } },
            },
          },
        },
        orderBy: { user: { firstName: "asc" } },
      },
    },
  });
  if (!course) return null;
  const isTeacher = course.teachers.some((teacher) => teacher.userId === session.id);
  const isEnrolled = course.enrollments.some((enrollment) => enrollment.userId === session.id);
  const isManager = hasPermission(session.permissions, "manage_courses");
  if (!isTeacher && !isEnrolled && !isManager) return null;
  return { course, isTeacher, isEnrolled, isManager };
}
