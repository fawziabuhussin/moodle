export const PERMISSIONS = [
  "manage_users_and_roles",
  "manage_courses",
  "post_course_feed",
  "manage_exams_and_grades",
  "manage_attendance",
  "configure_attendance_settings",
  "manage_stipends",
  "manage_private_sessions",
  "send_global_notifications",
  "manage_food_polls",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function hasPermission(permissions: readonly string[], permission: Permission) {
  return permissions.includes(permission);
}

export function hasAnyPermission(permissions: readonly string[], required: readonly Permission[]) {
  return required.some((permission) => permissions.includes(permission));
}
