import { notFound, redirect } from "next/navigation";
import { FoodPicker } from "@/components/food/picker";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { additionNames } from "@/lib/food";
import { asNumber, formatMoney } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export default async function FoodPollPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  if (session.roleSlugs.includes("manager") || hasPermission(session.permissions, "manage_food_polls")) {
    redirect("/food/manager");
  }
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const poll = await getPrisma().foodPoll.findUnique({
    where: { id },
    include: {
      restaurant: {
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { additions: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      orders: { where: { studentId: session.id }, take: 1 },
    },
  });
  if (!poll) notFound();
  const order = poll.orders[0];
  const offerPrice = asNumber(poll.price);
  const items = poll.restaurant.items.filter((item) => item.available && (!poll.menuId || item.menuId === poll.menuId));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`${poll.restaurant.logoIcon} ${poll.restaurant.name}`} description={dict.food.choose} />
      <FoodPicker
        pollId={poll.id}
        closesAt={poll.closesAt.toISOString()}
        status={poll.status}
        offerPrice={offerPrice > 0 ? formatMoney(offerPrice, locale) : null}
        items={items.map((item) => {
          const price = asNumber(item.basePrice);
          return {
            id: item.id,
            name: item.name,
            emoji: item.emoji,
            price: price > 0 ? formatMoney(price, locale) : null,
            additions: item.additions.map((addition) => ({ name: addition.name, emoji: addition.emoji })),
          };
        })}
        current={order ? { menuItemId: order.menuItemId, additions: additionNames(order.additions), notes: order.notes ?? "" } : null}
        labels={{
          remaining: dict.food.endsIn,
          closed: dict.food.closed,
          notes: dict.food.notes,
          confirm: dict.food.confirm,
          saved: dict.food.saved,
          choose: dict.food.choose,
          price: dict.food.price,
        }}
      />
    </div>
  );
}
