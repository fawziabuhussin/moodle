import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, TOKEN_COOKIE, isLocale } from "@/lib/constants";
import type { Locale } from "@/lib/constants";
import { getPrisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function secretsMatch(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function hashPassword(password: string) {
  return hash(password, 10);
}

async function signToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("entilaka")
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readAuthToken() {
  const jar = await cookies();
  const cookie = jar.get(TOKEN_COOKIE)?.value;
  if (cookie) return cookie;
  const headerList = await headers();
  const header = headerList.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return null;
}

async function verifyJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "entilaka" });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = await readAuthToken();
  if (!token) return null;
  const claims = await verifyJwt(token);
  if (!claims) return null;

  const db = getPrisma();
  const authSession = await db.authSession.findUnique({
    where: { id: claims.sessionId },
    include: {
      user: {
        include: { roles: { include: { role: true } } },
      },
    },
  });

  if (!authSession || authSession.userId !== claims.userId) return null;
  if (authSession.expiresAt.getTime() < Date.now()) return null;
  if (authSession.tokenHash !== hashToken(token)) return null;
  if (!authSession.user.isActive) return null;

  const permissions = [...new Set(authSession.user.roles.flatMap((entry) => entry.role.permissions))];
  return {
    id: authSession.user.id,
    email: authSession.user.email,
    firstName: authSession.user.firstName,
    lastName: authSession.user.lastName,
    locale: authSession.user.locale,
    permissions,
    roleSlugs: authSession.user.roles.map((entry) => entry.role.slug),
    roleNames: authSession.user.roles.map((entry) => entry.role.name),
  };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireUser();
  if (!hasPermission(session.permissions, permission)) redirect("/dashboard?notice=forbidden");
  return session;
}

export async function authenticate(identifier: string, password: string, userAgent: string | null) {
  const db = getPrisma();
  const key = identifier.trim().toLowerCase();
  const user = /^\d{9}$/.test(key)
    ? await db.user.findFirst({ where: { isActive: true, studentProfile: { is: { nationalId: key } } } })
    : await db.user.findUnique({ where: { email: key } });
  if (!user || !user.isActive) return null;
  const valid = await compare(password, user.passwordHash);
  if (!valid) return null;

  const sessionId = randomUUID();
  const token = await signToken(user.id, sessionId);
  await db.authSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(token),
      userAgent: userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
    },
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
    },
  };
}

export async function attachSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export async function clearSession() {
  const token = await readAuthToken();
  if (token) {
    await getPrisma().authSession.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  }
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
}

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const cookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return DEFAULT_LOCALE;
}

export function publicUser(session: SessionUser) {
  return {
    id: session.id,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
    locale: session.locale,
    permissions: session.permissions,
    roles: session.roleSlugs,
  };
}
