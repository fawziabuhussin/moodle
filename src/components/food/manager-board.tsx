"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FOOD_ADDITIONS } from "@/lib/food";
import { cn } from "@/lib/utils";
import { closeFoodPollAction, extendFoodPollAction, openFoodPollAction, saveFoodMenuAction } from "@/server/actions/food";

type SavedMenu = { id: string; name: string; text: string; additions: string };
type HistoryEntry = { id: string; when: string; menuName: string; price: string | null; count: number; clipboard: string };

export type FoodLabels = {
  openPoll: string;
  newPoll: string;
  newPollTitle: string;
  newPollConfirm: string;
  newPollStart: string;
  closedHint: string;
  cancel: string;
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
  dishes: string;
  dishName: string;
  addDish: string;
  additions: string;
  additionsHint: string;
  additionName: string;
  addAddition: string;
  removeItem: string;
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
  const [confirmNew, setConfirmNew] = useState(false);
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
                {clock}
              </motion.p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => extendFoodPollAction(null, form({ pollId: poll.id })))}>
                {labels.extend}
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => closeFoodPollAction(null, form({ pollId: poll.id })))}>
                {labels.close}
              </Button>
              <Button type="button" variant="outline" disabled={pending || menus.length === 0} onClick={() => setConfirmNew(true)}>
                {labels.newPoll}
              </Button>
            </div>
          </div>
        ) : poll ? (
          <div className="grid gap-3">
            <p className="text-sm leading-6 text-orange-950">{labels.closedHint}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => extendFoodPollAction(null, form({ pollId: poll.id })))}>
                {labels.extend}
              </Button>
              <Button type="button" disabled={pending || menus.length === 0} className="bg-orange-600 hover:bg-orange-700" onClick={() => setConfirmNew(true)}>
                {labels.newPoll}
              </Button>
            </div>
          </div>
        ) : (
          <PollFields menus={menus} restaurantId={restaurantId} labels={labels} pending={pending} onOpen={(data) => run(() => openFoodPollAction(null, data))} />
        )}
        {message ? <p className="mt-3 text-sm text-orange-950">{message}</p> : null}
      </section>
      <Dialog.Root open={confirmNew} onOpenChange={setConfirmNew}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-lg font-semibold text-slate-950">{labels.newPollTitle}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">{labels.newPollConfirm}</Dialog.Description>
            <div className="mt-4">
              <PollFields
                menus={menus}
                restaurantId={restaurantId}
                labels={labels}
                pending={pending}
                submitLabel={labels.newPollStart}
                onOpen={(data) => {
                  setConfirmNew(false);
                  run(() => openFoodPollAction(null, data));
                }}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setConfirmNew(false)}>{labels.cancel}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{labels.orders}</h2>
          <Button type="button" onClick={copyOrders} disabled={text.trim().length === 0} className="h-14 bg-emerald-600 px-5 text-base hover:bg-emerald-700">
            {copied ? labels.copied : labels.copy}
          </Button>
        </div>
        {text.trim().length === 0 ? <p className="text-sm text-slate-500">{poll ? labels.noOrders : labels.noPoll}</p> : null}
        <ClipboardPreview text={text} className="rounded-2xl bg-slate-50 p-4 text-slate-900" />
      </section>

      <History entries={history} labels={labels} />
      <MenuEditor key={menus.map((menu) => menu.id).join()} restaurantId={restaurantId} menus={menus} pending={pending} labels={labels} onSave={(data) => run(() => saveFoodMenuAction(null, data))} />
    </div>
  );
}

function PollFields({
  menus,
  restaurantId,
  labels,
  pending,
  submitLabel,
  onOpen,
}: {
  menus: SavedMenu[];
  restaurantId: string;
  labels: FoodLabels;
  pending: boolean;
  submitLabel?: string;
  onOpen: (data: FormData) => void;
}) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onOpen(new FormData(event.currentTarget));
      }}
    >
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-slate-900">
          {labels.menu}
          <Select name="menuId" defaultValue={menus[0]?.id ?? ""}>
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>{menu.name}</option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-900">
          {labels.minutes}
          <Input name="minutes" type="number" min={1} max={180} defaultValue={15} dir="ltr" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-900">
          {labels.price}
          <Input name="price" type="number" min={0} step="0.01" placeholder={labels.priceHint} dir="ltr" />
        </label>
      </div>
      <Button type="submit" disabled={pending || menus.length === 0} className="bg-orange-600 hover:bg-orange-700">
        {submitLabel ?? labels.openPoll}
      </Button>
    </form>
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
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          {labels.menu}
          <Select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {menus.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            <option value="">{labels.newMenu}</option>
          </Select>
        </label>
      </div>
      <MenuForm key={selected || "new"} restaurantId={restaurantId} menuId={selected} menu={menu} pending={pending} labels={labels} onSave={onSave} />
    </section>
  );
}

function MenuForm({
  restaurantId,
  menuId,
  menu,
  pending,
  labels,
  onSave,
}: {
  restaurantId: string;
  menuId: string;
  menu: SavedMenu | undefined;
  pending: boolean;
  labels: FoodLabels;
  onSave: (data: FormData) => void;
}) {
  const [name, setName] = useState(menu?.name ?? "");
  const [dishes, setDishes] = useState(() => parseDishes(menu?.text ?? ""));
  const [additions, setAdditions] = useState(() => parseLines(menu?.additions || FOOD_ADDITIONS.join("\n")));
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [additionName, setAdditionName] = useState("");

  function addDish() {
    const next = dishName.trim();
    if (!next) return;
    setDishes((current) => [...current, { name: next, price: dishPrice.trim() }]);
    setDishName("");
    setDishPrice("");
  }

  function addAddition() {
    const next = additionName.trim();
    if (!next || additions.includes(next)) return;
    setAdditions((current) => [...current, next]);
    setAdditionName("");
  }

  return (
    <form
      className="mt-3 grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        data.set("restaurantId", restaurantId);
        data.set("menuId", menuId);
        data.set("name", name);
        data.set("items", dishes.map((dish) => dish.price ? `${dish.name} - ${dish.price}` : dish.name).join("\n"));
        data.set("additions", additions.join("\n"));
        onSave(data);
      }}
    >
      <label className="grid gap-1 text-sm font-medium">
        {labels.menuName}
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>

      <div className="overflow-hidden rounded-3xl border border-orange-100 bg-orange-50/50">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-sm font-semibold text-orange-950">{labels.dishes}</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-orange-700">{dishes.length}</span>
        </div>
        <ul className="grid">
          {dishes.map((dish, index) => (
            <li key={`${dish.name}-${index}`} className="flex items-center gap-2 border-t border-orange-100 bg-white px-3 py-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-semibold text-orange-800">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{dish.name}</span>
              {dish.price ? <span className="text-xs tabular-nums text-slate-500" dir="ltr">{dish.price}</span> : null}
              <button type="button" aria-label={labels.removeItem} onClick={() => setDishes((current) => current.filter((_, item) => item !== index))} className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-700">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t border-orange-100 bg-white p-2">
          <Input value={dishName} onChange={(event) => setDishName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDish(); } }} placeholder={labels.dishName} aria-label={labels.dishName} />
          <Input value={dishPrice} onChange={(event) => setDishPrice(event.target.value)} type="number" min={0} step="0.01" placeholder={labels.price} aria-label={labels.price} className="w-24 shrink-0" />
          <button type="button" aria-label={labels.addDish} onClick={addDish} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-600 text-white shadow-sm hover:bg-orange-700">
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold">{labels.additions}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{labels.additionsHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {additions.map((addition) => (
            <span key={addition} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-orange-200 bg-orange-50 py-1 ps-3 pe-1 text-sm font-medium text-orange-950">
              {addition}
              <button type="button" aria-label={labels.removeItem} onClick={() => setAdditions((current) => current.filter((item) => item !== addition))} className="grid size-7 place-items-center rounded-full text-orange-700 hover:bg-white">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input value={additionName} onChange={(event) => setAdditionName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAddition(); } }} placeholder={labels.additionName} aria-label={labels.additionName} />
          <button type="button" aria-label={labels.addAddition} onClick={addAddition} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-600 text-white shadow-sm hover:bg-orange-700">
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <Button type="submit" disabled={pending || dishes.length === 0 || name.trim().length === 0} className="h-12 bg-orange-600 hover:bg-orange-700">{labels.saveMenu}</Button>
    </form>
  );
}

function parseLines(value: string) {
  return value.split(/\n/).map((line) => line.trim()).filter(Boolean);
}

function parseDishes(value: string) {
  return parseLines(value).map((line) => {
    const priced = line.match(/^(.*\S)\s*[-–—|]\s*(\d+(?:[.,]\d{1,2})?)\s*$/);
    if (!priced) return { name: line, price: "" };
    return { name: priced[1].trim(), price: priced[2].replace(",", ".") };
  });
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
              {entry.clipboard ? <ClipboardPreview text={entry.clipboard} className="text-slate-800" /> : <p className="text-sm text-slate-500">{labels.noOrders}</p>}
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

function ClipboardPreview({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <pre className={cn("whitespace-pre-wrap text-sm leading-7", className)} dir="rtl">
      {parts.map((part, index) => {
        const bold = part.startsWith("*") && part.endsWith("*") && part.length > 2;
        return bold ? <strong key={index}>{part.slice(1, -1)}</strong> : <span key={index}>{part}</span>;
      })}
    </pre>
  );
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
