import * as React from "react";
import { cn } from "@/lib/utils";

const ltrTypes = new Set(["time", "datetime-local", "date", "month", "number", "tel"]);
const ltrNames = new Set([
  "phone",
  "hardwareBadgeId",
  "terminalPin",
  "nationalId",
  "emergencyContactPhone",
  "bankAccountNumber",
  "bankBranch",
  "code",
  "baseAmount",
  "deductionAmount",
  "bonusAmount",
  "defaultStipendAmount",
]);

export function Input({ className, type, name, dir, ...props }: React.ComponentProps<"input">) {
  const numeric = dir == null && (ltrTypes.has(type ?? "") || ltrNames.has(String(name ?? "")));
  return (
    <input
      type={type}
      name={name}
      dir={numeric ? "ltr" : dir}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        numeric && "tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
