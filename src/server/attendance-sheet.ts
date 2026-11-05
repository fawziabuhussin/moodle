import type { AttendanceStatus, PrismaClient } from "@prisma/client";
import { activeStudentWhere } from "@/lib/cohort";
import { calendarDateFromISO } from "@/lib/time";

export const ATTENDANCE_SHEET_ID = "1xg8dfqk9nRwLeSY82YcXqkhBSqBWPkEET3uGkgd0o1g";
export const ATTENDANCE_SHEET_GID = "898432682";

const SHEET_URL = `https://docs.google.com/spreadsheets/d/${ATTENDANCE_SHEET_ID}/export?format=csv&gid=${ATTENDANCE_SHEET_GID}`;

const STATUS_BY_LABEL: Record<string, AttendanceStatus> = {
  حضور: "ATTENDED",
  تاخير: "LATE",
  تأخير: "LATE",
  غياب: "ABSENT",
  "غياب مع عذر": "EXCUSED",
  "تاخير مع عذر": "LATE",
  "تأخير مع عذر": "LATE",
};

type StudentIdentity = {
  id: string;
  hardwareBadgeId: string | null;
  nameHe: string | null;
  nameAr: string | null;
  firstName: string;
  lastName: string;
};

export type AttendanceSheetPlan = {
  days: string[];
  records: Array<{ userId: string; date: string; status: AttendanceStatus; notes: string }>;
  matched: Array<{ name: string; userId: string }>;
  unmatched: string[];
  ambiguous: string[];
  unrecognized: string[];
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim()));
}

function foldToken(token: string) {
  return token
    .replace(/[ך]/g, "כ")
    .replace(/[ם]/g, "מ")
    .replace(/[ן]/g, "נ")
    .replace(/[ף]/g, "פ")
    .replace(/[ץ]/g, "צ")
    .replace(/ש/g, "ס")
    .replace(/(.)\1+/g, "$1");
}

function nameTokens(value: string) {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[׳״'’‘`´]/g, "");
  return cleaned
    .split(/[^\u0590-\u05FF]+/)
    .map(foldToken)
    .filter((token) => token.length > 1);
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = left[i - 1] === right[j - 1] ? previous : Math.min(previous, row[j], row[j - 1]) + 1;
      previous = current;
    }
  }
  return row[right.length];
}

function alignmentCost(shorter: string[], longer: string[]) {
  const search = (index: number, used: number, cost: number): number | null => {
    if (index === shorter.length) return cost;
    let best: number | null = null;
    for (let column = 0; column < longer.length; column += 1) {
      if (used & (1 << column)) continue;
      const distance = editDistance(shorter[index], longer[column]);
      if (distance > 1) continue;
      const next = search(index + 1, used | (1 << column), cost + distance);
      if (next !== null && (best === null || next < best)) best = next;
    }
    return best;
  };
  return search(0, 0, 0);
}

function matchCost(sheetName: string, officialName: string) {
  const sheet = nameTokens(sheetName);
  const official = nameTokens(officialName);
  if (sheet.length < 2 || official.length < 2) return null;
  const [shorter, longer] = sheet.length <= official.length ? [sheet, official] : [official, sheet];
  return alignmentCost(shorter, longer);
}

function isoFromSheetDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const iso = `${match[3]}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function timestampValue(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
}

export function planAttendanceSheet(csv: string, students: StudentIdentity[]): AttendanceSheetPlan {
  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  const dateIndex = header.findIndex((column) => column.trim() === "التاريخ");
  const columns = header
    .map((column, index) => ({ index, name: column.match(/\[(.+?)\]/)?.[1]?.trim() ?? "" }))
    .filter((column) => column.name);
  const identities = students.map((student) => ({
    student,
    names: [student.nameHe, student.nameAr, `${student.firstName} ${student.lastName}`].filter((name): name is string => Boolean(name?.trim())),
  }));
  const byName = new Map<string, { userId: string } | "ambiguous">();
  const matched: AttendanceSheetPlan["matched"] = [];
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  for (const column of columns) {
    const ranked = identities
      .map((identity) => {
        const costs = identity.names.map((name) => matchCost(column.name, name)).filter((cost): cost is number => cost !== null);
        return costs.length ? { userId: identity.student.id, cost: Math.min(...costs) } : null;
      })
      .filter((item): item is { userId: string; cost: number } => item !== null)
      .sort((left, right) => left.cost - right.cost);
    const best = ranked[0];
    const tied = best ? ranked.filter((item) => item.cost === best.cost && item.userId !== best.userId) : [];
    if (!best) {
      unmatched.push(column.name);
      continue;
    }
    if (tied.length > 0) {
      ambiguous.push(column.name);
      byName.set(column.name, "ambiguous");
      continue;
    }
    byName.set(column.name, { userId: best.userId });
    matched.push({ name: column.name, userId: best.userId });
  }

  const latestByDate = new Map<string, { stamp: number; row: string[] }>();
  for (const row of rows.slice(1)) {
    const iso = dateIndex >= 0 ? isoFromSheetDate(row[dateIndex] ?? "") : null;
    if (!iso) continue;
    const stamp = timestampValue(row[0] ?? "");
    const current = latestByDate.get(iso);
    if (!current || stamp >= current.stamp) latestByDate.set(iso, { stamp, row });
  }

  const records: AttendanceSheetPlan["records"] = [];
  const unrecognized = new Set<string>();
  for (const [date, entry] of [...latestByDate.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    for (const column of columns) {
      const label = (entry.row[column.index] ?? "").trim().replace(/\s+/g, " ");
      if (!label) continue;
      const status = STATUS_BY_LABEL[label];
      const target = byName.get(column.name);
      if (!status) {
        unrecognized.add(label);
        continue;
      }
      if (!target || target === "ambiguous") continue;
      records.push({ userId: target.userId, date, status, notes: label });
    }
  }

  return {
    days: [...latestByDate.keys()].sort(),
    records,
    matched,
    unmatched,
    ambiguous,
    unrecognized: [...unrecognized],
  };
}

export async function syncAttendanceSheet(db: PrismaClient, recordedById?: string) {
  const response = await fetch(SHEET_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Attendance sheet could not be read.");
  const students = await db.user.findMany({
    where: { ...activeStudentWhere(), roles: { some: { role: { slug: "student" } } } },
    select: { id: true, hardwareBadgeId: true, nameHe: true, nameAr: true, firstName: true, lastName: true },
  });
  const plan = planAttendanceSheet(await response.text(), students);
  await db.$transaction(
    async (tx) => {
      for (const record of plan.records) {
        const date = calendarDateFromISO(record.date);
        const where = { userId_date_courseScope: { userId: record.userId, date, courseScope: "none" } };
        const data = { status: record.status, notes: record.notes };
        await tx.attendanceRecord.upsert({
          where,
          create: {
            userId: record.userId,
            courseScope: "none",
            date,
            source: "MANUAL",
            recordedById,
            minutesLate: record.status === "LATE" ? null : 0,
            ...data,
          },
          update: data,
        });
      }
    },
    { timeout: 30_000 },
  );
  return plan;
}
