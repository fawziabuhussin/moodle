import { redirect } from "next/navigation";
import { ManagerBoard } from "@/components/food/manager-board";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { additionNames, foodOrderLine, pollIsOpen, studentFoodName } from "@/lib/food";
import { asNumber, formatDateTime, formatMoney } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { appTimeZone } from "@/lib/time";
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
            menuItem: { select: { name: true } },
            student: { select: { firstName: true, lastName: true, nameAr: true, nameHe: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);
  const active = polls.find((poll) => pollIsOpen(poll.status, poll.closesAt)) ?? null;
  const linesOf = (poll: (typeof polls)[number]) => poll.orders.map((order) => foodOrderLine(
    studentFoodName(order.student),
    order.menuItem.name,
    additionNames(order.additions),
    order.notes,
  ));
  const priceOf = (value: { toString(): string } | null) => {
    const amount = asNumber(value);
    return amount > 0 ? formatMoney(amount, locale) : null;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={dict.food.title} description={dict.food.subtitle} />
      <ManagerBoard
        restaurantId={restaurant.id}
        poll={active ? {
          id: active.id,
          status: active.status,
          closesAt: active.closesAt.toISOString(),
          restaurantName: active.restaurant.name,
          logoIcon: active.restaurant.logoIcon,
          price: priceOf(active.price),
        } : null}
        menus={menus.map((menu) => ({
          id: menu.id,
          name: menu.name,
          text: menu.items.map((item) => {
            const price = asNumber(item.basePrice);
            return price > 0 ? `${item.name} - ${price}` : item.name;
          }).join("\n"),
        }))}
        lines={active ? linesOf(active) : []}
        history={polls.filter((poll) => poll.id !== active?.id).map((poll) => ({
          id: poll.id,
          when: formatDateTime(poll.openedAt, locale, zone),
          menuName: poll.menu?.name ?? poll.restaurant.name,
          price: priceOf(poll.price),
          count: poll.orders.length,
          lines: linesOf(poll),
        }))}
        labels={{
          openPoll: dict.food.openPoll,
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
