"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/server/actions/auth";

const DEMOS = [
  { label: "Manager", email: "manager@entilaka.local", password: "Manager123!" },
  { label: "Teacher", email: "teacher@entilaka.local", password: "Teacher123!" },
  { label: "Student", email: "student@entilaka.local", password: "Student123!" },
] as const;

export function LoginForm({
  next,
  emailLabel,
  passwordLabel,
  submitLabel,
  pendingLabel,
  quickLabel,
}: {
  next: string;
  emailLabel: string;
  passwordLabel: string;
  submitLabel: string;
  pendingLabel: string;
  quickLabel: string;
}) {
  const [state, action] = useActionState(loginAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  function quickLogin(email: string, password: string) {
    const form = formRef.current;
    if (!form) return;
    const emailInput = form.elements.namedItem("email");
    const passwordInput = form.elements.namedItem("password");
    if (emailInput instanceof HTMLInputElement) emailInput.value = email;
    if (passwordInput instanceof HTMLInputElement) passwordInput.value = password;
    form.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {state?.error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">{state.error}</p> : null}
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-1.5 text-sm font-medium">
        {emailLabel}
        <Input name="email" type="email" autoComplete="username" required dir="ltr" className="h-12 text-base tabular-nums" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {passwordLabel}
        <Input name="password" type="password" autoComplete="current-password" required minLength={8} className="h-12 text-base" />
      </label>
      <SignInButton label={submitLabel} pendingLabel={pendingLabel} />
      <div className="grid gap-2">
        <p className="text-xs font-medium text-slate-500">{quickLabel}</p>
        <div className="flex flex-wrap gap-2">
          {DEMOS.map((demo) => (
            <button
              key={demo.label}
              type="button"
              onClick={() => quickLogin(demo.email, demo.password)}
              className="min-h-11 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
            >
              {demo.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

function SignInButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-12 w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
