/**
 * Canonical inline-styling primitive for text nodes. A node's text is
 * either a plain `string` (treated as a single-run, default-styled fragment)
 * or `StyledRun[]` for rich content. `toRuns` is the funnel that normalizes
 * either form into the array shape used by the renderer.
 *
 * Every field except `text` is optional; missing fields fall back to the
 * node-level `TextStyle`. `bold`/`italic` are toggles; `fontWeight` is the
 * numeric weight `bold` is a preset over.
 */

import type { ScreenLength, Stroke, Fill } from '@weasel-js/paint';
import type { TextTransform } from './runs/textTransform';
import type { FontVariantCaps } from './runs/smallCaps';
import {
  difference, fittedMarkdown, flagsKey, longestMarker, markersByDelimiter, readDelimiters, toggle,
} from './runs/delimiterRuns';

/** A span of text with its own styling, as authored. Fields left absent
 *  inherit from the node's text style — this is the difference between a run
 *  and a fully resolved one. */
export interface StyledRun {
  text: string;
  /** Draw at weight 700. A preset over `fontWeight`, which wins when both
   *  are present. */
  bold?: boolean;
  /** Numeric weight, 100–900. Overrides the node's weight and `bold`. */
  fontWeight?: number;
  italic?: boolean;
  fontFamily?: string;
  /** World units, or `{ px }` for screen pixels — resolved against the view
   *  scale `resolveRuns` is given, like `TextStyle.fontSize`. */
  fontSize?: ScreenLength;
  /** This run's ink. `null` is no fill at all, leaving the glyphs to `stroke`
   *  alone; absent inherits the node's. */
  fill?: Fill | null;
  /** Outline over this run's glyphs. Overrides the node's own `data.stroke`;
   *  absent inherits it. Only painted on the outline tier. */
  stroke?: Stroke;
  /** World units, or `{ px }` for screen pixels. */
  letterSpacing?: ScreenLength;
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
   * overrides that half while leaving the other alone. The numbers are the
   * face's own `OS/2` script metrics, or {@link SCRIPT_METRICS} for a face
   * that states none — `scriptMetricsFor` answers which.
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
  /**
   * CSS `text-transform` for this run's display. The run's `text` stays as
   * authored — carets, selections and edits address it — and only what is
   * drawn changes. Overrides the node's own; `'none'` turns an inherited one
   * off.
   */
  textTransform?: TextTransform;
  /**
   * `'small-caps'` draws this run's lowercase letters as capitals at a
   * smaller size — synthesized, at the face's x-height over its cap height.
   * Like `textTransform`, only what is drawn changes. Overrides the node's
   * own; `'normal'` turns an inherited one off.
   */
  fontVariantCaps?: FontVariantCaps;
  /**
   * Degrees to turn each of this run's glyphs, clockwise, each about its own
   * pen on the baseline — SVG's `rotate` with one value for the run. The
   * glyphs keep their places along the line; only their angle changes. A
   * different angle per glyph is a run per glyph.
   */
  rotate?: number;
  /**
   * The run's language, as a BCP 47 tag (`'sr'`, `'ur-PK'`): a shaper draws
   * the face's forms for it, such as Serbian Cyrillic italics or Urdu digits.
   * Overrides the node's own; absent inherits it.
   */
  lang?: string;
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
 *
 * Markers are written where a flag changes, not around every run: the reader
 * toggles flags, so two runs sharing one would close and reopen it as a
 * single delimiter run (`*a**b*`), which reads as a different marker.
 * Markers written in a row on one delimiter fuse the same way, so a change
 * whose markers would read back as another is spelled some other way; where
 * the grammar has no spelling for it, the flags it cannot say there are dropped.
 */
export function runsToMarkdown(
  runs: readonly StyledRun[],
  grammar: RunGrammar = MARKDOWN_RUN_GRAMMAR,
): string {
  const chars = escapees(grammar);
  /** Active flags, in the order they were opened. */
  let open: RunFlag[] = [];
  let out = '';
  const cover = (flags: readonly RunFlag[]): RunMarker[] | null => {
    if (flags.length === 0) return [];
    const exact = grammar.markers.find((m) => sameFlags(new Set(flags), m.flags));
    if (exact) return [exact];
    const singles = flags.map((f) => grammar.markers.find((m) => m.flags.length === 1 && m.flags[0] === f));
    return singles.every((m) => m !== undefined) ? singles as RunMarker[] : null;
  };
  const spell = (markers: readonly RunMarker[]): string => markers.map((m) => m.delimiter.repeat(m.repeat)).join('');
  const byDelimiter = markersByDelimiter(grammar);
  /** Writes the markers for the change to `want`, unless they would read back as another change. */
  const moveTo = (want: ReadonlySet<RunFlag>): boolean => {
    const kept = open.filter((f) => want.has(f));
    const opening = [...want].filter((f) => !kept.includes(f));
    const close = cover(open.filter((f) => !want.has(f)).reverse());
    const reopen = cover(opening);
    // Only a marker spelling several flags at once says the change: close them all and open afresh.
    const text = close && reopen
      ? spell(close) + spell(reopen)
      : spell(cover([...open].reverse()) ?? []) + spell(cover([...want]) ?? []);
    const read = readDelimiters(text, byDelimiter);
    if (!read || flagsKey(read) !== flagsKey(difference(open, want))) return false;
    out += text;
    open = close && reopen ? [...kept, ...opening] : [...want];
    return true;
  };
  // An empty run would write its markers back to back, which read as a toggle.
  const shown = runs.filter((r) => r.text.length > 0);
  const wants = shown.map((r) => spelled(flagsOf(r, grammar), grammar));
  for (let i = 0; i < shown.length; i++) {
    // Markers on one delimiter written in a row fuse, and the run they make can read as another marker.
    if (!moveTo(wants[i]!)) return fittedMarkdown(shown.map((r) => escapeFor(r.text, chars)), wants, byDelimiter);
    out += escapeFor(shown[i]!.text, chars);
  }
  // Nothing follows the closing markers, so ones that would misread are left off.
  moveTo(new Set());
  return out;
}

/** `flags` less any the grammar can only spell in combination with others it
 *  does not hold: those are dropped, as no marker says them alone. */
function spelled(flags: Set<RunFlag>, grammar: RunGrammar): Set<RunFlag> {
  if (grammar.markers.some((m) => sameFlags(flags, m.flags))) return flags;
  return new Set([...flags].filter((f) => grammar.markers.some((m) => m.flags.length === 1 && m.flags[0] === f)));
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
  const byDelimiter = markersByDelimiter(grammar);

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
      // The longest marker the delimiter run can pay for; a run shorter than
      // every marker is text.
      const marker = longestMarker(markers, count);
      if (!marker) {
        buf += ch.repeat(count);
        i += count;
        continue;
      }
      flush();
      toggle(active, marker.flags);
      i += marker.repeat;
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return runs;
}
