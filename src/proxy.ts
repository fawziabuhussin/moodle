import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/constants";

const PUBLIC_PATHS = new Set(["/login", "/privacy"]);

async function tokenIsSigned(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "entilaka" });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return NextResponse.next();

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const signed = token ? await tokenIsSigned(token) : false;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!signed && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!signed && !isPublic) {
    const response = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
    if (token) response.cookies.delete(TOKEN_COOKIE);
    return response;
  }

  if (signed && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
