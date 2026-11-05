import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { provisionCohortAccounts } from "@/server/provision-accounts";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session || !hasPermission(session.permissions, "manage_users_and_roles")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await provisionCohortAccounts(getPrisma());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
