"use server";

import { revalidatePath } from "next/cache";
import { getLocale, hashPassword, requirePermission } from "@/lib/auth";
import { field, isEmail, isUniqueConflict, optional } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { isPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

function dateOrNull(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

async function syncStudentProfile(userId: string, roleIds: string[], formData: FormData) {
  const db = getPrisma();
  const roles = await db.role.findMany({ where: { id: { in: roleIds } } });
  const isStudent = roles.some((role) => role.slug === "student");
  if (!isStudent) return;
  const amount = Number(field(formData, "defaultStipendAmount") || "0");
  await db.studentProfile.upsert({
    where: { userId },
    create: {
      userId,
      nationalId: optional(formData, "nationalId"),
      academicTrack: optional(formData, "academicTrack"),
      defaultStipendAmount: Number.isFinite(amount) ? amount : 0,
      city: optional(formData, "city"),
    },
    update: {
      nationalId: optional(formData, "nationalId"),
      academicTrack: optional(formData, "academicTrack"),
      defaultStipendAmount: Number.isFinite(amount) ? amount : 0,
      city: optional(formData, "city"),
    },
  });
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firstName = field(formData, "firstName");
  const lastName = field(formData, "lastName");
  const roleIds = formData.getAll("roleIds").map(String);
  if (!isEmail(email) || password.length < 8 || !firstName || !lastName) return { error: dict.errors.invalid };
  if (roleIds.length === 0) return { error: dict.users.roleRequired };

  try {
    const user = await getPrisma().user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        firstName,
        lastName,
        phone: optional(formData, "phone"),
        hardwareBadgeId: optional(formData, "hardwareBadgeId"),
        terminalPin: optional(formData, "terminalPin"),
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
    });
    await syncStudentProfile(user.id, roleIds, formData);
  } catch (error) {
    if (isUniqueConflict(error)) return { error: dict.users.emailTaken };
    return { error: dict.errors.generic };
  }
  revalidatePath("/users");
  revalidatePath("/students");
  return { success: dict.users.saved };
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firstName = field(formData, "firstName");
  const lastName = field(formData, "lastName");
  const roleIds = formData.getAll("roleIds").map(String);
  if (!id || !isEmail(email) || !firstName || !lastName) return { error: dict.errors.invalid };
  if (roleIds.length === 0) return { error: dict.users.roleRequired };
  if (password && password.length < 8) return { error: dict.errors.invalid };

  const db = getPrisma();
  try {
    await db.user.update({
      where: { id },
      data: {
        email,
        firstName,
        lastName,
        phone: optional(formData, "phone"),
        hardwareBadgeId: optional(formData, "hardwareBadgeId"),
        terminalPin: optional(formData, "terminalPin"),
        isActive: field(formData, "isActive") !== "0",
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
        roles: {
          deleteMany: {},
          create: roleIds.map((roleId) => ({ roleId })),
        },
      },
    });
    await syncStudentProfile(id, roleIds, formData);
  } catch (error) {
    if (isUniqueConflict(error)) return { error: dict.users.emailTaken };
    return { error: dict.errors.generic };
  }
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  revalidatePath("/students");
  return { success: dict.users.saved };
}

export async function updateStudentProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const userId = field(formData, "userId");
  if (!userId) return { error: dict.errors.invalid };
  const email = field(formData, "email").toLowerCase();
  if (email && !isEmail(email)) return { error: dict.errors.invalid };
  if (email) {
    const taken = await getPrisma().user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
    if (taken) return { error: dict.users.emailTaken };
  }
  const amount = Number(field(formData, "defaultStipendAmount") || "0");
  const confirmation = formData.getAll("hasBankConfirmation");
  await getPrisma().studentProfile.upsert({
    where: { userId },
    create: {
      userId,
      nationalId: optional(formData, "nationalId"),
      dateOfBirth: dateOrNull(optional(formData, "dateOfBirth")),
      address: optional(formData, "address"),
      city: optional(formData, "city"),
      academicTrack: optional(formData, "academicTrack"),
      bio: optional(formData, "bio"),
      defaultStipendAmount: Number.isFinite(amount) ? amount : 0,
      bankName: optional(formData, "bankName"),
      bankBranch: optional(formData, "bankBranch"),
      bankAccountNumber: optional(formData, "bankAccountNumber"),
      emergencyContactName: optional(formData, "emergencyContactName"),
      emergencyContactPhone: optional(formData, "emergencyContactPhone"),
      notes: optional(formData, "notes"),
    },
    update: {
      nationalId: optional(formData, "nationalId"),
      dateOfBirth: dateOrNull(optional(formData, "dateOfBirth")),
      address: optional(formData, "address"),
      city: optional(formData, "city"),
      academicTrack: optional(formData, "academicTrack"),
      bio: optional(formData, "bio"),
      defaultStipendAmount: Number.isFinite(amount) ? amount : 0,
      bankName: optional(formData, "bankName"),
      bankBranch: optional(formData, "bankBranch"),
      bankAccountNumber: optional(formData, "bankAccountNumber"),
      emergencyContactName: optional(formData, "emergencyContactName"),
      emergencyContactPhone: optional(formData, "emergencyContactPhone"),
      notes: optional(formData, "notes"),
      ...(confirmation.length > 0 ? { hasBankConfirmation: confirmation.includes("yes") } : {}),
    },
  });
  await getPrisma().user.update({
    where: { id: userId },
    data: { phone: optional(formData, "phone"), ...(email ? { email } : {}) },
  });
  revalidatePath(`/students/${userId}`);
  revalidatePath("/students");
  revalidatePath("/users");
  revalidatePath("/stipends");
  return { success: dict.common.saved };
}

export async function saveStudentAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const userId = field(formData, "userId");
  const email = field(formData, "email").toLowerCase();
  if (!userId || !isEmail(email)) return { error: dict.errors.invalid };
  const taken = await getPrisma().user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
  if (taken) return { error: dict.users.emailTaken };
  const confirmation = formData.getAll("hasBankConfirmation");
  await getPrisma().user.update({ where: { id: userId }, data: { email, phone: optional(formData, "phone") } });
  await getPrisma().studentProfile.update({
    where: { userId },
    data: {
      bankName: optional(formData, "bankName"),
      bankBranch: optional(formData, "bankBranch"),
      bankAccountNumber: optional(formData, "bankAccountNumber"),
      ...(confirmation.length > 0 ? { hasBankConfirmation: confirmation.includes("yes") } : {}),
    },
  });
  revalidatePath("/students");
  revalidatePath("/users");
  revalidatePath("/stipends");
  revalidatePath(`/students/${userId}`);
  return { success: dict.common.saved };
}

export async function resetStudentPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const userId = field(formData, "userId");
  const profile = await getPrisma().studentProfile.findUnique({ where: { userId }, select: { nationalId: true } });
  if (!profile?.nationalId || !/^\d{9}$/.test(profile.nationalId)) return { error: dict.errors.invalid };
  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(profile.nationalId) } });
  revalidatePath("/users");
  revalidatePath(`/students/${userId}`);
  return { success: dict.users.passwordReset };
}

export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const name = field(formData, "name");
  if (!name) return { error: dict.errors.invalid };
  const requested = field(formData, "slug").toLowerCase();
  const slug = /^[a-z0-9-]{2,40}$/.test(requested) ? requested : `role-${crypto.randomUUID().slice(0, 8)}`;
  const permissions = formData.getAll("permissions").map(String).filter(isPermission);
  try {
    await getPrisma().role.create({
      data: {
        name,
        slug,
        description: optional(formData, "description"),
        permissions,
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) return { error: dict.errors.invalid };
    return { error: dict.errors.generic };
  }
  revalidatePath("/roles");
  return { success: dict.roles.saved };
}

export async function updateRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  const role = await getPrisma().role.findUnique({ where: { id } });
  if (!role) return { error: dict.errors.invalid };
  if (role.isSystem) return { error: dict.roles.locked };
  const permissions = formData.getAll("permissions").map(String).filter(isPermission);
  await getPrisma().role.update({
    where: { id },
    data: {
      name: field(formData, "name") || role.name,
      description: optional(formData, "description"),
      permissions,
    },
  });
  revalidatePath("/roles");
  return { success: dict.roles.saved };
}

export async function deleteRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  const role = await getPrisma().role.findUnique({ where: { id } });
  if (!role || role.isSystem) return { error: dict.roles.locked };
  await getPrisma().role.delete({ where: { id } });
  revalidatePath("/roles");
  return { success: dict.roles.deleted };
}
