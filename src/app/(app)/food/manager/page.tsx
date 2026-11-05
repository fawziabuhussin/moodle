import { redirect } from "next/navigation";
import { ManagerBoard } from "@/components/food/manager-board";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { additionNames, foodOrderLine, studentFoodName } from "@/lib/food";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { ensureFoodMenu } from "@/server/food-menu";

export default async function FoodManagerPage() {
  const session = await requireUser();
  if (!session.roleSlugs.includes("manager") && !hasPermission(session.permissions, "manage_food_polls")) {
    redirect("/dashboard?notice=forbidden");
  }
  const menu = await ensureFoodMenu();
  const dict = getDictionary(await getLocale());
  const db = getPrisma();
  const restaurants = await db.restaurant.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, logoIcon: true },
  });
  const poll = await db.foodPoll.findFirst({
    orderBy: { openedAt: "desc" },
    include: {
      restaurant: { select: { name: true, logoIcon: true } },
      orders: {
        include: {
          menuItem: { select: { name: true } },
          student: { select: { firstName: true, lastName: true, nameAr: true, nameHe: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={dict.food.title} description={dict.food.subtitle} />
      <ManagerBoard
        poll={poll ? {
          id: poll.id,
          status: poll.status,
          closesAt: poll.closesAt.toISOString(),
          restaurantName: poll.restaurant.name,
          logoIcon: poll.restaurant.logoIcon,
        } : null}
        restaurants={restaurants.length > 0 ? restaurants : [{ id: menu.id, name: menu.name, logoIcon: menu.logoIcon }]}
        lines={(poll?.orders ?? []).map((order) => foodOrderLine(
          studentFoodName(order.student),
          order.menuItem.name,
          additionNames(order.additions),
          order.notes,
        ))}
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
        }}
      />
    </div>
  );
}
