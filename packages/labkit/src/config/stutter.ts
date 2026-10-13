import type { ResolvedConfig } from './types';

/**
 * Whether a row's label only repeats the heading above it: the same word, or
 * one word grown from the other, as "Pump" under "Pumping". Such a row is a
 * heading with a control, written as a heading over a row.
 */
export function stutters(heading: string, label: string): boolean {
  const h = heading.trim().toLowerCase();
  const l = label.trim().toLowerCase();
  if (h === '' || l === '') return false;
  if (h === l) return true;
  if (/\s/.test(h) || /\s/.test(l)) return false;
  const [short, long] = h.length < l.length ? [h, l] : [l, h];
  return short.length >= 3 && long.startsWith(short);
}

const warned = new WeakMap<ResolvedConfig, Set<string>>();

/** Warn of an authoring fault in `resolved` once per `key`, whichever surface meets it first. */
export function warnOnce(resolved: ResolvedConfig, key: string, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const seen = warned.get(resolved) ?? new Set<string>();
  warned.set(resolved, seen);
  if (seen.has(key)) return;
  seen.add(key);
  console.warn(`[labkit] ${message}`);
}

/** Warn of the row at `path`, named `label`, repeating `heading`. `lifted` says the surface draws it in the
 *  heading instead, which only one with room for a control there does. */
export function warnOfStutter(
  resolved: ResolvedConfig,
  heading: string,
  path: string,
  label: string,
  lifted: boolean,
): void {
  warnOnce(
    resolved,
    `${heading}|${path}`,
    lifted
      ? `"${label}" (${path}) repeats its heading "${heading}". It is drawn in the heading instead; mark it .heading() to say so, or give it a label of its own.`
      : `"${label}" (${path}) repeats its heading "${heading}". Give it a label of its own.`,
  );
}
