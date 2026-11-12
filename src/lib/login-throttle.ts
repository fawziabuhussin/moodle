import "server-only";

import { headers } from "next/headers";
import { getPrisma } from "@/lib/prisma";

/**
 * Locks out password guessing.
 *
 * Two counters are kept for every failed sign-in: one per account and one per network address.
 * - An account is locked for 15 minutes after 5 failures, and each further run of 5 doubles the lock (up to 24 hours).
 * - A network address is locked after 40 failures, so one machine cannot spray guesses across many accounts.
 * A successful sign-in clears the account counter.
 *
 * Counters live in the database so every server instance sees them. If the database table is not
 * there yet (migration not applied), an in-memory counter on this instance is used instead.
 */

const WINDOW_MS = 15 * 60 * 1000;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_LIMIT = 5;
const NETWORK_LIMIT = 40;

type Row = { failures: number; windowStart: Date; lockedUntil: Date | null };

const memory = new Map<string, Row>();

function lockFor(failures: number, limit: number) {
  if (failures < limit) return null;
  const rounds = Math.floor(failures / limit) - 1;
  return Math.min(BASE_LOCK_MS * 2 ** rounds, MAX_LOCK_MS);
}

async function read(key: string): Promise<Row | null> {
  try {
    return await getPrisma().loginThrottle.findUnique({ where: { key } });
  } catch {
    return memory.get(key) ?? null;
  }
}

async function write(key: string, row: Row) {
  try {
    await getPrisma().loginThrottle.upsert({ where: { key }, create: { key, ...row }, update: row });
  } catch {
    if (memory.size > 5000) memory.clear();
    memory.set(key, row);
  }
}

async function remove(key: string) {
  memory.delete(key);
  try {
    await getPrisma().loginThrottle.deleteMany({ where: { key } });
  } catch {
    // Table missing; the in-memory entry is already gone.
  }
}

export async function clientAddress() {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (list.get("x-real-ip") ?? forwarded ?? "unknown").slice(0, 64);
}

function keysFor(identifier: string, address: string) {
  return { account: `id:${identifier.trim().toLowerCase().slice(0, 254)}`, network: `ip:${address}` };
}

/** Minutes until sign-in is allowed again, or 0 when it is allowed now. */
export async function lockedMinutes(identifier: string, address: string) {
  const { account, network } = keysFor(identifier, address);
  const now = Date.now();
  let until = 0;
  for (const key of [account, network]) {
    const row = await read(key);
    if (row?.lockedUntil && row.lockedUntil.getTime() > now) until = Math.max(until, row.lockedUntil.getTime());
  }
  return until ? Math.ceil((until - now) / 60000) : 0;
}

async function bump(key: string, limit: number) {
  const now = Date.now();
  const row = await read(key);
  // After a lock, failures keep counting for a day so repeat offenders get longer locks.
  const recentlyLocked = row?.lockedUntil ? now - row.lockedUntil.getTime() < MAX_LOCK_MS : false;
  const fresh = !row || (now - row.windowStart.getTime() > WINDOW_MS && !recentlyLocked);
  const failures = fresh ? 1 : row.failures + 1;
  const lock = lockFor(failures, limit);
  await write(key, {
    failures,
    windowStart: fresh ? new Date(now) : row.windowStart,
    lockedUntil: lock ? new Date(now + lock) : (row?.lockedUntil ?? null),
  });
}

export async function recordFailedLogin(identifier: string, address: string) {
  const { account, network } = keysFor(identifier, address);
  await Promise.all([bump(account, ACCOUNT_LIMIT), bump(network, NETWORK_LIMIT)]);
}

export async function clearFailedLogins(identifier: string) {
  await remove(keysFor(identifier, "").account);
}
