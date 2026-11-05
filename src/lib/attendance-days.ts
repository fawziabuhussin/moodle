/** Wednesday, Friday, and Saturday have no attendance. */
export function isClosedAttendanceWeekday(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 3 || weekday === 5 || weekday === 6;
}
