import type { DriveAccess, DriveVisibility } from "@prisma/client";

export type DriveGrant = {
  visibility: DriveVisibility;
  access: DriveAccess;
  allowedUserIds: string[];
  allowedCourseIds: string[];
  studentId?: string | null;
};

export type DriveViewer = {
  staff: boolean;
  userId: string;
  courseIds: string[];
};

export function grantMatches(item: DriveGrant, viewer: DriveViewer) {
  if (viewer.staff) return true;
  if (item.studentId && item.studentId === viewer.userId) return true;
  if (item.visibility === "ALL_STUDENTS") return true;
  if (item.visibility === "SPECIFIC_COURSES") return item.allowedCourseIds.some((id) => viewer.courseIds.includes(id));
  if (item.visibility === "SPECIFIC_STUDENTS") return item.allowedUserIds.includes(viewer.userId);
  return false;
}

export function canEditDrive(item: DriveGrant, viewer: DriveViewer) {
  if (viewer.staff) return true;
  return item.access === "EDIT" && grantMatches(item, viewer);
}
