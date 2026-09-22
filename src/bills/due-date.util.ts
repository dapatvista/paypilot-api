// How many days before a bill's due date to send the reminder. Not
// per-bill configurable yet — a single default keeps the first cut simple.
export const REMINDER_LEAD_DAYS = 3;

function daysInMonth(year: number, month: number): number {
  // month is 0-indexed; day 0 of the next month = last day of this month.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// Next occurrence of dueDayOfMonth on/after `from`, clamped to the actual
// number of days in a given month (e.g. 31 on a 30-day month -> the 30th).
export function computeNextDueDate(dueDayOfMonth: number, from: Date = new Date()): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const clampedDay = Math.min(dueDayOfMonth, daysInMonth(year, month));
  const thisMonth = new Date(Date.UTC(year, month, clampedDay));

  if (thisMonth >= startOfUtcDay(from)) {
    return thisMonth;
  }

  const nextMonthClampedDay = Math.min(dueDayOfMonth, daysInMonth(year, month + 1));
  return new Date(Date.UTC(year, month + 1, nextMonthClampedDay));
}

// When to actually send the reminder for a given due date: leadDays before
// it, or ~1 minute from now if that point has already passed (e.g. the bill
// was connected inside the lead window).
export function computeReminderDate(dueDate: Date, leadDays: number, now: Date = new Date()): Date {
  const target = new Date(dueDate.getTime() - leadDays * 24 * 60 * 60 * 1000);
  return target > now ? target : new Date(now.getTime() + 60 * 1000);
}

export function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
