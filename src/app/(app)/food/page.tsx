import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getLocale, requireUser } from "@/lib/auth";
import { pollIsOpen } from "@/lib/food";
import { getDictionary } from "@/lib/i18n";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { ensureFoodMenu } from "@/server/food-menu";

function canManageFood(permissions: readonly string[], roleSlugs: readonly string[]) {
  return roleSlugs.includes("manager") || hasPermission(permissions, "manage_food_polls");
}

export default async function FoodPage() {
  const session = await requireUser();
  if (canManageFood(session.permissions, session.roleSlugs)) redirect("/food/manager");
  await ensureFoodMenu();
  const poll = await getPrisma().foodPoll.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  if (poll && pollIsOpen(poll.status, poll.closesAt)) redirect(`/food/poll/${poll.id}`);
  const dict = getDictionary(await getLocale());
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={dict.food.title} description={dict.food.studentWaiting} />
      <p className="rounded-3xl border border-orange-200 bg-orange-50 p-6 text-center text-4xl">🍽️</p>
    </div>
  );
}
