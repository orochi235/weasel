/**
 * Cutting text where its script changes. HarfBuzz shapes a buffer as one
 * script in one direction, so a run mixing Latin and Arabic is shaped a piece
 * at a time.
 */

/** The scripts a run is cut between. Any other script is one more piece,
 *  shaped as whichever script HarfBuzz guesses from its first letter. */
const NAMES = [
  'Latin', 'Greek', 'Cyrillic', 'Armenian', 'Hebrew', 'Arabic', 'Syriac', 'Thaana', 'Nko',
  'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada',
  'Malayalam', 'Sinhala', 'Thai', 'Lao', 'Tibetan', 'Myanmar', 'Georgian', 'Hangul', 'Ethiopic',
  'Khmer', 'Mongolian', 'Han', 'Hiragana', 'Katakana', 'Adlam', 'Javanese', 'Balinese',
];
const SCRIPTS: readonly RegExp[] = NAMES.map((name) => new RegExp(`^\\p{Script=${name}}$`, 'u'));

/** Which of them read right to left. */
const RTL_NAMES = new Set(['Hebrew', 'Arabic', 'Syriac', 'Thaana', 'Nko', 'Adlam']);

/** Characters every script shares, which join the piece around them. */
const SHARED = /^[\p{Script=Common}\p{Script=Inherited}]$/u;

const OTHER = SCRIPTS.length;
const NONE = -1;

function scriptOf(ch: string): number {
  if (SHARED.test(ch)) return NONE;
  const cp = ch.codePointAt(0)!;
  // Most text is Latin, and the Latin letters below U+0250 are all it holds there.
  if (cp < 0x250) return 0;
  for (let i = 0; i < SCRIPTS.length; i++) if (SCRIPTS[i].test(ch)) return i;
  return OTHER;
}

/** One stretch of text in a single script. */
export interface ScriptPiece {
  start: number;
  end: number;
  /** Whether the script reads right to left, which HarfBuzz shapes it in. */
  rtl: boolean;
}

/** Blocks whose scripts read right to left, for a script not named above. */
const RTL_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x0590, 0x08ff], [0xfb1d, 0xfdff], [0xfe70, 0xfeff], [0x10800, 0x10fff], [0x1e800, 0x1efff],
];

/**
 * `text` cut where its script changes, as UTF-16 spans covering all of it. A
 * character every script shares stays in the piece before it, or the one
 * after it when it opens the text. Empty text has no pieces.
 */
export function scriptPieces(text: string): ScriptPiece[] {
  const pieces: ScriptPiece[] = [];
  let current = NONE;
  let start = 0;
  let rtl = false;
  let at = 0;
  for (const ch of text) {
    const script = scriptOf(ch);
    if (script !== NONE) {
      if (current !== NONE && script !== current) {
        pieces.push({ start, end: at, rtl });
        start = at;
      }
      if (script !== current) rtl = isRtl(script, ch.codePointAt(0)!);
      current = script;
    }
    at += ch.length;
  }
  if (at > start) pieces.push({ start, end: at, rtl });
  return pieces;
}

function isRtl(script: number, cp: number): boolean {
  if (script !== OTHER) return RTL_NAMES.has(NAMES[script]);
  return RTL_BLOCKS.some(([lo, hi]) => cp >= lo && cp <= hi);
}
