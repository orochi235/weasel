/**
 * How a run grammar's delimiters read, shared by the run reader and writer: a
 * delimiter run is consumed longest marker first, and markers written back to
 * back on one delimiter fuse into one run that reads that way, so the writer
 * checks a change it spells by reading it back.
 */
import type { RunFlag, RunGrammar, RunMarker } from '../runs';

/** Each delimiter's markers, longest first. */
export function markersByDelimiter(grammar: RunGrammar): Map<string, RunMarker[]> {
  const out = new Map<string, RunMarker[]>();
  for (const m of grammar.markers) {
    const list = out.get(m.delimiter) ?? [];
    list.push(m);
    out.set(m.delimiter, list);
  }
  for (const list of out.values()) list.sort((a, b) => b.repeat - a.repeat);
  return out;
}

/** The marker a run of `count` delimiters opens with: the longest it can pay for, if any. */
export const longestMarker = (markers: readonly RunMarker[], count: number): RunMarker | undefined =>
  markers.find((m) => m.repeat <= count);

/** Toggle each of `flags` in `on`. */
export function toggle(on: Set<RunFlag>, flags: Iterable<RunFlag>): void {
  for (const f of flags) {
    if (on.has(f)) on.delete(f);
    else on.add(f);
  }
}

/** The flags a run of `count` of one delimiter toggles, read as the reader reads it; `null` when some of it
 *  is left over as text. */
function readRun(markers: readonly RunMarker[], count: number): Set<RunFlag> | null {
  const on = new Set<RunFlag>();
  while (count > 0) {
    const m = longestMarker(markers, count);
    if (!m) return null;
    toggle(on, m.flags);
    count -= m.repeat;
  }
  return on;
}

const key = (flags: ReadonlySet<RunFlag>): string => [...flags].sort().join('+');

/** Delimiters written in a row: their reading, or `null` when some are left over as text. */
export function readDelimiters(text: string, byDelimiter: ReadonlyMap<string, readonly RunMarker[]>): Set<RunFlag> | null {
  const on = new Set<RunFlag>();
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    let count = 0;
    while (text[i + count] === ch) count++;
    const read = readRun(byDelimiter.get(ch) ?? [], count);
    if (!read) return null;
    toggle(on, read);
    i += count;
  }
  return on;
}

/** Most delimiter runs one change is spelled with, when the obvious spelling misreads. */
const MAX_RUNS = 6;

/**
 * Every set of flags a change written in delimiters alone can toggle, each with
 * its shortest spelling: runs of one delimiter after another, no two in a row
 * on the same one, since those fuse into one.
 */
export function toggleSpellings(byDelimiter: ReadonlyMap<string, readonly RunMarker[]>): Map<string, { flags: Set<RunFlag>; text: string }> {
  const words: { delimiter: string; text: string; flags: Set<RunFlag> }[] = [];
  for (const [delimiter, markers] of byDelimiter) {
    const longest = markers[0]?.repeat ?? 0;
    for (let count = 1; count <= longest * 2; count++) {
      const flags = readRun(markers, count);
      if (flags && flags.size > 0) words.push({ delimiter, text: delimiter.repeat(count), flags });
    }
  }
  const found = new Map<string, { flags: Set<RunFlag>; text: string }>([['', { flags: new Set(), text: '' }]]);
  const seen = new Set<string>(['|']);
  let layer = [{ flags: new Set<RunFlag>(), text: '', last: '' }];
  for (let depth = 0; depth < MAX_RUNS && layer.length > 0; depth++) {
    const next: typeof layer = [];
    for (const state of layer) {
      for (const w of words) {
        if (w.delimiter === state.last) continue;
        const flags = new Set(state.flags);
        toggle(flags, w.flags);
        const k = key(flags);
        const text = state.text + w.text;
        const had = found.get(k);
        if (!had || text.length < had.text.length) found.set(k, { flags, text });
        if (seen.has(`${k}|${w.delimiter}`)) continue;
        seen.add(`${k}|${w.delimiter}`);
        next.push({ flags, text, last: w.delimiter });
      }
    }
    layer = next;
  }
  return found;
}

/** The flags `from` and `to` differ by. */
export function difference(from: Iterable<RunFlag>, to: Iterable<RunFlag>): Set<RunFlag> {
  const out = new Set(from);
  toggle(out, to);
  return out;
}

export { key as flagsKey };

/**
 * Escaped run texts with the flags each should wear, written in a grammar whose
 * markers fuse into misreadings: each change is spelled with delimiters that
 * read back as it, choosing the flags each run wears so that no run gains a
 * flag it lacks and as few as possible are dropped.
 */
export function fittedMarkdown(
  texts: readonly string[], wants: readonly ReadonlySet<RunFlag>[], byDelimiter: ReadonlyMap<string, readonly RunMarker[]>,
): string {
  const spellings = [...toggleSpellings(byDelimiter).values()];
  /** Per run, per flags worn, the least cost so far and how it got there. */
  type Step = { cost: number; flags: Set<RunFlag>; from: string; text: string };
  let layer = new Map<string, Step>([['', { cost: 0, flags: new Set(), from: '', text: '' }]]);
  const steps: Map<string, Step>[] = [];
  wants.forEach((want, i) => {
    const next = new Map<string, Step>();
    for (const [from, at] of layer) {
      for (const s of spellings) {
        const flags = difference(at.flags, s.flags);
        const extra = [...flags].filter((f) => !want.has(f)).length;
        const missing = [...want].filter((f) => !flags.has(f)).length;
        const cost = at.cost + (extra * 64 + missing) * texts[i]!.length;
        const k = key(flags);
        const had = next.get(k);
        if (!had || cost < had.cost || (cost === had.cost && s.text.length < had.text.length)) {
          next.set(k, { cost, flags, from, text: s.text });
        }
      }
    }
    steps.push(next);
    layer = next;
  });
  let k = '';
  let least = Infinity;
  for (const [at, step] of layer) if (step.cost < least) { least = step.cost; k = at; }
  const closing = toggleSpellings(byDelimiter).get(k);
  let out = closing?.text ?? '';
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]!.get(k)!;
    out = step.text + texts[i] + out;
    k = step.from;
  }
  return out;
}
