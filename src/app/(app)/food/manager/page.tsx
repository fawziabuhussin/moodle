import { redirect } from "next/navigation";
import { ManagerBoard } from "@/components/food/manager-board";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { activeStudentWhere } from "@/lib/cohort";
import { additionNames, foodClipboard, pollIsOpen, studentFoodName } from "@/lib/food";
import { asNumber, formatDateTime, formatMoney } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone, calendarDateFromISO, formatCalendarDate } from "@/lib/time";
import { ensureFoodMenu } from "@/server/food-menu";

export default async function FoodManagerPage() {
  const session = await requireUser();
  if (!session.roleSlugs.includes("manager") && !hasPermission(session.permissions, "manage_food_polls")) {
    redirect("/dashboard?notice=forbidden");
  }
  const restaurant = await ensureFoodMenu();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const db = getPrisma();
  const zone = appTimeZone();
  const [menus, polls] = await Promise.all([
    db.foodMenu.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "asc" },
      include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } },
    }),
    db.foodPoll.findMany({
      orderBy: { openedAt: "desc" },
      take: 20,
      include: {
        menu: { select: { name: true } },
        restaurant: { select: { name: true, logoIcon: true } },
        orders: {
          include: {
            menuItem: { select: { name: true, sortOrder: true } },
            student: { select: { id: true, firstName: true, lastName: true, nameAr: true, nameHe: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);
  const latest = polls[0] ?? null;
  const active = latest && pollIsOpen(latest.status, latest.closesAt) ? latest : null;
  const pollDate = (poll: (typeof polls)[number]) => formatCalendarDate(poll.openedAt, zone);
  const dates = [...new Set(polls.map(pollDate))];
  const attended = dates.length === 0 ? [] : await db.attendanceRecord.findMany({
    where: {
      date: { in: dates.map(calendarDateFromISO) },
      status: { in: ["ATTENDED", "LATE"] },
      user: activeStudentWhere(),
    },
    select: {
      date: true,
      user: { select: { id: true, firstName: true, lastName: true, nameAr: true, nameHe: true } },
    },
  });
  const attendedByDate = new Map<string, Map<string, string>>();
  for (const record of attended) {
    const key = formatCalendarDate(record.date, "UTC");
    const people = attendedByDate.get(key) ?? new Map<string, string>();
    people.set(record.user.id, studentFoodName(record.user));
    attendedByDate.set(key, people);
  }
  const clipboardOf = (poll: (typeof polls)[number]) => {
    const present = attendedByDate.get(pollDate(poll)) ?? new Map<string, string>();
    const ordered = new Set(poll.orders.map((order) => order.student.id));
    return foodClipboard(
      poll.orders.map((order) => ({
        name: studentFoodName(order.student),
        item: order.menuItem.name,
        additions: additionNames(order.additions),
        notes: order.notes,
        sortOrder: order.menuItem.sortOrder,
      })),
      poll.orders.length === 0 ? [] : [...present.entries()].filter(([id]) => !ordered.has(id)).map(([, name]) => name),
    );
  };
  const priceOf = (value: { toString(): string } | null) => {
    const amount = asNumber(value);
    return amount > 0 ? formatMoney(amount, locale) : null;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={dict.food.title} description={dict.food.subtitle} />
      <ManagerBoard
        restaurantId={restaurant.id}
        poll={latest ? {
          id: latest.id,
          status: active ? "OPEN" : "CLOSED",
          closesAt: latest.closesAt.toISOString(),
          restaurantName: latest.restaurant.name,
          logoIcon: latest.restaurant.logoIcon,
          price: priceOf(latest.price),
        } : null}
        menus={menus.map((menu) => ({
          id: menu.id,
          name: menu.name,
          text: menu.items.map((item) => {
            const price = asNumber(item.basePrice);
            return price > 0 ? `${item.name} - ${price}` : item.name;
          }).join("\n"),
        }))}
        clipboard={latest ? clipboardOf(latest) : ""}
        history={polls.filter((poll) => poll.id !== latest?.id).map((poll) => ({
          id: poll.id,
          when: formatDateTime(poll.openedAt, locale, zone),
          menuName: poll.menu?.name ?? poll.restaurant.name,
          price: priceOf(poll.price),
          count: poll.orders.length,
          clipboard: clipboardOf(poll),
        }))}
        labels={{
          openPoll: dict.food.openPoll,
          newPoll: dict.food.newPoll,
          newPollTitle: dict.food.newPollTitle,
          newPollConfirm: dict.food.newPollConfirm,
          newPollStart: dict.food.newPollStart,
          closedHint: dict.food.closedHint,
          cancel: dict.common.cancel,
          minutes: dict.food.minutes,
          extend: dict.food.extend,
          close: dict.food.close,
          copy: dict.food.copy,
          copied: dict.food.copied,
          noOrders: dict.food.noOrders,
          noPoll: dict.food.noPoll,
          remaining: dict.food.remaining,
          orders: dict.food.orders,
          restaurant: dict.food.restaurant,
          menu: dict.food.menu,
          menuName: dict.food.menuName,
          menuItems: dict.food.menuItems,
          saveMenu: dict.food.saveMenu,
          newMenu: dict.food.newMenu,
          price: dict.food.price,
          priceHint: dict.food.priceHint,
          history: dict.food.history,
          noHistory: dict.food.noHistory,
          ordersCount: dict.food.ordersCount,
        }}
      />
    </div>
  );
}
