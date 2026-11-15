export function shiftBriefingDate(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function briefingPeriodLabel(start: string, cadence: 'daily' | 'weekly', today: string): string {
  if (cadence === 'daily') {
    if (start === today) return 'Today';
    if (start === shiftBriefingDate(today, -1)) return 'Yesterday';
    return new Date(`${start}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = shiftBriefingDate(today, -((weekday + 6) % 7));
  if (start === monday) return 'This week';
  if (start === shiftBriefingDate(monday, -7)) return 'Last week';
  return `Week of ${start.slice(5)}`;
}
