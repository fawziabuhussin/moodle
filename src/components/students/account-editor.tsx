"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetStudentPasswordAction, saveStudentAccountAction } from "@/server/actions/people";

export type AccountDraft = {
  id: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  bankConfirmed: boolean;
};

export function AccountEditor({
  account,
  editLabel,
  resetLabel,
  saveLabel,
  savingLabel,
  closeLabel,
  emailLabel,
  phoneLabel,
  bankLabel,
  branchLabel,
  accountLabel,
  confirmationLabel,
}: {
  account: AccountDraft;
  editLabel: string;
  resetLabel: string;
  saveLabel: string;
  savingLabel: string;
  closeLabel: string;
  emailLabel: string;
  phoneLabel: string;
  bankLabel: string;
  branchLabel: string;
  accountLabel: string;
  confirmationLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(formData: FormData) {
    setPending(true);
    const result = await saveStudentAccountAction(null, formData);
    setPending(false);
    setNote(result?.error ?? result?.success ?? null);
    if (!result?.error) {
      setOpen(false);
      router.refresh();
    }
  }

  async function resetPassword() {
    setPending(true);
    const data = new FormData();
    data.set("userId", account.id);
    const result = await resetStudentPasswordAction(null, data);
    setPending(false);
    setNote(result?.error ?? result?.success ?? null);
    if (!result?.error) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-sky-50">{editLabel}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="font-semibold">{editLabel}</Dialog.Title>
              <Dialog.Close className="rounded-lg px-2 py-1 text-sm text-slate-500" aria-label={closeLabel}>×</Dialog.Close>
            </div>
            <form action={save} className="grid gap-2">
              <input type="hidden" name="userId" value={account.id} />
              <input type="hidden" name="hasBankConfirmation" value="no" />
              <label className="grid gap-1 text-sm">{emailLabel}<Input name="email" type="email" defaultValue={account.email} required dir="ltr" /></label>
              <label className="grid gap-1 text-sm">{phoneLabel}<Input name="phone" defaultValue={account.phone ?? ""} dir="ltr" /></label>
              <label className="grid gap-1 text-sm">{bankLabel}<Input name="bankName" defaultValue={account.bankName ?? ""} /></label>
              <label className="grid gap-1 text-sm">{branchLabel}<Input name="bankBranch" defaultValue={account.bankBranch ?? ""} dir="ltr" /></label>
              <label className="grid gap-1 text-sm">{accountLabel}<Input name="bankAccountNumber" defaultValue={account.bankAccount ?? ""} dir="ltr" /></label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hasBankConfirmation" value="yes" defaultChecked={account.bankConfirmed} />
                {confirmationLabel}
              </label>
              <Button type="submit" disabled={pending}>{pending ? savingLabel : saveLabel}</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <button type="button" onClick={resetPassword} disabled={pending} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">{resetLabel}</button>
      {note ? <span className="text-xs text-slate-500">{note}</span> : null}
      {account.nationalId ? <Ltr className="sr-only">{account.nationalId}</Ltr> : null}
    </div>
  );
}
