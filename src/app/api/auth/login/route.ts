import { NextResponse } from "next/server";
import { attachSessionCookie, authenticate } from "@/lib/auth";
import { isLoginIdentifier } from "@/lib/form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!isLoginIdentifier(email) || password.length < 8) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const result = await authenticate(email, password, request.headers.get("user-agent"));
  if (!result) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  await attachSessionCookie(result.token);
  const user = await getPrisma().user.findUnique({
    where: { id: result.user.id },
    include: { roles: { include: { role: true } } },
  });
  return NextResponse.json({
    token: result.token,
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      locale: result.user.locale,
      permissions: [...new Set(user?.roles.flatMap((entry) => entry.role.permissions) ?? [])],
      roles: user?.roles.map((entry) => entry.role.slug) ?? [],
    },
  });
}
