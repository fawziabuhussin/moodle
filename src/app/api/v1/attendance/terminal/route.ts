import { NextResponse } from "next/server";
import { recordTerminalTap } from "@/lib/attendance";
import { secretsMatch } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.TERMINAL_SECRET) {
    return NextResponse.json({ error: "Terminal secret is not configured" }, { status: 503 });
  }
  if (!secretsMatch(request.headers.get("x-terminal-secret"), process.env.TERMINAL_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { hardwareBadgeId?: unknown; timestamp?: unknown; courseId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.hardwareBadgeId !== "string" || !body.hardwareBadgeId.trim()) {
    return NextResponse.json({ error: "hardwareBadgeId is required" }, { status: 400 });
  }

  let timestamp: Date | undefined;
  if (body.timestamp != null) {
    if (typeof body.timestamp !== "string") return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
    timestamp = new Date(body.timestamp);
    if (Number.isNaN(timestamp.getTime())) return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }
  const courseId = typeof body.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;
  const result = await recordTerminalTap({
    hardwareBadgeId: body.hardwareBadgeId,
    timestamp,
    courseId,
    source: "TERMINAL_MACHINE",
  });

  if (!result.ok) {
    const status = result.error === "UNKNOWN_BADGE" || result.error === "UNKNOWN_COURSE" ? 404 : result.error === "ALREADY_COMPLETE" ? 409 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    action: result.action,
    student: result.student,
    record: {
      id: result.record.id,
      status: result.record.status,
      checkInTime: result.record.checkInTime,
      checkOutTime: result.record.checkOutTime,
      minutesLate: result.record.minutesLate,
      totalMinutes: result.record.totalMinutes,
      date: result.record.date,
    },
  });
}
