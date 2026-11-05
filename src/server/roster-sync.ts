import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { COHORT_25_26_STUDENTS } from "../../prisma/data/cohort-25-26";
import { COHORT_26_27_STUDENTS } from "../../prisma/data/cohort-26-27";

type Column = { key: string; label: string };
type Row = Record<string, string>;
type Cohort = "COHORT_2026_2027" | "COHORT_2025_2026" | "GENERAL";
type Visibility = "MANAGERS_ONLY" | "ALL_STUDENTS" | "SPECIFIC_COURSES" | "SPECIFIC_STUDENTS";

type FolderSpec = {
  slug: string;
  name: string;
  parentSlug: string | null;
  cohort: Cohort;
  visibility: Visibility;
  sortOrder: number;
};

type FileSpec = {
  slug: string;
  name: string;
  folderSlug: string;
  kind: "SHEET" | "DOC" | "FORM_LINK" | "PDF_UPLOAD";
  cohort: Cohort;
  visibility: Visibility;
  columns?: Column[];
  rows?: Row[];
  body?: string;
  linkUrl?: string | null;
  syncKey?: string | null;
  sortOrder: number;
  studentBadge?: string;
};

const PROFILE_COLUMNS: Column[] = [
  { key: "badgeId", label: "תג" },
  { key: "nameAr", label: "الاسم" },
  { key: "nameHe", label: "שם" },
  { key: "nationalId", label: "ת.ז" },
  { key: "email", label: "Email" },
  { key: "phone", label: "هاتف" },
  { key: "dob", label: "تاريخ الميلاد" },
  { key: "track", label: "المسار" },
  { key: "city", label: "البلدة" },
  { key: "psychometryTrack", label: "بسيخومتري" },
  { key: "volunteering", label: "التطوع" },
  { key: "stipendApproval", label: "اعتماد المنحة" },
  { key: "hasBankConfirmation", label: "אישור ניהול חשבון" },
];

const MONTHS_26 = ["09", "10", "11", "12", "01", "02", "03", "04", "05", "06"];
const MONTHS_25 = ["10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08"];

const COURSES = [
  { code: "PSY-800", title: "بسيخومتري - فرقة 800", description: "פסיכומטרי 800" },
  { code: "PSY-BASE", title: "بسيخومتרי - فرقة أساسية", description: "פסיכומטרי בסיסי" },
  { code: "PY-AI", title: "البرمجة بلغة بايثون والذكاء الاصطناعي", description: "Python & AI - أفق" },
  { code: "HEB-YAEL", title: "اللغة العبرية المحكية وامتحان ياعيل", description: "עברית מדוברת ויע\"ל - أبجد" },
  { code: "LEAD", title: "الهوية والقيادة وفن الإلقاء", description: "זהות, מנהיגות ועמידה מול קהל" },
  { code: "VOL", title: "التطوع والمشاريع المجتمعية", description: "התנדבות ומעורבות חברתית. مكان التطوع ظاهر في ملف كل طالب." },
] as const;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || name, lastName: parts.slice(1).join(" ") || "—" };
}

function parseDob(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const match = iso
    ? [iso[0], iso[3], iso[2], iso[1]]
    : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Row => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

function rowKey(row: Row) {
  return row.nationalId || row.badgeId || row.email || row.vendor || row.nameAr || "";
}

function mergeRows(previous: Row[], next: Row[]) {
  if (next.length === 0) return previous;
  const prior = new Map(previous.map((row) => [rowKey(row), row]));
  const merged = next.map((row) => {
    const old = prior.get(rowKey(row));
    if (!old) return row;
    const combined: Row = { ...old };
    for (const [key, cell] of Object.entries(row)) {
      if (cell !== "") combined[key] = cell;
    }
    return combined;
  });
  const nextKeys = new Set(next.map((row) => rowKey(row)));
  const extras = previous.filter((row) => {
    const key = rowKey(row);
    return key && !nextKeys.has(key);
  });
  return [...merged, ...extras];
}

function cohort2Row(student: (typeof COHORT_26_27_STUDENTS)[number]): Row {
  return {
    badgeId: student.badgeId,
    nameAr: student.nameAr,
    nameHe: student.nameHe,
    nationalId: student.nationalId,
    email: student.email,
    phone: student.phone,
    dob: student.dob,
    track: student.track,
    city: student.city,
    psychometryTrack: student.psychometryTrack,
    volunteering: student.volunteering,
    stipendApproval: student.stipendApproval,
    hasBankConfirmation: student.hasBankConfirmation ? "true" : "false",
    bankName: student.bankName,
    bankBranch: student.bankBranch,
    bankAccount: student.bankAccount,
  };
}

function cohort1Row(student: (typeof COHORT_25_26_STUDENTS)[number]): Row {
  return {
    badgeId: student.badgeId,
    nameAr: student.nameAr,
    nameHe: student.nameAr,
    nationalId: student.nationalId,
    email: student.email,
    phone: student.phone,
    dob: "",
    track: student.track,
    city: "",
    psychometryTrack: "",
    volunteering: student.volunteering,
    stipendApproval: "",
    hasBankConfirmation: student.bankAccount ? "true" : "false",
    bankName: student.bankName,
    bankBranch: student.bankBranch,
    bankAccount: student.bankAccount,
  };
}

function blankMonths(prefixes: string[]) {
  return Object.fromEntries(prefixes.map((month) => [`month_${month}`, ""]));
}

function buildFiles(): FileSpec[] {
  const c2 = COHORT_26_27_STUDENTS.map(cohort2Row);
  const c1 = COHORT_25_26_STUDENTS.map(cohort1Row);
  const stipend26: Row[] = c2.map((row) => ({
    nameAr: row.nameAr,
    nameHe: row.nameHe,
    nationalId: row.nationalId,
    stipendApproval: row.stipendApproval,
    ...blankMonths(MONTHS_26),
  }));
  const stipend25: Row[] = c1.map((row) => ({
    nameAr: row.nameAr,
    nationalId: row.nationalId,
    ...blankMonths(MONTHS_25),
  }));
  const monthColumns = (months: string[]): Column[] => [
    { key: "nameAr", label: "الاسم" },
    { key: "nationalId", label: "ת.ז" },
    ...months.map((month) => ({ key: `month_${month}`, label: `מלגת ${month}` })),
  ];

  const files: FileSpec[] = [
    {
      slug: "active-students-2627",
      name: "רשימת חניכים פעילים אינטלאקה ג'ת- 10- 26/27",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: PROFILE_COLUMNS,
      rows: c2,
      syncKey: "active-2627",
      sortOrder: 10,
    },
    {
      slug: "psychometry-2627",
      name: "مشتركو البسيخومتري- انطلاقة- جت 26/27",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nameHe", label: "שם" },
        { key: "nationalId", label: "ת.ז" },
        { key: "psychometryTrack", label: "أساسية / 800" },
        { key: "phone", label: "هاتف" },
      ],
      rows: c2.map((row) => ({
        nameAr: row.nameAr,
        nameHe: row.nameHe,
        nationalId: row.nationalId,
        psychometryTrack: row.psychometryTrack,
        phone: row.phone,
      })),
      syncKey: "psychometry-2627",
      sortOrder: 11,
    },
    {
      slug: "volunteering-2627-folder",
      name: "التطوع- طلاب انطلاقة- 26/27",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "ALL_STUDENTS",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nationalId", label: "ת.ז" },
        { key: "volunteering", label: "مكان التطوع" },
        { key: "phone", label: "هاتف" },
      ],
      rows: c2.map((row) => ({ nameAr: row.nameAr, nationalId: row.nationalId, volunteering: row.volunteering, phone: row.phone })),
      syncKey: "volunteering-2627",
      sortOrder: 12,
    },
    {
      slug: "interviews-expanded",
      name: "ملخص المقابلات الموسع",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "phone", label: "هاتف" },
        { key: "interviewer", label: "المحاور" },
        { key: "summary", label: "الملخص" },
      ],
      rows: [],
      sortOrder: 13,
    },
    {
      slug: "interviews-year-two",
      name: "مخلص المقابلات - السنة الثانية",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "phone", label: "هاتف" },
        { key: "summary", label: "الملخص" },
      ],
      rows: [],
      sortOrder: 14,
    },
    {
      slug: "weekly-program-2627",
      name: "برنامج الأسبوعي شهر 9 حتى شهر 12",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "ALL_STUDENTS",
      columns: [
        { key: "month", label: "الشهر" },
        { key: "week", label: "الأسبوع" },
        { key: "topic", label: "الموضوع" },
        { key: "owner", label: "المسؤول" },
      ],
      rows: [],
      sortOrder: 15,
    },
    {
      slug: "curriculum-2627",
      name: "كورسات+ ورشات+ رحلات+ جامعات+ لقاءات مع شخصيات",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "ALL_STUDENTS",
      columns: [
        { key: "kind", label: "النوع" },
        { key: "title", label: "العنوان" },
        { key: "date", label: "التاريخ" },
        { key: "place", label: "المكان" },
      ],
      rows: [],
      sortOrder: 16,
    },
    {
      slug: "alrayan-2627",
      name: "קורסים+סדנאות- אלריאן- מכון ג'ת",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "workshop", label: "סדנה" },
        { key: "date", label: "תאריך" },
        { key: "audience", label: "קהל" },
        { key: "notes", label: "הערות" },
      ],
      rows: [],
      sortOrder: 17,
    },
    {
      slug: "budget-2627",
      name: "טבלת חלוקת תקציב",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "item", label: "بند" },
        { key: "category", label: "קטגוריה" },
        { key: "amount", label: "סכום" },
        { key: "notes", label: "הערות" },
      ],
      rows: [],
      sortOrder: 18,
    },
    {
      slug: "gantt-2627",
      name: "גאנט שנתי ארגוני מעשה תשפ\"ז",
      folderSlug: "cohort-2026-2027",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "workstream", label: "משימה" },
        { key: "start", label: "התחלה" },
        { key: "end", label: "סיום" },
        { key: "owner", label: "אחראי" },
      ],
      rows: [],
      sortOrder: 19,
    },
    {
      slug: "cohort1-roster",
      name: "قائمة المشاركين- انطلاقة جت- 2025/2026",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        ...PROFILE_COLUMNS,
        { key: "bankName", label: "البنك" },
        { key: "bankBranch", label: "الفرع" },
        { key: "bankAccount", label: "الحساب" },
      ],
      rows: c1,
      syncKey: "cohort1-roster",
      sortOrder: 10,
    },
    {
      slug: "cohort1-stipends",
      name: "סטטוס מלגות- מכון אינטלאקה ג'ת",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: monthColumns(MONTHS_25),
      rows: stipend25,
      syncKey: "cohort1-stipends",
      sortOrder: 11,
    },
    {
      slug: "cohort1-banks",
      name: "חשבונות בנק- מכון ג'ת- מעודכן",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nationalId", label: "ת.ז" },
        { key: "phone", label: "هاتف" },
        { key: "bankName", label: "البنك" },
        { key: "bankBranch", label: "الفرع" },
        { key: "bankAccount", label: "الحساب" },
      ],
      rows: c1.map((row) => ({
        nameAr: row.nameAr,
        nationalId: row.nationalId,
        phone: row.phone,
        bankName: row.bankName,
        bankBranch: row.bankBranch,
        bankAccount: row.bankAccount,
      })),
      syncKey: "cohort1-banks",
      sortOrder: 12,
    },
    {
      slug: "cohort1-advising",
      name: "استشارة تعليم- انطلاقة جت 25/26",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "university", label: "الجامعة" },
        { key: "status", label: "الحالة" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows: [],
      sortOrder: 13,
    },
    {
      slug: "cohort1-academic",
      name: "توجيه اكاديمي",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "track", label: "المسار" },
        { key: "advisor", label: "المرشد" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows: [],
      sortOrder: 14,
    },
    {
      slug: "cohort1-psych-march",
      name: "بسيخومتري- قائمة موعد شهر 03- انطلاقة",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nationalId", label: "ת.ז" },
        { key: "phone", label: "هاتف" },
        { key: "appointment", label: "موعد شهر 03" },
      ],
      rows: c1.map((row) => ({ nameAr: row.nameAr, nationalId: row.nationalId, phone: row.phone, appointment: "" })),
      sortOrder: 15,
    },
    {
      slug: "equipment-center",
      name: "ציוד- مركز انطلاقة",
      folderSlug: "cohort-2025-2026",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "item", label: "العنصر" },
        { key: "place", label: "المكان" },
        { key: "quantity", label: "الكمية" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows: [],
      sortOrder: 16,
    },
    {
      slug: "assoc-2627-sheet",
      name: "אישור עמותה",
      folderSlug: "assoc-2627",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "status", label: "الحالة" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows: [],
      sortOrder: 1,
    },
    {
      slug: "assoc-2526-sheet",
      name: "אישורי עמותה",
      folderSlug: "assoc-2526",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "status", label: "الحالة" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows: [],
      sortOrder: 1,
    },
    {
      slug: "followup-2526-sheet",
      name: "ملف متابعة الطلاب",
      folderSlug: "followup-2526",
      kind: "SHEET",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nationalId", label: "ת.ז" },
        { key: "notes", label: "متابعة" },
      ],
      rows: c1.map((row) => ({ nameAr: row.nameAr, nationalId: row.nationalId, notes: "" })),
      sortOrder: 1,
    },
    {
      slug: "participants-2627",
      name: "قائمة المشتركين- جت- 26/27",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: PROFILE_COLUMNS,
      rows: c2,
      syncKey: "participants-2627",
      sortOrder: 30,
    },
    {
      slug: "arabic-roster-2627",
      name: "انطلاقة- الفوج الثاني- 26/27",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nationalId", label: "رقم الهوية" },
        { key: "track", label: "مسار الثانوية" },
        { key: "phone", label: "الهاتف" },
        { key: "dob", label: "سنة الميلاد" },
        { key: "city", label: "البلدة" },
      ],
      rows: c2.map((row) => ({
        nameAr: row.nameAr,
        nationalId: row.nationalId,
        track: row.track,
        phone: row.phone,
        dob: row.dob,
        city: row.city,
      })),
      syncKey: "arabic-roster-2627",
      sortOrder: 31,
    },
    {
      slug: "volunteering-2627",
      name: "التطوع- طلاب انطلاقة- 26/27",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "GENERAL",
      visibility: "ALL_STUDENTS",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nationalId", label: "ת.ז" },
        { key: "volunteering", label: "مكان التطوع" },
      ],
      rows: c2.map((row) => ({ nameAr: row.nameAr, nationalId: row.nationalId, volunteering: row.volunteering })),
      syncKey: "volunteering-2627-root",
      sortOrder: 32,
    },
    {
      slug: "stipend-tracker-2627",
      name: "جدول بيانات بدون عنوان (מעקב מלגות 26/27)",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "nameHe", label: "שם" },
        { key: "nationalId", label: "ת.ז" },
        { key: "stipendApproval", label: "الحالة" },
        ...MONTHS_26.map((month) => ({ key: `month_${month}`, label: `מלגת ${month}` })),
      ],
      rows: stipend26,
      syncKey: "stipend-2627",
      sortOrder: 33,
    },
    {
      slug: "vendors-jatt",
      name: "انطلاقة جت -ספקים",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "GENERAL",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "vendor", label: "הספק" },
        { key: "category", label: "النوع" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows: [
        { vendor: "أفق / Ofok", category: "دورات", notes: "Python & AI" },
        { vendor: "أبجد / Abjad", category: "دورات", notes: "עברית מדוברת ויע\"ל" },
        { vendor: "עתיד / Atid", category: "دورات", notes: "" },
        { vendor: "الريان / Al-Rayan", category: "ورشات", notes: "מכון ג'ת" },
        { vendor: "سوبر البيان / Super Al-Bayan", category: "طعام", notes: "" },
        { vendor: "مخبز الدوار / Makhbaz Al-Dawar", category: "طعام", notes: "" },
      ],
      sortOrder: 34,
    },
    {
      slug: "committees",
      name: "لجان مركز انطلاقة",
      folderSlug: "entilaka-jatt",
      kind: "DOC",
      cohort: "GENERAL",
      visibility: "ALL_STUDENTS",
      body: [
        "لجان مركز انطلاقة",
        "",
        "1. اللجنة اللوجستية",
        "2. لجنة الترتيب والتنظيم",
        "3. لجنة الاستقطاب",
        "4. لجنة العلاقات العامة والإعلامية",
        "5. لجنة الطعام",
        "6. لجنة التطوع والمشاريع",
        "7. لجنة الرحلات والجولات",
        "8. لجنة الاستضافات والورشات",
      ].join("\n"),
      sortOrder: 35,
    },
    {
      slug: "interview-registration",
      name: "التسجيل للمقابلات",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "GENERAL",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "phone", label: "الهاتف" },
        { key: "slot", label: "الموعد" },
        { key: "status", label: "الحالة" },
      ],
      rows: [],
      sortOrder: 36,
    },
    {
      slug: "interview-confirmation",
      name: "تأكيد الحضور للمقابلات من المسجلين للمشروع",
      folderSlug: "entilaka-jatt",
      kind: "SHEET",
      cohort: "GENERAL",
      visibility: "MANAGERS_ONLY",
      columns: [
        { key: "nameAr", label: "الاسم" },
        { key: "phone", label: "الهاتف" },
        { key: "confirmed", label: "تأكيد الحضور" },
      ],
      rows: [],
      sortOrder: 37,
    },
    {
      slug: "registration-form",
      name: "استمارة تسجيل لبرنامج انطلاقة- جت المثلث",
      folderSlug: "entilaka-jatt",
      kind: "FORM_LINK",
      cohort: "GENERAL",
      visibility: "MANAGERS_ONLY",
      body: "الحقول: البريد، الاسم بالعبرية، تاريخ الميلاد، رقم الهوية، وحالة אישור ניהול חשבון. الردود محفوظة في قائمة المشتركين.",
      linkUrl: "/files/participants-2627",
      sortOrder: 38,
    },
    {
      slug: "bank-confirmation-form",
      name: "فورمز لرفع \"אישור ניהול חשבון\"",
      folderSlug: "entilaka-jatt",
      kind: "FORM_LINK",
      cohort: "GENERAL",
      visibility: "MANAGERS_ONLY",
      body: "رفع אישור ניהול חשבון يحدّث شارة الأهلية في ملف الطالب.",
      linkUrl: "/files?folder=forms-bank-confirmations",
      sortOrder: 39,
    },
  ];

  for (const student of COHORT_26_27_STUDENTS) {
    files.push({
      slug: `bank-form-${student.badgeId.toLowerCase()}`,
      name: student.nameAr,
      folderSlug: "forms-bank-confirmations",
      kind: "PDF_UPLOAD",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      body: student.hasBankConfirmation ? "uploaded" : "missing",
      studentBadge: student.badgeId,
      sortOrder: 100,
    });
    files.push({
      slug: `bank-2627-${student.badgeId.toLowerCase()}`,
      name: student.nameAr,
      folderSlug: "bank-2627",
      kind: "PDF_UPLOAD",
      cohort: "COHORT_2026_2027",
      visibility: "MANAGERS_ONLY",
      body: student.hasBankConfirmation ? "uploaded" : "missing",
      studentBadge: student.badgeId,
      sortOrder: 100,
    });
  }
  for (const student of COHORT_25_26_STUDENTS) {
    files.push({
      slug: `bank-2526-${student.badgeId.toLowerCase()}`,
      name: student.nameAr,
      folderSlug: "bank-2526",
      kind: "PDF_UPLOAD",
      cohort: "COHORT_2025_2026",
      visibility: "MANAGERS_ONLY",
      body: student.bankAccount ? "uploaded" : "missing",
      studentBadge: student.badgeId,
      sortOrder: 100,
    });
  }
  return files;
}

const FOLDERS: FolderSpec[] = [
  { slug: "entilaka-jatt", name: "انطلاقة- جت", parentSlug: null, cohort: "GENERAL", visibility: "MANAGERS_ONLY", sortOrder: 0 },
  { slug: "forms-bank-confirmations", name: "فورمز لرفع \"אישור ניהול חשבון\" (File responses)", parentSlug: "entilaka-jatt", cohort: "GENERAL", visibility: "MANAGERS_ONLY", sortOrder: 1 },
  { slug: "cohort-2026-2027", name: "2026-2027 (الفوج الثاني - תשפ\"ז)", parentSlug: "entilaka-jatt", cohort: "COHORT_2026_2027", visibility: "MANAGERS_ONLY", sortOrder: 2 },
  { slug: "bank-2627", name: "אישור ניהול חשבון", parentSlug: "cohort-2026-2027", cohort: "COHORT_2026_2027", visibility: "MANAGERS_ONLY", sortOrder: 1 },
  { slug: "assoc-2627", name: "אישור עמותה", parentSlug: "cohort-2026-2027", cohort: "COHORT_2026_2027", visibility: "MANAGERS_ONLY", sortOrder: 2 },
  { slug: "cohort-2025-2026", name: "2025-2026 (الفوج الأول - תשפ\"ו)", parentSlug: "entilaka-jatt", cohort: "COHORT_2025_2026", visibility: "MANAGERS_ONLY", sortOrder: 3 },
  { slug: "bank-2526", name: "אישור ניהול חשבון", parentSlug: "cohort-2025-2026", cohort: "COHORT_2025_2026", visibility: "MANAGERS_ONLY", sortOrder: 1 },
  { slug: "assoc-2526", name: "אישורי עמותה", parentSlug: "cohort-2025-2026", cohort: "COHORT_2025_2026", visibility: "MANAGERS_ONLY", sortOrder: 2 },
  { slug: "followup-2526", name: "ملف متابعة الطلاب", parentSlug: "cohort-2025-2026", cohort: "COHORT_2025_2026", visibility: "MANAGERS_ONLY", sortOrder: 3 },
];

async function upsertStudent(
  db: PrismaClient,
  studentRoleId: string,
  passwordHash: string,
  input: {
    badgeId: string;
    nameAr: string;
    nameHe: string;
    nationalId: string;
    email: string;
    phone: string;
    dob: string;
    track: string;
    city: string;
    psychometryTrack: string;
    volunteering: string;
    stipendApproval: string;
    hasBankConfirmation: boolean;
    cohort: string;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  const byNationalId = input.nationalId
    ? await db.user.findFirst({
        where: { studentProfile: { is: { nationalId: input.nationalId } } },
        include: { studentProfile: true },
      })
    : null;
  const byEmail = byNationalId
    ? null
    : await db.user.findUnique({ where: { email }, include: { studentProfile: true } });
  const existing = byNationalId ?? byEmail;
  const names = splitName(input.nameHe || input.nameAr);
  const profile = {
    nationalId: input.nationalId,
    dateOfBirth: input.dob ? parseDob(input.dob) : null,
    city: input.city || null,
    academicTrack: input.track || null,
    nameAr: input.nameAr,
    cohort: input.cohort,
    psychometryTrack: input.psychometryTrack || null,
    volunteeringPlace: input.volunteering || null,
    nameHe: input.nameHe || null,
    stipendApproval: input.stipendApproval || null,
    hasBankConfirmation: input.hasBankConfirmation,
    bankName: input.bankName || null,
    bankBranch: input.bankBranch || null,
    bankAccountNumber: input.bankAccount || null,
  };

  if (input.badgeId) {
    await db.user.updateMany({
      where: { hardwareBadgeId: input.badgeId, ...(existing ? { NOT: { id: existing.id } } : {}) },
      data: { hardwareBadgeId: null },
    });
  }
  if (existing) {
    const emailOwner = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (emailOwner && emailOwner.id !== existing.id) {
      await db.user.update({
        where: { id: emailOwner.id },
        data: { email: `archived-${emailOwner.id}@entilaka.local` },
      });
    }
  }

  if (!existing) {
    const created = await db.user.create({
      data: {
        email,
        passwordHash,
        firstName: names.firstName,
        lastName: names.lastName,
        phone: input.phone,
        locale: "ar",
        hardwareBadgeId: input.badgeId,
        studentProfile: { create: profile },
        roles: { create: { roleId: studentRoleId } },
      },
    });
    return created.id;
  }

  await db.user.update({
    where: { id: existing.id },
    data: {
      email,
      firstName: names.firstName,
      lastName: names.lastName,
      phone: input.phone,
      hardwareBadgeId: input.badgeId,
      isActive: true,
    },
  });
  if (existing.studentProfile) {
    await db.studentProfile.update({ where: { userId: existing.id }, data: profile });
  } else {
    await db.studentProfile.create({ data: { userId: existing.id, ...profile } });
  }
  await db.userRole.upsert({
    where: { userId_roleId: { userId: existing.id, roleId: studentRoleId } },
    update: {},
    create: { userId: existing.id, roleId: studentRoleId },
  });
  return existing.id;
}

function truthy(value: string) {
  return /^(true|1|yes|oui|نعم|הועלה|קיים)$/i.test(value.trim());
}

export async function applySheetRows(db: PrismaClient, rows: Row[]) {
  let updated = 0;
  for (const row of rows) {
    const nationalId = row.nationalId?.trim();
    const badgeId = row.badgeId?.trim();
    const email = row.email?.trim().toLowerCase();
    if (!nationalId && !badgeId && !email) continue;
    const user = await db.user.findFirst({
      where: {
        OR: [
          ...(badgeId ? [{ hardwareBadgeId: badgeId }] : []),
          ...(email ? [{ email }] : []),
          ...(nationalId ? [{ studentProfile: { nationalId } }] : []),
        ],
      },
      include: { studentProfile: true },
    });
    if (!user?.studentProfile) continue;
    const data: Prisma.StudentProfileUpdateInput = {};
    if (row.nameAr) data.nameAr = row.nameAr;
    if (row.nationalId) data.nationalId = row.nationalId;
    if (row.track) data.academicTrack = row.track;
    if (row.city) data.city = row.city;
    if (row.psychometryTrack) data.psychometryTrack = row.psychometryTrack;
    if (row.volunteering) data.volunteeringPlace = row.volunteering;
    if (row.stipendApproval) data.stipendApproval = row.stipendApproval;
    if (row.bankName) data.bankName = row.bankName;
    if (row.bankBranch) data.bankBranch = row.bankBranch;
    if (row.bankAccount) data.bankAccountNumber = row.bankAccount;
    if (row.dob) {
      const dob = parseDob(row.dob);
      if (dob) data.dateOfBirth = dob;
    }
    if (row.hasBankConfirmation) data.hasBankConfirmation = truthy(row.hasBankConfirmation);
    if (Object.keys(data).length > 0) {
      await db.studentProfile.update({ where: { userId: user.id }, data });
      updated += 1;
    }
    const userData: Prisma.UserUpdateInput = {};
    if (row.nameHe) {
      const names = splitName(row.nameHe);
      userData.firstName = names.firstName;
      userData.lastName = names.lastName;
    }
    if (row.phone) userData.phone = row.phone;
    if (Object.keys(userData).length > 0) {
      await db.user.update({ where: { id: user.id }, data: userData });
    }
  }
  return updated;
}

export async function syncRealRoster(db: PrismaClient) {
  const studentRole = await db.role.findUnique({ where: { slug: "student" } });
  if (!studentRole) throw new Error("Student role is missing. Seed roles before the roster.");
  const passwordHash = await hash(randomBytes(24).toString("hex"), 10);
  const ids = new Map<string, string>();

  for (const student of COHORT_26_27_STUDENTS) {
    const id = await upsertStudent(db, studentRole.id, passwordHash, { ...student, cohort: "2026-2027" });
    ids.set(student.badgeId, id);
  }
  for (const student of COHORT_25_26_STUDENTS) {
    const id = await upsertStudent(db, studentRole.id, passwordHash, {
      ...student,
      nameHe: student.nameAr,
      dob: "",
      city: "",
      psychometryTrack: "",
      stipendApproval: "",
      hasBankConfirmation: Boolean(student.bankAccount),
      cohort: "2025-2026",
    });
    ids.set(student.badgeId, id);
  }

  const courseIds = new Map<string, string>();
  for (const course of COURSES) {
    const saved = await db.course.upsert({
      where: { code: course.code },
      update: { title: course.title, description: course.description, isActive: true },
      create: { code: course.code, title: course.title, description: course.description },
    });
    courseIds.set(course.code, saved.id);
  }
  const cohort2Ids = COHORT_26_27_STUDENTS.map((student) => ids.get(student.badgeId)).filter((id): id is string => Boolean(id));
  await db.courseEnrollment.deleteMany({
    where: { userId: { in: cohort2Ids }, courseId: { in: [...courseIds.values()] } },
  });
  const enrollments: { courseId: string; userId: string }[] = [];
  for (const student of COHORT_26_27_STUDENTS) {
    const userId = ids.get(student.badgeId);
    if (!userId) continue;
    const codes = student.psychometryTrack === "800"
      ? ["PSY-800", "PY-AI", "HEB-YAEL", "LEAD", "VOL"]
      : ["PSY-BASE", "PY-AI", "HEB-YAEL", "LEAD", "VOL"];
    for (const code of codes) {
      const courseId = courseIds.get(code);
      if (courseId) enrollments.push({ courseId, userId });
    }
  }
  if (enrollments.length > 0) {
    await db.courseEnrollment.createMany({ data: enrollments, skipDuplicates: true });
  }

  const folderIds = new Map<string, string>();
  for (const folder of FOLDERS) {
    const saved = await db.driveFolder.upsert({
      where: { slug: folder.slug },
      update: {
        name: folder.name,
        cohort: folder.cohort,
        visibility: folder.visibility,
        sortOrder: folder.sortOrder,
        parentId: folder.parentSlug ? folderIds.get(folder.parentSlug) ?? null : null,
      },
      create: {
        name: folder.name,
        slug: folder.slug,
        cohort: folder.cohort,
        visibility: folder.visibility,
        sortOrder: folder.sortOrder,
        parentId: folder.parentSlug ? folderIds.get(folder.parentSlug) ?? null : null,
      },
    });
    folderIds.set(folder.slug, saved.id);
  }

  for (const file of buildFiles()) {
    const folderId = folderIds.get(file.folderSlug);
    if (!folderId) continue;
    const existing = await db.driveFile.findUnique({ where: { slug: file.slug } });
    const rows = file.kind === "SHEET" ? mergeRows(asRows(existing?.rows), file.rows ?? []) : undefined;
    const studentId = file.studentBadge ? ids.get(file.studentBadge) ?? null : null;
    const data = {
      name: file.name,
      folderId,
      kind: file.kind,
      cohort: file.cohort,
      visibility: file.visibility,
      columns: file.columns ? (file.columns as Prisma.InputJsonValue) : Prisma.JsonNull,
      rows: rows ? (rows as Prisma.InputJsonValue) : file.kind === "SHEET" ? ([] as Prisma.InputJsonValue) : Prisma.JsonNull,
      body: file.body ?? null,
      linkUrl: file.linkUrl ?? existing?.linkUrl ?? null,
      syncKey: file.syncKey ?? null,
      studentId,
      sortOrder: file.sortOrder,
    };
    if (existing?.linkUrl && file.kind === "PDF_UPLOAD") data.linkUrl = existing.linkUrl;
    await db.driveFile.upsert({
      where: { slug: file.slug },
      update: data,
      create: { slug: file.slug, ...data },
    });
  }

  return {
    cohort2026: COHORT_26_27_STUDENTS.length,
    cohort2025: COHORT_25_26_STUDENTS.length,
    courses: COURSES.length,
  };
}
