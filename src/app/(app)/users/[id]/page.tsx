import { notFound } from "next/navigation";
import { Ltr } from "@/components/ltr";
import { ActiveField } from "@/components/active-field";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { updateUserAction } from "@/server/actions/people";
import { getLocale, requirePermission } from "@/lib/auth";
import { asNumber } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";

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

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={fullName(user)} description={<Ltr>{user.email}</Ltr>} />
      <ActionForm action={updateUserAction} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
        <input type="hidden" name="id" value={user.id} />
        <Input name="firstName" defaultValue={user.firstName} required />
        <Input name="lastName" defaultValue={user.lastName} required />
        <Input name="email" type="email" defaultValue={user.email} required />
        <Input name="phone" defaultValue={user.phone ?? ""} placeholder={dict.common.phone} />
        <Input name="password" type="password" placeholder={dict.users.passwordHint} minLength={8} />
        <Input name="hardwareBadgeId" defaultValue={user.hardwareBadgeId ?? ""} placeholder={dict.users.badge} />
        <Input name="terminalPin" defaultValue={user.terminalPin ?? ""} placeholder={dict.users.pin} />
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
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{dict.users.studentSection}</legend>
          <Input name="academicTrack" defaultValue={user.studentProfile?.academicTrack ?? ""} placeholder={dict.students.track} />
          <Input name="nationalId" defaultValue={user.studentProfile?.nationalId ?? ""} placeholder={dict.students.nationalId} />
          <Input name="city" defaultValue={user.studentProfile?.city ?? ""} placeholder={dict.students.city} />
          <Input name="defaultStipendAmount" type="number" min={0} step="0.01" defaultValue={asNumber(user.studentProfile?.defaultStipendAmount)} />
        </fieldset>
        <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
      </ActionForm>
    </div>
  );
}
