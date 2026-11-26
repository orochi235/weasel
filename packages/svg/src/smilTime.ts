/**
 * SMIL timing as an SVG animation element writes it: clock values, and `begin` / `end` lists whose
 * entries are offsets or another animation's begin or end.
 */

const UNIT_MS: Record<string, number> = { h: 3_600_000, min: 60_000, s: 1000, ms: 1 };

/** A SMIL clock value in ms: `02:30:03`, `01:02.5`, `3.2h`, `45min`, `30s`, `5ms` or `12.467` (seconds).
 *  Null for anything else. */
export function clockValue(raw: string): number | null {
  const s = raw.trim();
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/.exec(s);
  if (clock) {
    const [, h, m, sec] = clock;
    return ((h ? Number(h) * 60 : 0) + Number(m)) * 60_000 + Number(sec) * 1000;
  }
  const count = /^(\d+(?:\.\d+)?|\.\d+)(h|min|s|ms)?$/.exec(s);
  return count ? Number(count[1]) * UNIT_MS[count[2] ?? 's'] : null;
}

/** One entry of a `begin` or `end` list: a time on the document's clock, or the begin or end of
 *  the animation `id`, offset. */
export type TimeRef =
  | { kind: 'offset'; ms: number }
  | { kind: 'sync'; id: string; edge: 'begin' | 'end'; ms: number }
  | { kind: 'other'; raw: string };

/** A `begin` or `end` attribute's entries. Events, `repeat(n)`, access keys, wallclock times and
 *  `indefinite` come back as `other`. */
export function timeList(raw: string): TimeRef[] {
  return raw.split(';').map((part) => part.trim()).filter(Boolean).map(timeRef);
}

function timeRef(s: string): TimeRef {
  const signed = /^([+-])?\s*(.+)$/.exec(s);
  const plain = signed ? clockValue(signed[2]) : null;
  if (plain !== null) return { kind: 'offset', ms: signed![1] === '-' ? -plain : plain };
  const sync = /^((?:[^.\\]|\\.)+)\.(begin|end)\s*(?:([+-])\s*(.+))?$/.exec(s);
  if (sync) {
    const off = sync[4] === undefined ? 0 : clockValue(sync[4]);
    if (off !== null) {
      return { kind: 'sync', id: sync[1].replace(/\\(.)/g, '$1'), edge: sync[2] as 'begin' | 'end', ms: sync[3] === '-' ? -off : off };
    }
  }
  return { kind: 'other', raw: s };
}
