import { PERMISSIONS } from "@/lib/permissions";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/server/actions/people";
import { getLocale, requirePermission } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getPrisma } from "@/lib/prisma";

export default async function RolesPage() {
  await requirePermission("manage_users_and_roles");
  const dict = getDictionary(await getLocale());
  const roles = await getPrisma().role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { _count: { select: { users: true } } } });

  return (
    <div>
      <PageHeader title={dict.roles.title} description={dict.roles.subtitle} />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <ActionForm action={createRoleAction} className="grid h-fit gap-3 rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
          <h2 className="font-semibold">{dict.roles.createTitle}</h2>
          <Input name="name" placeholder={dict.roles.name} required />
          <Input name="slug" placeholder={dict.roles.slug} />
          <Textarea name="description" placeholder={dict.roles.description} />
          <fieldset className="grid gap-2">
            {PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="permissions" value={permission} className="mt-1" />
                {dict.permissions[permission]}
              </label>
            ))}
          </fieldset>
          <SubmitButton label={dict.common.create} pendingLabel={dict.common.saving} />
        </ActionForm>
        <div className="grid gap-3">
          {roles.map((role) => (
            <article key={role.id} className="rounded-2xl border border-slate-200/80 bg-card shadow-sm p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{role.name}</h2>
                  <p className="text-xs text-muted-foreground">{role.slug} · {role._count.users}</p>
                </div>
                <Badge tone={role.isSystem ? "APPROVED" : "NORMAL"}>{role.isSystem ? dict.roles.system : dict.roles.custom}</Badge>
              </div>
              {role.isSystem ? (
                <ul className="grid gap-1 text-sm text-muted-foreground">
                  {role.permissions.map((permission) => (
                    <li key={permission}>{dict.permissions[permission as keyof typeof dict.permissions] ?? permission}</li>
                  ))}
                </ul>
              ) : (
                <ActionForm action={updateRoleAction} className="grid gap-3">
                  <input type="hidden" name="id" value={role.id} />
                  <Input name="name" defaultValue={role.name} required />
                  <Textarea name="description" defaultValue={role.description ?? ""} />
                  <fieldset className="grid gap-2">
                    {PERMISSIONS.map((permission) => (
                      <label key={permission} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" name="permissions" value={permission} defaultChecked={role.permissions.includes(permission)} className="mt-1" />
                        {dict.permissions[permission]}
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex gap-2">
                    <SubmitButton label={dict.common.save} pendingLabel={dict.common.saving} />
                  </div>
                </ActionForm>
              )}
              {!role.isSystem ? (
                <ActionForm action={deleteRoleAction} className="mt-3">
                  <input type="hidden" name="id" value={role.id} />
                  <SubmitButton label={dict.roles.remove} pendingLabel={dict.common.saving} variant="outline" />
                </ActionForm>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
