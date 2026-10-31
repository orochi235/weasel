/** Dates as a gantt writes them: Day.js formats read and written, strftime for the axis. Every instant is UTC. */

const TOKENS = ['YYYY', 'SSS', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss', 'M', 'D', 'H', 'm', 's', 'X', 'x'] as const;
type Token = (typeof TOKENS)[number];
type Part = { token: Token } | { literal: string };

const PATTERN: Readonly<Record<Token, string>> = {
  YYYY: '\\d{4}', YY: '\\d{2}', MM: '\\d{2}', M: '\\d{1,2}', DD: '\\d{2}', D: '\\d{1,2}', HH: '\\d{2}', H: '\\d{1,2}',
  mm: '\\d{2}', m: '\\d{1,2}', ss: '\\d{2}', s: '\\d{1,2}', SSS: '\\d{3}', X: '[+-]?\\d+(?:\\.\\d+)?', x: '[+-]?\\d+',
};

/** The default `dateFormat`. */
export const GANTT_DATE_FORMAT = 'YYYY-MM-DD';

/** `format` as tokens and the literal text between them; `[…]` is literal. */
function partsOf(format: string): Part[] {
  const parts: Part[] = [];
  let literal = '';
  for (let i = 0; i < format.length;) {
    const close = format[i] === '[' ? format.indexOf(']', i) : -1;
    if (close > i) {
      literal += format.slice(i + 1, close);
      i = close + 1;
      continue;
    }
    const token = TOKENS.find((t) => format.startsWith(t, i));
    if (token === undefined) {
      literal += format[i];
      i++;
      continue;
    }
    if (literal !== '') parts.push({ literal });
    literal = '';
    parts.push({ token });
    i += token.length;
  }
  if (literal !== '') parts.push({ literal });
  return parts;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether dates in `format` carry a time of day, so an edit snaps to whole hours rather than days. */
export const formatHasHours = (format: string): boolean =>
  partsOf(format).some((p) => 'token' in p && ['HH', 'H', 'X', 'x'].includes(p.token));

/** `text` read strictly in Day.js `format`, as milliseconds since the epoch; `null` when it does not read. Fields the
 *  format lacks default to 1970-01-01 00:00. */
export function parseGanttDate(text: string, format: string): number | null {
  const parts = partsOf(format);
  const m = new RegExp(`^${parts.map((p) => ('token' in p ? `(${PATTERN[p.token]})` : escapeRe(p.literal))).join('')}$`).exec(text.trim());
  if (m === null) return null;
  const f = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, ms: 0 };
  let group = 1;
  for (const p of parts) {
    if (!('token' in p)) continue;
    const n = Number(m[group++]);
    switch (p.token) {
      case 'X': return n * 1000;
      case 'x': return n;
      case 'YYYY': f.year = n; break;
      case 'YY': f.year = n + (n > 68 ? 1900 : 2000); break;
      case 'MM': case 'M': f.month = n; break;
      case 'DD': case 'D': f.day = n; break;
      case 'HH': case 'H': f.hour = n; break;
      case 'mm': case 'm': f.minute = n; break;
      case 'ss': case 's': f.second = n; break;
      case 'SSS': f.ms = n; break;
    }
  }
  if (f.month < 1 || f.month > 12 || f.day < 1 || f.hour > 23 || f.minute > 59 || f.second > 59) return null;
  const t = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second, f.ms);
  return new Date(t).getUTCDate() === f.day ? t : null;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** `t` written in Day.js `format`. */
export function formatGanttDate(t: number, format: string): string {
  const d = new Date(t);
  const field: Readonly<Record<Token, () => string>> = {
    YYYY: () => pad(d.getUTCFullYear(), 4), YY: () => pad(d.getUTCFullYear() % 100), MM: () => pad(d.getUTCMonth() + 1),
    M: () => String(d.getUTCMonth() + 1), DD: () => pad(d.getUTCDate()), D: () => String(d.getUTCDate()),
    HH: () => pad(d.getUTCHours()), H: () => String(d.getUTCHours()), mm: () => pad(d.getUTCMinutes()), m: () => String(d.getUTCMinutes()),
    ss: () => pad(d.getUTCSeconds()), s: () => String(d.getUTCSeconds()), SSS: () => pad(d.getUTCMilliseconds(), 3),
    X: () => String(t / 1000), x: () => String(t),
  };
  return partsOf(format).map((p) => ('token' in p ? field[p.token]() : p.literal)).join('');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** `t` written in strftime `format`: `%Y %y %m %d %e %b %B %a %A %H %I %M %S %p %j %%`; any other `%` sequence as is. */
export function strftime(t: number, format: string): string {
  const d = new Date(t);
  const hour = d.getUTCHours();
  const yearDay = Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
  const field: Readonly<Record<string, () => string>> = {
    Y: () => String(d.getUTCFullYear()), y: () => pad(d.getUTCFullYear() % 100), m: () => pad(d.getUTCMonth() + 1),
    d: () => pad(d.getUTCDate()), e: () => String(d.getUTCDate()).padStart(2, ' '), b: () => MONTHS[d.getUTCMonth()]!.slice(0, 3),
    B: () => MONTHS[d.getUTCMonth()]!, a: () => DAYS[d.getUTCDay()]!.slice(0, 3), A: () => DAYS[d.getUTCDay()]!,
    H: () => pad(hour), I: () => pad(hour % 12 === 0 ? 12 : hour % 12), M: () => pad(d.getUTCMinutes()),
    S: () => pad(d.getUTCSeconds()), p: () => (hour < 12 ? 'AM' : 'PM'), j: () => pad(yearDay, 3), '%': () => '%',
  };
  return format.replace(/%(.)/g, (all, c: string) => field[c]?.() ?? all);
}
