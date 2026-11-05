"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { closeFoodPollAction, extendFoodPollAction, openFoodPollAction } from "@/server/actions/food";

type RestaurantChoice = { id: string; name: string; logoIcon: string };

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
};

export function ManagerBoard({
  poll,
  restaurants,
  lines,
  labels,
}: {
  poll: { id: string; status: "OPEN" | "CLOSED"; closesAt: string; restaurantName: string; logoIcon: string } | null;
  restaurants: RestaurantChoice[];
  lines: string[];
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
  const text = lines.join("\n");

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
              <p className="text-sm text-orange-900/80">{poll.logoIcon} {poll.restaurantName}</p>
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
            className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run(() => openFoodPollAction(null, data));
            }}
          >
            <label className="grid gap-1 text-sm font-medium text-orange-950">
              {labels.restaurant}
              <Select name="restaurantId" defaultValue={restaurants[0]?.id ?? ""}>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.logoIcon} {restaurant.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-orange-950">
              {labels.minutes}
              <Input name="minutes" type="number" min={1} max={180} defaultValue={15} dir="ltr" />
            </label>
            <Button type="submit" disabled={pending || restaurants.length === 0} className="bg-orange-600 hover:bg-orange-700">
              {labels.openPoll}
            </Button>
          </form>
        )}
        {message ? <p className="mt-3 text-sm text-orange-950">{message}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{labels.orders}</h2>
          <Button type="button" onClick={copyOrders} disabled={lines.length === 0} className="h-14 bg-emerald-600 px-5 text-base hover:bg-emerald-700">
            {copied ? labels.copied : labels.copy}
          </Button>
        </div>
        {lines.length === 0 ? <p className="text-sm text-slate-500">{poll ? labels.noOrders : labels.noPoll}</p> : null}
        <pre className={cn("whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-900", lines.length === 0 && "hidden")} dir="rtl">
          {text}
        </pre>
      </section>
    </div>
  );
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
