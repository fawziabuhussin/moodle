"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({
  next,
  emailLabel,
  passwordLabel,
  submitLabel,
  pendingLabel,
}: {
  next: string;
  emailLabel: string;
  passwordLabel: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, action] = useActionState(loginAction, null);

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-900 ring-1 ring-rose-100">{state.error}</p> : null}
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {emailLabel}
        <Input name="email" type="text" autoComplete="username" required dir="ltr" className="h-12 text-base tabular-nums" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {passwordLabel}
        <Input name="password" type="password" autoComplete="current-password" required minLength={8} className="h-12 text-base" />
      </label>
      <SignInButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

function SignInButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 h-12 w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
