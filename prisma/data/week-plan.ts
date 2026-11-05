export const WEEK_PLAN = [
  { seedKey: "sun-coffee", dayOfWeek: 0, startTime: "08:30", endTime: "09:00", titleHe: "קפה והתכנסות", titleAr: "قهوة وتجمع", category: "FOOD_BREAK" },
  { seedKey: "sun-psy-am", dayOfWeek: 0, startTime: "09:00", endTime: "11:00", titleHe: "פסיכומטרי (בוקר)", titleAr: "بسيخومتري صباحي", category: "PSYCHOMETRY", courseCode: "PSY-BASE" },
  { seedKey: "sun-lunch", dayOfWeek: 0, startTime: "11:00", endTime: "12:00", titleHe: "הפסקת אוכל", titleAr: "استراحة طعام", category: "FOOD_BREAK" },
  { seedKey: "sun-free", dayOfWeek: 0, startTime: "12:00", endTime: "12:45", titleHe: "זמן חופשי + אוכל", titleAr: "وقت حر وطعام", category: "FOOD_BREAK" },
  { seedKey: "sun-psy-pm", dayOfWeek: 0, startTime: "12:45", endTime: "13:45", titleHe: "פסיכומטרי (צהריים)", titleAr: "بسيخومتري ظهيرة", category: "PSYCHOMETRY", courseCode: "PSY-800" },
  { seedKey: "sun-close", dayOfWeek: 0, startTime: "13:45", endTime: "14:00", titleHe: "סיכום יום", titleAr: "تلخيص اليوم", category: "GENERAL" },

  { seedKey: "mon-coffee", dayOfWeek: 1, startTime: "08:30", endTime: "09:00", titleHe: "קפה והתכנסות", titleAr: "قهوة وتجمع", category: "FOOD_BREAK" },
  { seedKey: "mon-python", dayOfWeek: 1, startTime: "09:00", endTime: "11:00", titleHe: "תכנות בפייתון ו-AI (אופק)", titleAr: "البرمجة بلغة بايثون والذكاء الاصطناعي", category: "PYTHON_AI", courseCode: "PY-AI", instructorName: "אופק" },
  { seedKey: "mon-lunch", dayOfWeek: 1, startTime: "11:00", endTime: "12:00", titleHe: "הפסקת אוכל", titleAr: "استراحة طعام", category: "FOOD_BREAK" },
  { seedKey: "mon-lead", dayOfWeek: 1, startTime: "12:00", endTime: "12:45", titleHe: "זהות ומנהיגות", titleAr: "الهوية والقيادة", category: "IDENTITY_LEADERSHIP", courseCode: "LEAD" },
  { seedKey: "mon-workshop", dayOfWeek: 1, startTime: "12:45", endTime: "13:45", titleHe: "סדנה מקצועית (אלריאן)", titleAr: "ورشة عمل مهنية", category: "WORKSHOP", instructorName: "אלריאן" },
  { seedKey: "mon-close", dayOfWeek: 1, startTime: "13:45", endTime: "14:00", titleHe: "סיכום יום", titleAr: "تلخيص اليوم", category: "GENERAL" },

  { seedKey: "tue-coffee", dayOfWeek: 2, startTime: "08:30", endTime: "09:00", titleHe: "קפה והתכנסות", titleAr: "قهوة وتجمع", category: "FOOD_BREAK" },
  { seedKey: "tue-yael", dayOfWeek: 2, startTime: "09:00", endTime: "11:00", titleHe: "עברית מדוברת והכנה ליע\"ל (אבגד)", titleAr: "اللغة العبرية المحكية وياعيل", category: "HEBREW_YAEL", courseCode: "HEB-YAEL", instructorName: "אבגד" },
  { seedKey: "tue-lunch", dayOfWeek: 2, startTime: "11:00", endTime: "12:00", titleHe: "הפסקת אוכל", titleAr: "استراحة طعام", category: "FOOD_BREAK" },
  { seedKey: "tue-free", dayOfWeek: 2, startTime: "12:00", endTime: "12:45", titleHe: "זמן חופשי + אוכל", titleAr: "وقت حر وطعام", category: "FOOD_BREAK" },
  { seedKey: "tue-psy", dayOfWeek: 2, startTime: "12:45", endTime: "13:45", titleHe: "פסיכומטרי - תרגול", titleAr: "بسيخومتري - تمرين", category: "PSYCHOMETRY", courseCode: "PSY-BASE" },
  { seedKey: "tue-close", dayOfWeek: 2, startTime: "13:45", endTime: "14:00", titleHe: "סיכום יום", titleAr: "تلخيص اليوم", category: "GENERAL" },

  { seedKey: "wed-coffee", dayOfWeek: 3, startTime: "08:30", endTime: "09:00", titleHe: "קפה והתכנסות", titleAr: "قهوة وتجمع", category: "FOOD_BREAK" },
  { seedKey: "wed-vol", dayOfWeek: 3, startTime: "09:00", endTime: "12:00", titleHe: "התנדבות בקהילה", titleAr: "التطوع في مؤسسات البلدة", category: "VOLUNTEERING", courseCode: "VOL" },
  { seedKey: "wed-mentor", dayOfWeek: 3, startTime: "12:00", endTime: "13:00", titleHe: "מפגשים אישיים וועדות", titleAr: "جلسات فردية ولجان المركز", category: "IDENTITY_LEADERSHIP", courseCode: "LEAD" },

  { seedKey: "thu-coffee", dayOfWeek: 4, startTime: "08:30", endTime: "09:00", titleHe: "קפה והתכנסות", titleAr: "قهوة وتجمع", category: "FOOD_BREAK" },
  { seedKey: "thu-psy", dayOfWeek: 4, startTime: "09:00", endTime: "11:00", titleHe: "פסיכומטרי (בוקר)", titleAr: "بسيخومتري صباحي", category: "PSYCHOMETRY", courseCode: "PSY-800" },
  { seedKey: "thu-lunch", dayOfWeek: 4, startTime: "11:00", endTime: "12:00", titleHe: "הפסקת אוכל", titleAr: "استراحة طعام", category: "FOOD_BREAK" },
  { seedKey: "thu-exam", dayOfWeek: 4, startTime: "12:00", endTime: "13:45", titleHe: "סימולציה / מבחן פסיכומטרי", titleAr: "امتحان وتقييم بسيخومتري", category: "EXAM", courseCode: "PSY-800" },
  { seedKey: "thu-close", dayOfWeek: 4, startTime: "13:45", endTime: "14:00", titleHe: "סיכום שבוע", titleAr: "تلخيص الأسبوع", category: "GENERAL" },
] as const;

export const DASHBOARD_ANNOUNCEMENTS = [
  {
    title: "השלמת אישור ניהול חשבון למלגה / استكمال تصديق الحساب البنكي للمنحة",
    body: "תזכורת לחניכים שטרם העלו אישור ניהול חשבון תקין לעדכן בתיקיית הקבצים עד יום חמישי.",
    priority: "URGENT" as const,
    isPinned: true,
  },
  {
    title: "סימולציית פסיכומטרי יום חמישי / امتحان محاكاة بسيخومتري يوم الخميس",
    body: "תתקיים בשעה 12:00 עבור מסלול 800 ומסלול בסיסי. נא להגיע בזמן.",
    priority: "IMPORTANT" as const,
    isPinned: true,
  },
  {
    title: "סדנת פייתון ובינה מלאכותית (אופק) / ورشة بايثون والذكاء الاصطناعي",
    body: "חומרי התרגול החדשים עלו לעמוד הקורס.",
    priority: "NORMAL" as const,
    isPinned: false,
  },
  {
    title: "שיבוץ מקומות התנדבות - יום רביעי / تحديد أماكن التطوع ليوم الأربعاء",
    body: "נא לוודא ששיבוץ ההתנדבות שלכם מעודכן בכרטיס התלמיד.",
    priority: "NORMAL" as const,
    isPinned: false,
  },
];
