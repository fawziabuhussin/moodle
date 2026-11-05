import type { Prisma } from "@prisma/client";

export const ACTIVE_COHORT = "2026-2027";
export const ARCHIVE_COHORT = "2025-2026";

type CohortUser = {
  hardwareBadgeId?: string | null;
  studentProfile?: { cohort: string | null } | null;
};

function cohortMatch(cohort: string, badgePrefix: string): Prisma.UserWhereInput {
  return {
    OR: [
      { studentProfile: { is: { cohort } } },
      { hardwareBadgeId: { startsWith: badgePrefix } },
    ],
  };
}

/** Current or archive cohort, including students marked inactive. */
export function listedStudentWhere(archive = false): Prisma.UserWhereInput {
  return archive ? cohortMatch(ARCHIVE_COHORT, "STU-25") : cohortMatch(ACTIVE_COHORT, "STU-26");
}

export function activeStudentWhere(): Prisma.UserWhereInput {
  return { isActive: true, ...listedStudentWhere(false) };
}

export function archiveStudentWhere(): Prisma.UserWhereInput {
  return { isActive: true, ...listedStudentWhere(true) };
}

export function isCurrentYearStudent(user: CohortUser) {
  return user.studentProfile?.cohort === ACTIVE_COHORT || (user.hardwareBadgeId ?? "").startsWith("STU-26");
}
