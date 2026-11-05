"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { closeFoodPollAction, extendFoodPollAction, openFoodPollAction, saveFoodMenuAction } from "@/server/actions/food";

type SavedMenu = { id: string; name: string; text: string };
type HistoryEntry = { id: string; when: string; menuName: string; price: string | null; count: number; clipboard: string };

export type FoodLabels = {
  openPoll: string;
  minutes: string;
  extend: string;
  close: string;
  copy: string;
  copied: string;
  noOrders: string;
  noPoll: string;
  remaining: string;
  orders: string;
  restaurant: string;
  menu: string;
  menuName: string;
  menuItems: string;
  saveMenu: string;
  newMenu: string;
  price: string;
  priceHint: string;
  history: string;
  noHistory: string;
  ordersCount: string;
};

export function ManagerBoard({
  poll,
  restaurantId,
  menus,
  history,
  clipboard,
  labels,
}: {
  poll: { id: string; status: "OPEN" | "CLOSED"; closesAt: string; restaurantName: string; logoIcon: string; price: string | null } | null;
  restaurantId: string;
  menus: SavedMenu[];
  history: HistoryEntry[];
  clipboard: string;
  labels: FoodLabels;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    const refresh = window.setInterval(() => router.refresh(), 4000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [router]);

  const remaining = useMemo(() => {
    if (!poll || poll.status !== "OPEN") return 0;
    return Math.max(0, new Date(poll.closesAt).getTime() - now);
  }, [now, poll]);
  const open = remaining > 0;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const text = clipboard;

  function run(action: () => Promise<{ error?: string; success?: string } | null | undefined>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result?.error ?? result?.success ?? null);
      router.refresh();
    });
  }

  async function copyOrders() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
        {poll && open ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-orange-900/80">{poll.logoIcon} {poll.restaurantName}{poll.price ? ` · ${poll.price}` : ""}</p>
              <p className="text-xs font-medium text-orange-800">{labels.remaining}</p>
              <motion.p
                key={clock}
                initial={{ scale: 0.96, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-mono text-5xl font-semibold tabular-nums text-orange-950"
                dir="ltr"
              >
                {open ? clock : "00:00"}
              </motion.p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => extendFoodPollAction(null, form({ pollId: poll.id })))}>
                {labels.extend}
              </Button>
              <Button type="button" variant="destructive" disabled={pending || !open} onClick={() => run(() => closeFoodPollAction(null, form({ pollId: poll.id })))}>
                {labels.close}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run(() => openFoodPollAction(null, data));
            }}
          >
            <input type="hidden" name="restaurantId" value={restaurantId} />
            <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium text-orange-950">
              {labels.menu}
              <Select name="menuId" defaultValue={menus[0]?.id ?? ""}>
                {menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>{menu.name}</option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-orange-950">
              {labels.minutes}
              <Input name="minutes" type="number" min={1} max={180} defaultValue={15} dir="ltr" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-orange-950">
              {labels.price}
              <Input name="price" type="number" min={0} step="0.01" placeholder={labels.priceHint} dir="ltr" />
            </label>
            </div>
            <Button type="submit" disabled={pending || menus.length === 0} className="bg-orange-600 hover:bg-orange-700">
              {labels.openPoll}
            </Button>
          </form>
        )}
        {message ? <p className="mt-3 text-sm text-orange-950">{message}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{labels.orders}</h2>
          <Button type="button" onClick={copyOrders} disabled={text.trim().length === 0} className="h-14 bg-emerald-600 px-5 text-base hover:bg-emerald-700">
            {copied ? labels.copied : labels.copy}
          </Button>
        </div>
        {text.trim().length === 0 ? <p className="text-sm text-slate-500">{poll ? labels.noOrders : labels.noPoll}</p> : null}
        <pre className={cn("whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-900", text.trim().length === 0 && "hidden")} dir="rtl">
          {text}
        </pre>
      </section>

      <History entries={history} labels={labels} />
      <MenuEditor key={menus.map((menu) => menu.id).join()} restaurantId={restaurantId} menus={menus} pending={pending} labels={labels} onSave={(data) => run(() => saveFoodMenuAction(null, data))} />
    </div>
  );
}

function MenuEditor({
  restaurantId,
  menus,
  pending,
  labels,
  onSave,
}: {
  restaurantId: string;
  menus: SavedMenu[];
  pending: boolean;
  labels: FoodLabels;
  onSave: (data: FormData) => void;
}) {
  const [selected, setSelected] = useState(menus[0]?.id ?? "");
  const menu = menus.find((item) => item.id === selected);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{labels.menu}</h2>
      <p className="mt-1 text-sm text-slate-500">{labels.menuItems}</p>
      <form
        key={selected || "new"}
        className="mt-3 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="menuId" value={selected} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            {labels.menu}
            <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {menus.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              <option value="">{labels.newMenu}</option>
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {labels.menuName}
            <Input name="name" defaultValue={menu?.name ?? ""} required />
          </label>
        </div>
        <textarea
          name="items"
          required
          rows={14}
          defaultValue={menu?.text ?? ""}
          dir="rtl"
          className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-base leading-7 text-slate-900 outline-none focus:border-orange-400"
        />
        <Button type="submit" disabled={pending} className="bg-orange-600 hover:bg-orange-700">{labels.saveMenu}</Button>
      </form>
    </section>
  );
}

function History({ entries, labels }: { entries: HistoryEntry[]; labels: FoodLabels }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{labels.history}</h2>
      {entries.length === 0 ? <p className="mt-2 text-sm text-slate-500">{labels.noHistory}</p> : null}
      <div className="mt-3 grid gap-2">
        {entries.map((entry) => (
          <details key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium text-slate-900">
              <span className="block">{entry.when}</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                {entry.menuName} · {entry.count} {labels.ordersCount}{entry.price ? ` · ${entry.price}` : ""}
              </span>
            </summary>
            <div className="grid gap-2 px-3 pb-3">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-800" dir="rtl">{entry.clipboard || labels.noOrders}</pre>
              <Button type="button" variant="outline" disabled={entry.clipboard.trim().length === 0} onClick={() => copy(entry.id, entry.clipboard)}>
                {copied === entry.id ? labels.copied : labels.copy}
              </Button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
