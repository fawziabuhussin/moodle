import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/constants";

const PUBLIC_PATHS = new Set(["/login", "/privacy"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) return origin === request.nextUrl.origin;
  // Browsers always send Origin on cross-site writes; fall back to the fetch metadata header.
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

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
  // Server actions must answer with their own flight response. A redirect here
  // reaches the browser as a normal page and the client throws "unexpected response".
  // Cookie-authenticated API writes must come from this site. Requests without the session cookie
  // (the terminal with its secret, the iOS app with a bearer token) are checked by the route itself.
  if (pathname.startsWith("/api") && !SAFE_METHODS.has(request.method) && request.cookies.has(TOKEN_COOKIE) && !sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }
  if (request.headers.has("next-action") || pathname.startsWith("/api") || pathname.startsWith("/_next")) return NextResponse.next();

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
