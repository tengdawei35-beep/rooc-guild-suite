export function zonedDateTimeToUtc(dateValue: string, timeValue: string, timeZone: string): Date | null {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateValue) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(timeValue)) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      guess += target - represented;
    }
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    if (Number(parts.year) !== year || Number(parts.month) !== month || Number(parts.day) !== day || Number(parts.hour) !== hour || Number(parts.minute) !== minute) return null;
    return new Date(guess);
  } catch { return null; }
}

export function getLocalCalendarDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

export function formatCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10);
}
