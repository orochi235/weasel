import { PLAYHEAD_PARAM } from '../route/url';
import { readRoute, readRouteParams, replaceRouteParams } from '../shell/useRoute';

export function formatSeconds(ms: number): string {
  const rounded = Math.round(ms) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

/** Ms from a seconds string, or null for anything but a finite number. */
export function parseSeconds(text: string | null | undefined): number | null {
  if (text == null || !/^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(text)) return null;
  return Math.round(Number(text) * 1000);
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

/** The playhead a URL opened on `storyId` holds: `t`, when the route names that story; otherwise null. */
export function initialPlayhead(storyId: string): number | null {
  return readRoute() === storyId ? readPlayheadParam() : null;
}
