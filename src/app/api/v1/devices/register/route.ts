import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PLATFORMS = new Set(["IOS", "ANDROID", "WEB"]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { platform?: unknown; pushToken?: unknown; deviceName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.platform !== "string" || !PLATFORMS.has(body.platform)) {
    return NextResponse.json({ error: "platform must be IOS, ANDROID, or WEB" }, { status: 400 });
  }
  if (typeof body.pushToken !== "string" || body.pushToken.length < 8 || body.pushToken.length > 4096) {
    return NextResponse.json({ error: "pushToken is required" }, { status: 400 });
  }
  const deviceName = typeof body.deviceName === "string" ? body.deviceName.slice(0, 120) : null;
  const device = await getPrisma().userDeviceToken.upsert({
    where: { userId_pushToken: { userId: session.id, pushToken: body.pushToken } },
    create: {
      userId: session.id,
      platform: body.platform as "IOS" | "ANDROID" | "WEB",
      pushToken: body.pushToken,
      deviceName,
      lastActiveAt: new Date(),
    },
    update: {
      platform: body.platform as "IOS" | "ANDROID" | "WEB",
      deviceName,
      lastActiveAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      platform: device.platform,
      deviceName: device.deviceName,
      lastActiveAt: device.lastActiveAt,
    },
  });
}
