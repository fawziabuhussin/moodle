"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { BookOpenText, Check, ChevronDown, ClipboardList, Copy, History, Pencil, Play, Plus, RotateCcw, Square, TimerReset, UtensilsCrossed, X } from "lucide-react";
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

  const orderLines = text.split("\n").filter((line) => line.trim()).length;

  return (
    <div className="grid gap-5">
      <MenusPanel restaurantId={restaurantId} menus={menus} pending={pending} labels={labels} onSave={(data) => run(() => saveFoodMenuAction(null, data))} />

      <section className="bg-ink relative isolate overflow-hidden rounded-[2rem] text-white shadow-[0_24px_60px_-24px_rgb(11_16_32/0.65)]">
        <div aria-hidden className="bg-dots absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div aria-hidden className={cn("absolute -top-24 -start-16 -z-10 size-80 rounded-full blur-3xl", open ? "bg-orange-500/35" : "bg-sky-500/20")} />
        <UtensilsCrossed aria-hidden strokeWidth={1.1} className="absolute -end-8 -bottom-10 -z-10 size-56 text-white/[0.05]" />
        <div className="p-5 md:p-7">
          {poll && open ? (
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300 ring-1 ring-orange-400/30">
                  <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-orange-400" /></span>
                  {labels.remaining}
                </p>
                <motion.p
                  key={clock}
                  initial={{ scale: 0.97, opacity: 0.75 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-3 font-mono text-6xl font-bold tracking-tight tabular-nums md:text-7xl"
                  dir="ltr"
                >
                  {clock}
                </motion.p>
                <p className="mt-2 text-sm text-slate-300">{poll.logoIcon} {poll.restaurantName}{poll.price ? <> · <bdi dir="ltr">{poll.price}</bdi></> : null}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button type="button" variant="ghost" disabled={pending} className={GLASS} onClick={() => run(() => extendFoodPollAction(null, form({ pollId: poll.id })))}>
                  <TimerReset className="size-4" />{labels.extend}
                </Button>
                <Button type="button" variant="destructive" disabled={pending} className="h-11 rounded-2xl px-4" onClick={() => run(() => closeFoodPollAction(null, form({ pollId: poll.id })))}>
                  <Square className="size-3.5 fill-current" />{labels.close}
                </Button>
                <Button type="button" variant="ghost" disabled={pending || menus.length === 0} className={GLASS} onClick={() => setConfirmNew(true)}>
                  <RotateCcw className="size-4" />{labels.newPoll}
                </Button>
              </div>
            </div>
          ) : poll ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/15">{poll.logoIcon}</span>
                <div>
                  <p className="text-lg font-bold">{poll.restaurantName}</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-300">{labels.closedHint}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" disabled={pending} className={GLASS} onClick={() => run(() => extendFoodPollAction(null, form({ pollId: poll.id })))}>
                  <TimerReset className="size-4" />{labels.extend}
                </Button>
                <Button type="button" disabled={pending || menus.length === 0} className={ORANGE} onClick={() => setConfirmNew(true)}>
                  <Play className="size-4 fill-current rtl:-scale-x-100" />{labels.newPoll}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="flex items-center gap-2 text-lg font-bold"><Play className="size-5 fill-orange-400 text-orange-400 rtl:-scale-x-100" />{labels.openPoll}</p>
              <PollFields dark menus={menus} restaurantId={restaurantId} labels={labels} pending={pending} onOpen={(data) => run(() => openFoodPollAction(null, data))} />
            </div>
          )}
          {message ? <p className="mt-4 rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10">{message}</p> : null}
        </div>
      </section>

      <Dialog.Root open={confirmNew} onOpenChange={setConfirmNew}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl outline-none md:p-6">
            <Dialog.Title className="flex items-center gap-2.5 text-lg font-bold text-slate-950">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white"><RotateCcw className="size-4" /></span>
              {labels.newPollTitle}
            </Dialog.Title>
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
              <Button type="button" variant="ghost" onClick={() => setConfirmNew(false)}>{labels.cancel}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 md:p-5">
            <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
              <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sm"><ClipboardList className="size-4" /></span>
              {labels.orders}
              {orderLines ? <bdi dir="ltr" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{orderLines}</bdi> : null}
            </h2>
            <Button
              type="button"
              variant="ghost"
              onClick={copyOrders}
              disabled={text.trim().length === 0}
              className={cn("h-12 rounded-2xl px-5 text-base text-white hover:text-white", copied ? "bg-lime-500 hover:bg-lime-500" : "bg-emerald-600 shadow-[0_8px_20px_-8px_rgb(5_150_105/0.7)] hover:bg-emerald-500")}
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
              {copied ? labels.copied : labels.copy}
            </Button>
          </div>
          <div className="p-4 md:p-5">
            {text.trim().length === 0 ? (
              <div className="bg-dots-dark grid place-items-center gap-3 rounded-2xl px-4 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><UtensilsCrossed className="size-5" /></span>
                <p className="text-sm text-slate-500">{poll ? labels.noOrders : labels.noPoll}</p>
              </div>
            ) : (
              <ClipboardPreview text={text} className="max-h-[36rem] overflow-y-auto rounded-2xl bg-slate-50 p-4 text-slate-900 ring-1 ring-slate-200/70" />
            )}
          </div>
        </section>
        <HistoryPanel entries={history} labels={labels} />
      </div>
    </div>
  );
}

const GLASS = "h-11 rounded-2xl bg-white/10 px-4 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/20";
const ORANGE = "h-11 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 px-5 text-white shadow-[0_8px_20px_-8px_rgb(247_137_29/0.8)] hover:from-orange-300";

function MenusPanel({
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
  const [editing, setEditing] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const menu = menus.find((item) => item.id === editing);

  function edit(id: string) {
    setSession((value) => value + 1);
    setEditing(id);
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm"><BookOpenText className="size-4" /></span>
          {labels.menu}
          <bdi dir="ltr" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{menus.length}</bdi>
        </h2>
        <Button type="button" onClick={() => edit("")} className={cn(ORANGE, "h-10 px-4")}>
          <Plus className="size-4" />{labels.newMenu}
        </Button>
      </div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {menus.map((item) => {
          const dishes = parseDishes(item.text);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => edit(item.id)}
              className="group relative w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md sm:w-auto"
            >
              <span aria-hidden className="absolute -end-8 -top-8 size-24 rounded-full bg-orange-100/70 blur-xl transition-transform duration-500 group-hover:scale-125" />
              <span className="relative flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-slate-900">{item.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500"><bdi dir="ltr">{dishes.length}</bdi> {labels.dishes} · <bdi dir="ltr">{parseLines(item.additions).length}</bdi> {labels.additions}</span>
                </span>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200 transition-colors group-hover:bg-orange-50 group-hover:text-orange-600"><Pencil className="size-3.5" /></span>
              </span>
              <span className="relative mt-3 flex flex-wrap gap-1.5">
                {dishes.slice(0, 4).map((dish, index) => (
                  <span key={`${dish.name}-${index}`} className="max-w-full truncate rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-900 ring-1 ring-orange-100">{dish.name}</span>
                ))}
                {dishes.length > 4 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">+<bdi dir="ltr">{dishes.length - 4}</bdi></span> : null}
              </span>
            </button>
          );
        })}
        {menus.length === 0 ? (
          <button type="button" onClick={() => edit("")} className="grid w-full place-items-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 px-4 py-8 text-sm font-semibold text-slate-500 transition-colors hover:border-orange-300 hover:text-orange-700 sm:col-span-2 lg:col-span-3">
            <Plus className="size-6" />{labels.newMenu}
          </button>
        ) : null}
      </div>

      <Dialog.Root open={editing != null} onOpenChange={(next) => { if (!next) setEditing(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="entilaka-overlay fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[36rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem] md:p-6">
            <div className="mb-1 flex items-center justify-between gap-3">
              <Dialog.Title className="flex items-center gap-2.5 text-lg font-bold text-slate-950">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white">{menu ? <Pencil className="size-4" /> : <Plus className="size-4" />}</span>
                {menu ? menu.name : labels.newMenu}
              </Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label={labels.cancel}><X className="size-4" /></Dialog.Close>
            </div>
            <Dialog.Description className="text-sm text-slate-500">{labels.menuItems}</Dialog.Description>
            {editing != null ? (
              <MenuForm
                key={`${editing || "new"}-${session}`}
                restaurantId={restaurantId}
                menuId={editing}
                menu={menu}
                pending={pending}
                labels={labels}
                onSave={(data) => {
                  onSave(data);
                  setEditing(null);
                }}
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function PollFields({
  menus,
  restaurantId,
  labels,
  pending,
  submitLabel,
  onOpen,
  dark = false,
}: {
  menus: SavedMenu[];
  restaurantId: string;
  labels: FoodLabels;
  pending: boolean;
  submitLabel?: string;
  onOpen: (data: FormData) => void;
  dark?: boolean;
}) {
  const field = cn("grid gap-1.5 text-xs font-semibold", dark ? "text-slate-300" : "text-slate-600");
  const control = dark ? "h-11 border-white/15 bg-white/10 text-white placeholder:text-slate-400 [&>option]:text-slate-900" : "h-11";
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
        <label className={field}>
          {labels.menu}
          <Select name="menuId" defaultValue={menus[0]?.id ?? ""} className={control}>
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>{menu.name}</option>
            ))}
          </Select>
        </label>
        <label className={field}>
          {labels.minutes}
          <Input name="minutes" type="number" min={1} max={180} defaultValue={15} dir="ltr" className={control} />
        </label>
        <label className={field}>
          {labels.price}
          <Input name="price" type="number" min={0} step="0.01" placeholder={labels.priceHint} dir="ltr" className={control} />
        </label>
      </div>
      <Button type="submit" disabled={pending || menus.length === 0} className={cn(ORANGE, "h-12 w-full sm:w-auto sm:justify-self-start")}>
        <Play className="size-4 fill-current rtl:-scale-x-100" />{submitLabel ?? labels.openPoll}
      </Button>
    </form>
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
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {labels.menuName}
        <Input value={name} onChange={(event) => setName(event.target.value)} required className="h-11 text-base font-semibold" />
      </label>

      <div className="overflow-hidden rounded-3xl border border-orange-100 bg-orange-50/60">
        <div className="flex items-center justify-between px-4 py-2.5">
          <h3 className="text-sm font-bold text-orange-950">{labels.dishes}</h3>
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
          <button type="button" aria-label={labels.addDish} onClick={addDish} className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-sm hover:from-orange-300">
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold">{labels.additions}</h3>
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
          <button type="button" aria-label={labels.addAddition} onClick={addAddition} className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-sm hover:from-orange-300">
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <Button type="submit" disabled={pending || dishes.length === 0 || name.trim().length === 0} className={cn(ORANGE, "h-12 w-full")}><Check className="size-4" />{labels.saveMenu}</Button>
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

function HistoryPanel({ entries, labels }: { entries: HistoryEntry[]; labels: FoodLabels }) {
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
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
      <h2 className="flex items-center gap-2.5 text-base font-bold text-slate-900">
        <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-sm"><History className="size-4" /></span>
        {labels.history}
      </h2>
      {entries.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{labels.noHistory}</p> : null}
      <ol className="relative mt-4 grid gap-2 before:absolute before:inset-y-3 before:start-[1.1rem] before:w-px before:bg-slate-200">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            <details className="group rounded-2xl border border-transparent transition-colors open:border-slate-200 open:bg-slate-50/70">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-2 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                <span className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200"><UtensilsCrossed className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{entry.menuName}</span>
                  <span className="block text-xs text-slate-500"><bdi dir="ltr">{entry.when}</bdi>{entry.price ? <> · <bdi dir="ltr">{entry.price}</bdi></> : null}</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"><bdi dir="ltr">{entry.count}</bdi> {labels.ordersCount}</span>
                <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-2 px-3 pb-3">
                {entry.clipboard ? <ClipboardPreview text={entry.clipboard} className="max-h-72 overflow-y-auto rounded-xl bg-white p-3 text-slate-800 ring-1 ring-slate-200/70" /> : <p className="text-sm text-slate-500">{labels.noOrders}</p>}
                <Button type="button" variant="outline" size="sm" disabled={entry.clipboard.trim().length === 0} onClick={() => copy(entry.id, entry.clipboard)} className="h-9">
                  {copied === entry.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === entry.id ? labels.copied : labels.copy}
                </Button>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ClipboardPreview({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <pre className={cn("font-sans text-sm leading-7 whitespace-pre-wrap", className)} dir="rtl">
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
