export type ActionState = { error?: string; success?: string } | null;

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  permissions: string[];
  roleSlugs: string[];
  roleNames: string[];
};
