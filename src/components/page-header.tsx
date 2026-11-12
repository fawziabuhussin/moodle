import type { ReactNode } from "react";
import { RegisterPageTitle } from "@/components/shell/page-title";

/**
 * Page title block. On phones the title lives in the top bar, so only the description shows here;
 * on wider screens the page gets a full heading with the brand underline.
 * `bare` keeps the heading for screen readers only, for pages that open with their own hero.
 */
export function PageHeader({ title, description, action, bare = false }: { title: string; description?: ReactNode; action?: ReactNode; bare?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-7">
      <RegisterPageTitle title={title} />
      <div className="min-w-0">
        <h1 className={bare ? "sr-only" : "sr-only md:not-sr-only md:text-[1.75rem] md:leading-tight md:font-extrabold md:tracking-tight md:text-slate-900"}>{title}</h1>
        {bare ? null : <span aria-hidden className="bg-brand-gradient mt-2 hidden h-1 w-14 rounded-full md:block" />}
        {description ? <p className="max-w-2xl text-sm text-slate-500 md:mt-2.5 md:text-[15px]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
