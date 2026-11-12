"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/types";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {state?.error ? <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{state.error}</p> : null}
      {state?.success ? <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{state.success}</p> : null}
      {children}
    </form>
  );
}

export function SubmitButton({ label, pendingLabel, variant = "default", size = "default", className }: { label: string; pendingLabel: string; variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "brand"; size?: "default" | "sm" | "lg" | "icon"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
