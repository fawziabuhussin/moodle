import type { Permission } from "@/lib/permissions";

export type IconName =
  | "home"
  | "check"
  | "students"
  | "wallet"
  | "sessions"
  | "courses"
  | "bell"
  | "users"
  | "roles"
  | "settings"
  | "terminal"
  | "files";

export type NavKey =
  | "dashboard"
  | "attendance"
  | "students"
  | "stipends"
  | "sessions"
  | "courses"
  | "notifications"
  | "users"
  | "roles"
  | "settings"
  | "terminal"
  | "files"
  | "studentDashboard"
  | "studentBoard"
  | "studentNotifications"
  | "studentFiles"
  | "studentStipends"
  | "studentCourses";

export type NavSection = "academic" | "admin" | "system";

export type NavItem = {
  href: string;
  key: NavKey;
  icon: IconName;
  section: NavSection;
  permission?: Permission;
  anyOf?: Permission[];
  studentOr?: Permission;
};

// A future Calendar module can be appended here without rewriting the shell.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: "home", section: "academic" },
  { href: "/attendance", key: "attendance", icon: "check", section: "academic", permission: "manage_attendance" },
  { href: "/students", key: "students", icon: "students", section: "academic" },
  { href: "/files", key: "files", icon: "files", section: "academic" },
  { href: "/stipends", key: "stipends", icon: "wallet", section: "admin", studentOr: "manage_stipends" },
  { href: "/sessions", key: "sessions", icon: "sessions", section: "academic", studentOr: "manage_private_sessions" },
  { href: "/courses", key: "courses", icon: "courses", section: "academic" },
  { href: "/notifications", key: "notifications", icon: "bell", section: "admin" },
  { href: "/users", key: "users", icon: "users", section: "admin", permission: "manage_users_and_roles" },
  { href: "/roles", key: "roles", icon: "roles", section: "admin", permission: "manage_users_and_roles" },
  { href: "/settings", key: "settings", icon: "settings", section: "system", permission: "configure_attendance_settings" },
  { href: "/terminal", key: "terminal", icon: "terminal", section: "system", permission: "manage_attendance" },
];

export const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", key: "studentDashboard", icon: "home", section: "academic" },
  { href: "/student-board", key: "studentBoard", icon: "students", section: "academic" },
  { href: "/notifications", key: "studentNotifications", icon: "bell", section: "academic" },
  { href: "/files", key: "studentFiles", icon: "files", section: "academic" },
  { href: "/stipends", key: "studentStipends", icon: "wallet", section: "academic" },
  { href: "/courses", key: "studentCourses", icon: "courses", section: "academic" },
];
