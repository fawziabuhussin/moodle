import Link from "next/link";
import { Ltr } from "@/components/ltr";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createUserAction } from "@/server/actions/people";
import { getLocale, requirePermission } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";

export default async function UsersPage() {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const [users, roles] = await Promise.all([
    getPrisma().user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { firstName: "asc" },
    }),
    getPrisma().role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title={dict.users.title} description={dict.users.subtitle} />
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <ActionForm action={createUserAction} className="grid h-fit gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
          <h2 className="font-semibold">{dict.users.createTitle}</h2>
          <Input name="firstName" placeholder={dict.users.firstName} required />
          <Input name="lastName" placeholder={dict.users.lastName} required />
          <Input name="email" type="email" placeholder={dict.common.email} required />
          <Input name="phone" placeholder={dict.common.phone} />
          <Input name="password" type="password" placeholder={dict.users.password} minLength={8} required />
          <Input name="hardwareBadgeId" placeholder={dict.users.badge} />
          <Input name="terminalPin" placeholder={dict.users.pin} />
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{dict.users.roles}</legend>
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="roleIds" value={role.id} />
                {role.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{dict.users.studentSection}</legend>
            <Input name="academicTrack" placeholder={dict.students.track} />
            <Input name="nationalId" placeholder={dict.students.nationalId} />
            <Input name="city" placeholder={dict.students.city} />
            <Input name="defaultStipendAmount" type="number" min={0} step="0.01" placeholder={dict.students.defaultStipend} />
          </fieldset>
          <SubmitButton label={dict.common.create} pendingLabel={dict.common.saving} />
        </ActionForm>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm md:hidden">
          {users.map((user) => (
            <li key={user.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/users/${user.id}`} className="min-w-0 font-medium">{fullName(user)}</Link>
                <Badge tone={user.isActive ? "ATTENDED" : "CANCELLED"}>{user.isActive ? dict.common.active : dict.common.inactive}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground"><Ltr>{user.email}</Ltr></p>
              <p className="mt-1 truncate text-xs text-slate-600">{user.roles.map((entry) => entry.role.name).join(", ") || "—"}</p>
              <p className="text-xs text-muted-foreground"><Ltr>{user.hardwareBadgeId || "—"}</Ltr></p>
            </li>
          ))}
        </ul>
        <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-slate-200/80 bg-card shadow-sm md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-start text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 text-start font-medium">{dict.common.name}</th>
                <th className="px-4 py-3 text-start font-medium">{dict.users.roles}</th>
                <th className="px-4 py-3 text-start font-medium">{dict.users.badge}</th>
                <th className="px-4 py-3 text-start font-medium">{dict.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/users/${user.id}`} className="font-medium hover:underline">
                      {fullName(user)}
                    </Link>
                    <p className="text-xs text-muted-foreground"><Ltr>{user.email}</Ltr></p>
                  </td>
                  <td className="px-4 py-3">{user.roles.map((entry) => entry.role.name).join(", ")}</td>
                  <td className="px-4 py-3"><Ltr>{user.hardwareBadgeId || "—"}</Ltr></td>
                  <td className="px-4 py-3">
                    <Badge tone={user.isActive ? "ATTENDED" : "CANCELLED"}>{user.isActive ? dict.common.active : dict.common.inactive}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
