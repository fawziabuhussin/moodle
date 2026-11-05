import type { Prisma } from "@prisma/client";

export const ACTIVE_COHORT = "2026-2027";
export const ARCHIVE_COHORT = "2025-2026";

type CohortUser = {
  hardwareBadgeId?: string | null;
  studentProfile?: { cohort: string | null } | null;
};

export function activeStudentWhere(): Prisma.UserWhereInput {
  return {
    isActive: true,
    OR: [
      { studentProfile: { is: { cohort: ACTIVE_COHORT } } },
      { hardwareBadgeId: { startsWith: "STU-26" } },
    ],
  };
}

export function archiveStudentWhere(): Prisma.UserWhereInput {
  return {
    isActive: true,
    OR: [
      { studentProfile: { is: { cohort: ARCHIVE_COHORT } } },
      { hardwareBadgeId: { startsWith: "STU-25" } },
    ],
  };
}

export function isCurrentYearStudent(user: CohortUser) {
  return user.studentProfile?.cohort === ACTIVE_COHORT || (user.hardwareBadgeId ?? "").startsWith("STU-26");
}
