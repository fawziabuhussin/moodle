import { NextResponse } from "next/server";
import { attachSessionCookie, authenticate } from "@/lib/auth";
import { isLoginIdentifier } from "@/lib/form";
import { clearFailedLogins, clientAddress, lockedMinutes, recordFailedLogin } from "@/lib/login-throttle";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!isLoginIdentifier(email) || password.length < 8 || password.length > 256) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const address = await clientAddress();
  const wait = await lockedMinutes(email, address);
  if (wait > 0) {
    return NextResponse.json({ error: "Too many attempts", retryAfterMinutes: wait }, { status: 429, headers: { "Retry-After": String(wait * 60) } });
  }
  const result = await authenticate(email, password, request.headers.get("user-agent"));
  if (!result) {
    await recordFailedLogin(email, address);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await clearFailedLogins(email);
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
