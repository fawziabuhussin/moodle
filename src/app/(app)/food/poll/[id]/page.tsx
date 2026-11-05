import { notFound, redirect } from "next/navigation";
import { FoodPicker } from "@/components/food/picker";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { additionNames } from "@/lib/food";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export default async function FoodPollPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  if (session.roleSlugs.includes("manager") || hasPermission(session.permissions, "manage_food_polls")) {
    redirect("/food/manager");
  }
  const { id } = await params;
  const dict = getDictionary(await getLocale());
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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`${poll.restaurant.logoIcon} ${poll.restaurant.name}`} description={dict.food.choose} />
      <FoodPicker
        pollId={poll.id}
        closesAt={poll.closesAt.toISOString()}
        status={poll.status}
        items={poll.restaurant.items.map((item) => ({
          id: item.id,
          name: item.name,
          emoji: item.emoji,
          additions: item.additions.map((addition) => ({ name: addition.name, emoji: addition.emoji })),
        }))}
        current={order ? { menuItemId: order.menuItemId, additions: additionNames(order.additions), notes: order.notes ?? "" } : null}
        labels={{
          remaining: dict.food.endsIn,
          closed: dict.food.closed,
          notes: dict.food.notes,
          confirm: dict.food.confirm,
          saved: dict.food.saved,
          choose: dict.food.choose,
        }}
      />
    </div>
  );
}
