/**
 * Canonical inline-styling primitive for text nodes. A node's text is
 * either a plain `string` (treated as a single-run, default-styled fragment)
 * or `StyledRun[]` for rich content. `toRuns` is the funnel that normalizes
 * either form into the array shape used by the renderer.
 *
 * Every field except `text` is optional; missing fields fall back to the
 * node-level `TextStyle`. `bold`/`italic` are toggles; richer weight axes
 * (300/500/900) are out of scope for slice 1.
 */

import type { FillStyle, Stroke } from '@weasel-js/paint';

/** A span of text with its own styling, as authored. Fields left absent
 *  inherit from the node's text style — this is the difference between a run
 *  and a fully resolved one. */
export interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fill?: FillStyle;
  /** Outline over this run's glyphs. Overrides the node's own `data.stroke`;
   *  absent inherits it. Only painted on the outline tier. */
  stroke?: Stroke;
  letterSpacing?: number;
  underline?: boolean;
  strikethrough?: boolean;
  /** Draw a rule above this run's ascent. Additive over the node style. */
  overline?: boolean;
  /**
   * Set this run as a superscript or subscript — a raised or lowered baseline
   * and a smaller size together, which is the pair `<sup>` and `<sub>` imply.
   *
   * A preset over the two primitives below, not a third mechanism: it supplies
   * a `baselineShift` and a `fontScale`, and naming either of those directly
   * overrides that half while leaving the other alone. The numbers are in
   * {@link SCRIPT_METRICS}.
   *
   * There is no node-level counterpart. A whole text node set as a superscript
   * is a smaller node moved up, which the pose already says better.
   */
  script?: 'super' | 'sub';
  /**
   * Raise (positive) or lower (negative) this run off the line's shared
   * baseline, in ems of the *inherited* font size — so a run's rise does not
   * shrink along with the run when `fontScale` also applies.
   */
  baselineShift?: number;
  /**
   * Multiplier on the inherited font size. The relative counterpart to
   * `fontSize`, which pins an absolute size and wins over this when both are
   * present.
   */
  fontScale?: number;
}

/** Normalize the two accepted spellings of text content — a plain string or
 *  an array of runs — to runs. Throws on a run with no string `text`. */
export function toRuns(input: string | StyledRun[]): StyledRun[] {
  if (typeof input === 'string') {
    return input.length === 0 ? [] : [{ text: input }];
  }
  for (let i = 0; i < input.length; i++) {
    const r = input[i];
    if (typeof r?.text !== 'string') {
      throw new Error(`toRuns: run at index ${i} is missing string \`text\``);
    }
  }
  return input;
}

/** Concatenate runs, dropping all styling. */
export function runsToPlainText(runs: readonly StyledRun[]): string {
  let out = '';
  for (const r of runs) out += r.text;
  return out;
}

/** A run flag an inline marker can toggle. The additive style toggles on
 *  `StyledRun`; the valued fields (family, size, paint, `script`) have no
 *  inline spelling and are not addressable this way. */
export type RunFlag = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'overline';

/** One inline marker: a delimiter repeated `repeat` times, and the flags it
 *  turns on between its opening and closing occurrence. */
export interface RunMarker {
  delimiter: string;
  repeat: number;
  flags: readonly RunFlag[];
}

/**
 * The inline grammar `runsToMarkdown` writes and `markdownToRuns` reads.
 *
 * Markers sharing a delimiter are matched longest-first, which is what lets
 * `***` mean something other than `**` followed by `*`. A backslash escapes
 * any delimiter character and itself, in both directions.
 */
export interface RunGrammar {
  markers: readonly RunMarker[];
}

/**
 * The markdown subset the kit reads and writes: `**bold**`, `*italic*`,
 * `***both***`.
 *
 * Deliberately not the whole of markdown, and deliberately silent on
 * `underline` / `strikethrough` — the two run flags with no entry here are
 * dropped by `runsToMarkdown`, as they always have been. A grammar that wants
 * `~~struck~~` adds one marker; nothing else has to change.
 */
export const MARKDOWN_RUN_GRAMMAR: RunGrammar = {
  markers: [
    { delimiter: '*', repeat: 3, flags: ['bold', 'italic'] },
    { delimiter: '*', repeat: 2, flags: ['bold'] },
    { delimiter: '*', repeat: 1, flags: ['italic'] },
  ],
};

/** Delimiter characters of a grammar, plus the backslash that escapes them. */
function escapees(grammar: RunGrammar): Set<string> {
  const out = new Set<string>(['\\']);
  for (const m of grammar.markers) out.add(m.delimiter);
  return out;
}

function escapeFor(text: string, chars: ReadonlySet<string>): string {
  let out = '';
  for (const ch of text) out += chars.has(ch) ? `\\${ch}` : ch;
  return out;
}

/** The flags a run turns on, in the grammar's own marker order so two runs
 *  with the same flags always serialize identically. */
function flagsOf(run: StyledRun, grammar: RunGrammar): Set<RunFlag> {
  const on = new Set<RunFlag>();
  for (const m of grammar.markers) {
    for (const f of m.flags) if (run[f]) on.add(f);
  }
  return on;
}

function sameFlags(a: ReadonlySet<RunFlag>, b: readonly RunFlag[]): boolean {
  return a.size === b.length && b.every((f) => a.has(f));
}

/**
 * Render runs in `grammar`, defaulting to the markdown subset. The flavor
 * written to the clipboard alongside the plain-text one.
 *
 * A run whose flags exactly match one marker takes it; otherwise the markers
 * that cover them nest. Flags no marker spells are dropped — the text still
 * round-trips, without that styling.
 */
export function runsToMarkdown(
  runs: readonly StyledRun[],
  grammar: RunGrammar = MARKDOWN_RUN_GRAMMAR,
): string {
  const chars = escapees(grammar);
  let out = '';
  for (const r of runs) {
    const escaped = escapeFor(r.text, chars);
    const on = flagsOf(r, grammar);
    if (on.size === 0) { out += escaped; continue; }

    const exact = grammar.markers.find((m) => sameFlags(on, m.flags));
    if (exact) {
      const d = exact.delimiter.repeat(exact.repeat);
      out += `${d}${escaped}${d}`;
      continue;
    }
    // No single marker says all of it: nest the ones that each say part.
    const covering = grammar.markers.filter(
      (m) => m.flags.length === 1 && on.has(m.flags[0]),
    );
    const open = covering.map((m) => m.delimiter.repeat(m.repeat)).join('');
    const close = [...covering].reverse().map((m) => m.delimiter.repeat(m.repeat)).join('');
    out += `${open}${escaped}${close}`;
  }
  return out;
}

/**
 * Parse `input` in `grammar`, defaulting to the markdown subset, into styled
 * runs. Newlines are preserved as literal characters inside a run — they are
 * not run-boundary markers in this format.
 */
export function markdownToRuns(
  input: string,
  grammar: RunGrammar = MARKDOWN_RUN_GRAMMAR,
): StyledRun[] {
  const chars = escapees(grammar);
  // Longest-first per delimiter, so `***` is tried before `**` before `*`.
  const byDelimiter = new Map<string, RunMarker[]>();
  for (const m of grammar.markers) {
    const list = byDelimiter.get(m.delimiter) ?? [];
    list.push(m);
    byDelimiter.set(m.delimiter, list);
  }
  for (const list of byDelimiter.values()) list.sort((a, b) => b.repeat - a.repeat);

  const runs: StyledRun[] = [];
  const active = new Set<RunFlag>();
  let buf = '';
  let i = 0;

  function flush(): void {
    if (buf.length === 0) return;
    const run: StyledRun = { text: buf };
    for (const f of active) run[f] = true;
    runs.push(run);
    buf = '';
  }

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\' && i + 1 < input.length && chars.has(input[i + 1])) {
      buf += input[i + 1];
      i += 2;
      continue;
    }

    const markers = byDelimiter.get(ch);
    if (markers) {
      let count = 0;
      while (i + count < input.length && input[i + count] === ch) count++;
      // The longest marker the delimiter run can pay for. A run shorter than
      // every marker still matches the shortest, which is how a lone `*`
      // toggles italic where `***` toggles both.
      const marker = markers.find((m) => m.repeat <= count) ?? markers[markers.length - 1];
      flush();
      for (const f of marker.flags) {
        if (active.has(f)) active.delete(f);
        else active.add(f);
      }
      i += marker.repeat;
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return runs;
}
