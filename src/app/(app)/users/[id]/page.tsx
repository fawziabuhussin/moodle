import Link from "next/link";
import { notFound } from "next/navigation";
import { Ltr } from "@/components/ltr";
import { ActiveField } from "@/components/active-field";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { DeleteUserButton } from "@/components/users/delete-user-button";
import { ProfileFields, type ProfileDefaults } from "@/components/users/profile-fields";
import { updateUserAction } from "@/server/actions/people";
import { getLocale, requirePermission } from "@/lib/auth";
import { asNumber } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";

function profileDefaults(user: { studentProfile: {
  nameAr: string | null;
  nameHe: string | null;
  nationalId: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  academicTrack: string | null;
  bio: string | null;
  defaultStipendAmount: { toString(): string };
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  hasBankConfirmation: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  cohort: string | null;
  psychometryTrack: string | null;
  volunteeringPlace: string | null;
  stipendApproval: string | null;
} | null }): ProfileDefaults | undefined {
  const profile = user.studentProfile;
  if (!profile) return undefined;
  return {
    nameAr: profile.nameAr,
    nameHe: profile.nameHe,
    nationalId: profile.nationalId,
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "",
    gender: profile.gender,
    address: profile.address,
    city: profile.city,
    academicTrack: profile.academicTrack,
    bio: profile.bio,
    defaultStipendAmount: asNumber(profile.defaultStipendAmount),
    bankName: profile.bankName,
    bankBranch: profile.bankBranch,
    bankAccountNumber: profile.bankAccountNumber,
    hasBankConfirmation: profile.hasBankConfirmation,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    notes: profile.notes,
    cohort: profile.cohort,
    psychometryTrack: profile.psychometryTrack,
    volunteeringPlace: profile.volunteeringPlace,
    stipendApproval: profile.stipendApproval,
  };
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const { id } = await params;
  const db = getPrisma();
  const [user, roles] = await Promise.all([
    db.user.findUnique({ where: { id }, include: { roles: true, studentProfile: true } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();
  const selected = new Set(user.roles.map((entry) => entry.roleId));
  const profile = profileDefaults(user);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={fullName(user)} description={<Ltr>{user.email}</Ltr>} action={<Link href="/users" className="text-sm font-medium text-sky-800 hover:underline">{dict.common.back}</Link>} />
      <ActionForm action={updateUserAction} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm">
        <input type="hidden" name="id" value={user.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <Input name="firstName" defaultValue={user.firstName} placeholder={dict.users.firstName} required />
          <Input name="lastName" defaultValue={user.lastName} placeholder={dict.users.lastName} required />
          <Input name="email" type="email" defaultValue={user.email} placeholder={dict.common.email} required dir="ltr" />
          <Input name="phone" defaultValue={user.phone ?? ""} placeholder={dict.common.phone} />
          <label className="grid gap-1 text-sm">
            {dict.users.password}
            <Input name="password" defaultValue={user.loginPassword ?? ""} placeholder={dict.users.passwordHint} minLength={8} dir="ltr" autoComplete="off" />
          </label>
          <label className="grid gap-1 text-sm">
            {dict.common.language}
            <select name="locale" defaultValue={user.locale} className="h-10 rounded-xl border border-input bg-card px-3 text-sm">
              <option value="he">עברית</option>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          <Input name="hardwareBadgeId" defaultValue={user.hardwareBadgeId ?? ""} placeholder={dict.users.badge} />
          <Input name="terminalPin" defaultValue={user.terminalPin ?? ""} placeholder={dict.users.pin} />
        </div>
        <ActiveField label={dict.common.active} defaultChecked={user.isActive} />
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{dict.users.roles}</legend>
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roleIds" value={role.id} defaultChecked={selected.has(role.id)} />
              {role.name}
            </label>
          ))}
        </fieldset>
        <ProfileFields dict={dict} profile={profile} />
        <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
      </ActionForm>
      <div className="mt-3 flex justify-end">
        <DeleteUserButton id={user.id} label={dict.users.deleteAccount} pendingLabel={dict.common.saving} confirmLabel={dict.users.deleteConfirm} />
      </div>
    </div>
  );
}
