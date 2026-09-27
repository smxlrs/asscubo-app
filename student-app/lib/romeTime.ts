export const ROME_TIME_ZONE = 'Europe/Rome';
export function romeParts(value: Date | string | number = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ROME_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const n = (key: string) => Number(parts.find(p => p.type === key)?.value);
  return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour'), minute: n('minute'), second: n('second') };
}
export function romeDay(value: Date | string | number = new Date()) {
  const p = romeParts(value);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export function romeMinutes(value: Date | string | number = new Date()) {
  const p = romeParts(value); return p.hour * 60 + p.minute;
}
export function formatRome(value: Date | string | number, locale = 'zh-CN', options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleString(locale, { ...options, timeZone: ROME_TIME_ZONE });
}
export function isRomeQuietHours(value: Date = new Date()) {
  const hour = romeParts(value).hour; return hour >= 22 || hour < 8;
}
