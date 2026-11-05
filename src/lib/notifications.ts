import "server-only";

import http2 from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import type { DevicePlatform, NotificationAudience, NotificationPriority } from "@prisma/client";
import { activeStudentWhere } from "@/lib/cohort";
import { getPrisma } from "@/lib/prisma";

type NotifyInput = {
  recipientIds: string[];
  title: string;
  body: string;
  priority?: NotificationPriority;
  audience: NotificationAudience;
  courseId?: string | null;
  createdById?: string | null;
  linkUrl?: string | null;
  isPinned?: boolean;
};

let apnsCache: { token: string; expiresAt: number } | null = null;

function apnsConfigured() {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID &&
      process.env.APNS_PRIVATE_KEY,
  );
}

function fcmConfigured() {
  return Boolean(process.env.FCM_SERVER_KEY);
}

async function appleJwt() {
  if (apnsCache && apnsCache.expiresAt > Date.now() + 60_000) return apnsCache.token;
  const pem = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID })
    .setIssuer(process.env.APNS_TEAM_ID!)
    .setIssuedAt()
    .sign(key);
  apnsCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

function sendApns(pushToken: string, jwt: string, payload: Record<string, unknown>) {
  const host = process.env.APNS_HOST || "https://api.sandbox.push.apple.com";
  const body = JSON.stringify(payload);
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const client = http2.connect(host);
    const cleanup = () => client.close();
    client.on("error", (error) => {
      cleanup();
      resolve({ ok: false, error: error.message });
    });
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.APNS_BUNDLE_ID!,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let response = "";
    let status = 0;
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk) => {
      response += chunk;
    });
    request.on("end", () => {
      cleanup();
      resolve(status === 200 ? { ok: true } : { ok: false, error: response || `APNs ${status}` });
    });
    request.on("error", (error) => {
      cleanup();
      resolve({ ok: false, error: error.message });
    });
    request.end(body);
  });
}

async function sendFcm(pushToken: string, title: string, body: string, data: Record<string, string>) {
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${process.env.FCM_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: pushToken,
      notification: { title, body },
      data,
      priority: "high",
    }),
  });
  if (!response.ok) return { ok: false, error: `FCM ${response.status}` };
  const json = (await response.json()) as { success?: number; results?: { error?: string }[] };
  if (json.success === 1) return { ok: true };
  return { ok: false, error: json.results?.[0]?.error || "FCM rejected the token" };
}

async function dispatchPush(
  notificationId: string,
  recipientIds: string[],
  message: { title: string; body: string; priority: NotificationPriority; linkUrl: string | null },
) {
  const db = getPrisma();
  const tokens = await db.userDeviceToken.findMany({
    where: { userId: { in: recipientIds } },
  });
  const byUser = new Map<string, { platform: DevicePlatform; pushToken: string }[]>();
  for (const token of tokens) {
    const list = byUser.get(token.userId) ?? [];
    list.push({ platform: token.platform, pushToken: token.pushToken });
    byUser.set(token.userId, list);
  }

  const apnsReady = apnsConfigured();
  const fcmReady = fcmConfigured();
  let jwt: string | null = null;
  if (apnsReady) {
    try {
      jwt = await appleJwt();
    } catch (error) {
      jwt = null;
      apnsCache = null;
      console.error("APNs JWT failed", error);
    }
  }

  await Promise.all(
    recipientIds.map(async (userId) => {
      const devices = byUser.get(userId) ?? [];
      if (devices.length === 0 || (!apnsReady && !fcmReady)) {
        await db.userNotification.updateMany({
          where: { notificationId, userId },
          data: {
            pushStatus: "SKIPPED",
            pushDispatchedAt: new Date(),
            pushError: devices.length === 0 ? "No registered device" : "Push provider is not configured",
          },
        });
        return;
      }

      let sent = false;
      let lastError = "Push was not delivered";
      for (const device of devices) {
        try {
          if (device.platform === "IOS" && jwt) {
            const result = await sendApns(device.pushToken, jwt, {
              aps: {
                alert: { title: message.title, body: message.body },
                sound: message.priority === "URGENT" ? "default" : undefined,
              },
              linkUrl: message.linkUrl,
              notificationId,
              priority: message.priority,
            });
            if (result.ok) sent = true;
            else lastError = result.error || lastError;
            continue;
          }
          if (fcmReady) {
            const result = await sendFcm(device.pushToken, message.title, message.body, {
              linkUrl: message.linkUrl ?? "",
              notificationId,
              priority: message.priority,
            });
            if (result.ok) sent = true;
            else lastError = result.error || lastError;
            continue;
          }
          lastError = "No provider for this device platform";
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Push failed";
        }
      }

      await db.userNotification.updateMany({
        where: { notificationId, userId },
        data: {
          pushStatus: sent ? "SENT" : "FAILED",
          pushDispatchedAt: new Date(),
          pushError: sent ? null : lastError.slice(0, 500),
        },
      });
    }),
  );
}

export async function notifyUsers(input: NotifyInput) {
  const recipientIds = [...new Set(input.recipientIds.filter(Boolean))];
  if (recipientIds.length === 0) return null;
  const priority = input.priority ?? "NORMAL";
  const notification = await getPrisma().notification.create({
    data: {
      title: input.title,
      body: input.body,
      priority,
      audience: input.audience,
      courseId: input.courseId ?? null,
      createdById: input.createdById ?? null,
      linkUrl: input.linkUrl ?? null,
      isPinned: input.isPinned ?? false,
      recipients: {
        create: recipientIds.map((userId) => ({ userId })),
      },
    },
  });

  await dispatchPush(notification.id, recipientIds, {
    title: input.title,
    body: input.body,
    priority,
    linkUrl: input.linkUrl ?? null,
  });
  return notification;
}

export async function recipientIdsForAudience(
  audience: "ALL_USERS" | "ALL_STUDENTS" | "ALL_TEACHERS" | "COURSE" | "INDIVIDUAL",
  options: { courseId?: string | null; userId?: string | null },
) {
  const db = getPrisma();
  if (audience === "INDIVIDUAL") return options.userId ? [options.userId] : [];
  if (audience === "COURSE") {
    if (!options.courseId) return [];
    const rows = await db.courseEnrollment.findMany({
      where: { courseId: options.courseId, user: activeStudentWhere() },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }
  if (audience === "ALL_USERS") {
    const rows = await db.user.findMany({ where: { isActive: true }, select: { id: true } });
    return rows.map((row) => row.id);
  }
  const slug = audience === "ALL_STUDENTS" ? "student" : "teacher";
  const rows = await db.user.findMany({
    where: { isActive: true, roles: { some: { role: { slug } } } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
