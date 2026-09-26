export const EVENT_TIME_ZONE = 'Europe/Rome';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function localDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// Resolve against offsets on both sides of a transition. A nonexistent spring
// time is rejected; an autumn time occurring twice consistently uses the later
// (standard-time) occurrence, independent of the administrator's device zone.
export function romeToIso(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00'] = match;
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}`;
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const instant = wall + delta;
    const parts = localDateInput(new Date(instant).toISOString()).match(/\d+/g)!.map(Number);
    offsets.add(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]) - instant);
  }
  const matches = [...offsets].map((offset) => new Date(wall - offset).toISOString())
    .filter((iso) => localDateInput(iso) === normalized).sort();
  return matches.at(-1) || null;
}

export function normalizeEventTimes(input: {
  startTime: string; endTime: string; hasEndDate: boolean; startHasTime: boolean; endHasTime: boolean;
}): { start: string; end: string } | null {
  const startDate = input.startTime.slice(0, 10);
  const endDate = input.hasEndDate ? input.endTime.slice(0, 10) : startDate;
  const start = romeToIso(`${startDate} ${input.startHasTime ? input.startTime.slice(11, 16) : '00:00'}`);
  const end = romeToIso(`${endDate} ${input.endHasTime ? input.endTime.slice(11, 16) : '23:59'}`);
  if (!start || !end) return null;
  return { start, end: input.endHasTime ? end : new Date(new Date(end).getTime() + 59999).toISOString() };
}
