"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitFoodOrderAction } from "@/server/actions/food";

type Addition = { name: string; emoji: string };
type Item = { id: string; name: string; emoji: string; additions: Addition[] };

export type PickerLabels = {
  remaining: string;
  closed: string;
  notes: string;
  confirm: string;
  saved: string;
  choose: string;
};

export function FoodPicker({
  pollId,
  closesAt,
  status,
  items,
  current,
  labels,
}: {
  pollId: string;
  closesAt: string;
  status: "OPEN" | "CLOSED";
  items: Item[];
  current: { menuItemId: string; additions: string[]; notes: string } | null;
  labels: PickerLabels;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [item, setItem] = useState<Item | null>(null);
  const [chosen, setChosen] = useState<string[]>(current?.additions ?? []);
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (status !== "OPEN") return 0;
    return Math.max(0, new Date(closesAt).getTime() - now);
  }, [closesAt, now, status]);
  const open = remaining > 0;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  function openItem(next: Item) {
    setItem(next);
    if (current?.menuItemId === next.id) {
      setChosen(current.additions);
      setNotes(current.notes);
      return;
    }
    setChosen([]);
    setNotes("");
  }

  function toggle(name: string) {
    setChosen((currentNames) => currentNames.includes(name) ? currentNames.filter((entry) => entry !== name) : [...currentNames, name]);
  }

  function submit() {
    if (!item || !open) return;
    const data = new FormData();
    data.set("pollId", pollId);
    data.set("menuItemId", item.id);
    data.set("notes", notes);
    for (const name of chosen) data.append("additions", name);
    startTransition(async () => {
      const result = await submitFoodOrderAction(null, data);
      if (result?.error) {
        setToast(result.error);
        return;
      }
      setToast(labels.saved);
      setItem(null);
      router.refresh();
      window.setTimeout(() => setToast(null), 2200);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="sticky top-16 z-20 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
        {open ? (
          <p className="flex items-center justify-between gap-3 text-sm font-semibold text-orange-950">
            <span>⏳ {labels.remaining}</span>
            <span className="font-mono text-2xl tabular-nums" dir="ltr">{clock}</span>
          </p>
        ) : (
          <p className="text-center text-base font-semibold text-rose-800">{labels.closed}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((menuItem, index) => (
          <motion.button
            key={menuItem.id}
            type="button"
            disabled={!open}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => openItem(menuItem)}
            className={cn(
              "rounded-3xl border border-orange-200 bg-orange-50 p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-100 disabled:translate-y-0 disabled:opacity-60",
              current?.menuItemId === menuItem.id && "ring-2 ring-orange-500",
            )}
          >
            <span className="text-4xl">{menuItem.emoji}</span>
            <span className="mt-3 block text-base font-semibold text-orange-950">{menuItem.name}</span>
          </motion.button>
        ))}
      </div>

      <Dialog.Root open={Boolean(item)} onOpenChange={(next) => { if (!next) setItem(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-orange-200 bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-orange-200" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <Dialog.Title className="text-lg font-semibold">
                {item?.emoji} {item?.name}
              </Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-xl hover:bg-orange-50" aria-label="Close">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="flex flex-wrap gap-2">
              {item?.additions.map((addition) => {
                const on = chosen.includes(addition.name);
                return (
                  <button
                    key={addition.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(addition.name)}
                    className={cn(
                      "min-h-11 rounded-full border px-3 text-sm font-medium",
                      on ? "border-orange-500 bg-orange-500 text-white" : "border-orange-200 bg-orange-50 text-orange-950",
                    )}
                  >
                    {addition.emoji} {addition.name}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 grid gap-1 text-sm font-medium">
              {labels.notes}
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24" />
            </label>
            <Button type="button" disabled={!open || pending} onClick={submit} className="mt-4 h-12 w-full bg-orange-600 hover:bg-orange-700">
              {labels.confirm}
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-4 bottom-24 z-40 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-lg"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
