import { PLAYHEAD_PARAM } from '../route/url';
import { readRouteParams, replaceRouteParams } from '../shell/useRoute';

export function formatSeconds(ms: number): string {
  const rounded = Math.round(ms) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

/** Ms from a seconds string, or null for anything but a finite number. An exponent is read, as `formatSeconds`
 *  writes one past 1e21 seconds. */
export function parseSeconds(text: string | null | undefined): number | null {
  if (text == null || !/^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(text)) return null;
  const ms = Math.round(Number(text) * 1000);
  return Number.isFinite(ms) ? ms : null;
}

/** The playhead the URL holds, in ms, or null. */
export function readPlayheadParam(): number | null {
  return parseSeconds(readRouteParams()[PLAYHEAD_PARAM]);
}

/** Holds `ms` in the URL, or drops it for null, in place. */
export function writePlayheadParam(ms: number | null): void {
  replaceRouteParams(({ [PLAYHEAD_PARAM]: _held, ...rest }) =>
    ms === null ? rest : { ...rest, [PLAYHEAD_PARAM]: formatSeconds(ms) },
  );
}
