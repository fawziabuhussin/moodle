import type { ReactNode } from "react";
import { RegisterPageTitle } from "@/components/shell/page-title";

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <RegisterPageTitle title={title} />
      <div className="min-w-0">
        <h1 className="sr-only">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground md:mt-1">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
