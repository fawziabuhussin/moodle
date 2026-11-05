"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, hashPassword, requirePermission } from "@/lib/auth";
import { ACTIVE_COHORT } from "@/lib/cohort";
import { field, isEmail, isNationalId, isUniqueConflict, optional } from "@/lib/form";
import { getDictionary } from "@/lib/i18n";
import { isPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "—", lastName: "—" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function dateOrNull(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function profileData(formData: FormData) {
  const amount = Number(field(formData, "defaultStipendAmount") || "0");
  const confirmation = formData.getAll("hasBankConfirmation");
  return {
    nationalId: optional(formData, "nationalId"),
    nameHe: optional(formData, "nameHe"),
    nameAr: optional(formData, "nameAr"),
    dateOfBirth: dateOrNull(optional(formData, "dateOfBirth")),
    gender: optional(formData, "gender"),
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
    cohort: optional(formData, "cohort"),
    psychometryTrack: optional(formData, "psychometryTrack"),
    volunteeringPlace: optional(formData, "volunteeringPlace"),
    stipendApproval: optional(formData, "stipendApproval"),
    ...(confirmation.length > 0 ? { hasBankConfirmation: confirmation.includes("yes") } : {}),
  };
}

async function syncStudentProfile(userId: string, roleIds: string[], formData: FormData) {
  const db = getPrisma();
  const roles = await db.role.findMany({ where: { id: { in: roleIds } } });
  if (!roles.some((role) => role.slug === "student")) return;
  const data = profileData(formData);
  await db.studentProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
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
  const nationalId = optional(formData, "nationalId");
  if (!isEmail(email) || password.length < 8 || !firstName || !lastName) return { error: dict.errors.invalid };
  if (nationalId && !isNationalId(nationalId)) return { error: dict.errors.invalid };
  if (roleIds.length === 0) return { error: dict.users.roleRequired };

  try {
    const user = await getPrisma().user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        loginPassword: password,
        firstName,
        lastName,
        nameAr: optional(formData, "nameAr"),
        nameHe: optional(formData, "nameHe") ?? `${firstName} ${lastName}`.trim(),
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
  const nationalId = optional(formData, "nationalId");
  if (!id || !isEmail(email) || !firstName || !lastName) return { error: dict.errors.invalid };
  if (nationalId && !isNationalId(nationalId)) return { error: dict.errors.invalid };
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
        nameAr: optional(formData, "nameAr"),
        nameHe: optional(formData, "nameHe") ?? `${firstName} ${lastName}`.trim(),
        phone: optional(formData, "phone"),
        locale: ["he", "ar", "en"].includes(field(formData, "locale")) ? field(formData, "locale") : undefined,
        hardwareBadgeId: optional(formData, "hardwareBadgeId"),
        terminalPin: optional(formData, "terminalPin"),
        isActive: field(formData, "isActive") !== "0",
        ...(password ? { passwordHash: await hashPassword(password), loginPassword: password } : {}),
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
  revalidatePath(`/students/${id}`);
  revalidatePath("/stipends");
  return { success: dict.users.saved };
}

export async function deleteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  if (!id) return { error: dict.errors.invalid };
  if (id === session.id) return { error: dict.users.cannotDeleteSelf };
  try {
    await getPrisma().user.delete({ where: { id } });
  } catch {
    return { error: dict.errors.generic };
  }
  revalidatePath("/users");
  revalidatePath("/students");
  revalidatePath("/stipends");
  redirect("/users");
}

const PRIMARY_ROLES = new Set(["manager", "teacher", "student"]);

export async function saveManagedUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const id = optional(formData, "id");
  const nameAr = optional(formData, "nameAr");
  const nameHe = optional(formData, "nameHe");
  const email = field(formData, "email").toLowerCase();
  const phone = optional(formData, "phone");
  const nationalId = optional(formData, "nationalId");
  const password = String(formData.get("password") ?? "").trim();
  const primary = field(formData, "primaryRole");
  const legalPrimary = PRIMARY_ROLES.has(primary) ? primary : null;
  const extraRoleIds = formData.getAll("extraRoleIds").map(String);
  const active = field(formData, "isActive") !== "0";
  const cohort = optional(formData, "cohort");
  const courseIds = [...new Set(formData.getAll("courseIds").map(String).filter(Boolean))];

  if (!isEmail(email) || (!nameAr && !nameHe)) return { error: dict.errors.invalid };
  if (nationalId && !isNationalId(nationalId)) return { error: dict.errors.invalid };
  if (password && password.length < 8) return { error: dict.errors.invalid };

  const db = getPrisma();
  const roles = await db.role.findMany({ select: { id: true, slug: true } });
  const primaryRole = legalPrimary ? roles.find((role) => role.slug === legalPrimary) : undefined;
  const extras = roles.filter((role) => extraRoleIds.includes(role.id) && !PRIMARY_ROLES.has(role.slug));
  const roleIds = [...(primaryRole ? [primaryRole.id] : []), ...extras.map((role) => role.id)];
  if (roleIds.length === 0) return { error: dict.users.roleRequired };

  const names = splitName(nameHe || nameAr || "");
  const initialPassword = password || (nationalId && isNationalId(nationalId) ? nationalId : "");
  if (!id && initialPassword.length < 8) return { error: dict.errors.invalid };
  const nextPasswordHash = !id ? await hashPassword(initialPassword) : password ? await hashPassword(password) : null;

  try {
    const userId = await db.$transaction(async (tx) => {
      const data = {
        email,
        phone,
        firstName: names.firstName,
        lastName: names.lastName,
        nameAr,
        nameHe: nameHe ?? `${names.firstName} ${names.lastName}`.trim(),
        isActive: active,
      };
      const saved = id
        ? await tx.user.update({
            where: { id },
            data: {
              ...data,
              ...(nextPasswordHash ? { passwordHash: nextPasswordHash, loginPassword: password } : {}),
              roles: { deleteMany: {}, create: roleIds.map((roleId) => ({ roleId })) },
            },
          })
        : await tx.user.create({
            data: {
              ...data,
              passwordHash: nextPasswordHash ?? "",
              loginPassword: initialPassword,
              roles: { create: roleIds.map((roleId) => ({ roleId })) },
            },
          });

      const existingProfile = await tx.studentProfile.findUnique({ where: { userId: saved.id }, select: { id: true } });
      if (legalPrimary === "student" || nationalId || existingProfile) {
        const profile = {
          nameAr,
          nameHe,
          nationalId,
          ...(legalPrimary === "student" ? { cohort: cohort || ACTIVE_COHORT } : {}),
        };
        await tx.studentProfile.upsert({
          where: { userId: saved.id },
          create: { userId: saved.id, ...profile },
          update: profile,
        });
      }

      if (legalPrimary === "student") {
        const courses = courseIds.length
          ? await tx.course.findMany({ where: { id: { in: courseIds } }, select: { id: true } })
          : [];
        const ids = courses.map((course) => course.id);
        await tx.courseEnrollment.deleteMany({ where: { userId: saved.id, ...(ids.length ? { courseId: { notIn: ids } } : {}) } });
        if (ids.length) {
          await tx.courseEnrollment.createMany({
            data: ids.map((courseId) => ({ courseId, userId: saved.id })),
            skipDuplicates: true,
          });
        }
      }
      return saved.id;
    });
    revalidatePath("/users");
    revalidatePath(`/users/${userId}`);
    revalidatePath("/students");
    revalidatePath("/courses");
    revalidatePath("/stipends");
    return { success: dict.users.saved };
  } catch (error) {
    if (isUniqueConflict(error)) return { error: dict.users.emailTaken };
    return { error: dict.errors.generic };
  }
}

export async function setUserActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const id = field(formData, "id");
  const active = field(formData, "isActive") === "1";
  if (!id) return { error: dict.errors.invalid };
  if (!active && id === session.id) return { error: dict.users.cannotArchiveSelf };
  try {
    await getPrisma().user.update({ where: { id }, data: { isActive: active } });
  } catch {
    return { error: dict.errors.generic };
  }
  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  revalidatePath("/students");
  revalidatePath("/courses");
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
  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(profile.nationalId), loginPassword: profile.nationalId } });
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
