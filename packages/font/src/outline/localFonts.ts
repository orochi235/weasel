/**
 * Local Font Access → outline registrations.
 *
 * The dynamic canvas-SDF tier can render any installed family without ever
 * seeing its bytes: it asks canvas 2D to `fillText` and takes the pixels. The
 * outline tier cannot — it needs the actual font file — and the only web API
 * that hands one over is `window.queryLocalFonts()`, which is Chromium-only
 * and gated behind a permission prompt that requires a user gesture.
 *
 * So this is the one part of the tier a consumer has to *ask* for, from a
 * click. Everything downstream treats a refusal as ordinary: no
 * registrations, `glyphOutline` keeps answering `null`, and large text keeps
 * rendering from the SDF tier exactly as it does today. That ladder is
 * load-bearing rather than defensive — Safari and Firefox have no equivalent
 * API at all, so "denied" is the permanent state for most of the web.
 *
 * Registration is eager but reading is lazy: every matching face gets a thunk
 * that calls `FontData.blob()` at first glyph request. A machine can easily
 * have hundreds of faces and a `.ttc` runs to tens of megabytes, so
 * downloading them all at enable time would be worse than not offering the
 * tier.
 */

import type { OutlineFontStyle } from './OutlineFace';
import { createOpenTypeParser } from './opentypeParser';
import { registerFontOutlines } from './outlineRegistry';

/**
 * The slice of the Local Font Access API this module uses. Declared here
 * rather than pulled from a lib: `queryLocalFonts` is not in TypeScript's DOM
 * types, and the alternative — casting `window` to `any` at the call site —
 * would lose the shape of what comes back.
 */
interface LocalFontData {
  postscriptName: string;
  fullName: string;
  family: string;
  style: string;
  blob(): Promise<Blob>;
}

type LocalFontWindow = typeof globalThis & {
  queryLocalFonts?: (opts?: { postscriptNames?: string[] }) => Promise<LocalFontData[]>;
};

/** Is the Local Font Access API present at all? False on every non-Chromium
 *  browser and in any non-secure context. */
export function canQueryLocalFonts(): boolean {
  return typeof globalThis !== 'undefined'
    && typeof (globalThis as LocalFontWindow).queryLocalFonts === 'function';
}

/**
 * CSS weights for the weight words that appear in a `style` string.
 *
 * Ordered longest-first where one name contains another ("ExtraBold" before
 * "Bold", "DemiBold" before "Bold"), because the match is a substring scan
 * and "Bold" would otherwise claim every heavier face for 700.
 */
const WEIGHT_WORDS: readonly (readonly [string, number])[] = [
  ['extrablack', 950], ['ultrablack', 950],
  ['extrabold', 800], ['ultrabold', 800],
  ['extralight', 200], ['ultralight', 200],
  ['semibold', 600], ['demibold', 600],
  ['semilight', 350],
  ['black', 900], ['heavy', 900],
  ['bold', 700],
  ['medium', 500],
  ['light', 300],
  ['thin', 100], ['hairline', 100],
  ['book', 400], ['regular', 400], ['normal', 400],
];

/**
 * Parse a `FontData.style` string — "Regular", "Bold Italic", "Condensed
 * ExtraLight Oblique" — into the CSS variant the kit's registry is keyed by.
 *
 * Anything unrecognized lands on 400/normal, which is what the string
 * "Regular" would have produced anyway. A wrong guess here costs a face that
 * registers under a variant nothing asks for; it cannot mis-paint anything,
 * because resolution is an exact-match lookup that simply misses.
 */
export function parseFontStyle(style: string): { weight: number; style: OutlineFontStyle } {
  const s = style.toLowerCase();
  const italic = s.includes('italic') || s.includes('oblique');
  const weight = WEIGHT_WORDS.find(([word]) => s.includes(word))?.[1] ?? 400;
  return { weight, style: italic ? 'italic' : 'normal' };
}

/**
 * How many words of a `FontData.style` string are *not* weight or slant —
 * "Condensed", "Display", "Poster". A face with none of them is the plain
 * member of its slot, and the one to keep when two faces collide.
 */
function styleQualifierCount(style: string): number {
  const words = style.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  return words.filter((w) => w !== 'italic' && w !== 'oblique'
    && !WEIGHT_WORDS.some(([word]) => word === w)).length;
}

/** Options for `registerLocalFontOutlines`. */
export interface LocalFontOutlinesOptions {
  /**
   * Restrict registration to these families. Defaults to every installed
   * family. Worth passing when the consumer already knows its font menu:
   * a machine with 900 faces otherwise gets 900 registry entries, all inert
   * but all held.
   */
  families?: readonly string[];
}

/** What `registerLocalFontOutlines` registered. */
export interface LocalFontOutlinesResult {
  /** Families that now have at least one outline face, in menu order. */
  families: readonly string[];
  /** Total faces registered across those families. */
  faces: number;
}

/**
 * Ask for permission to read installed fonts, and register outline sources
 * for the faces it returns. **Must be called from a user gesture** — the
 * permission prompt requires one, and without it the call rejects.
 *
 * Rejects when the API is missing or the user denies; both are ordinary
 * outcomes and neither leaves the registry in a partial state, so a caller
 * that simply ignores the rejection still has a working SDF tier.
 */
export async function enableLocalFontOutlines(
  opts: LocalFontOutlinesOptions = {},
): Promise<LocalFontOutlinesResult> {
  const query = (globalThis as LocalFontWindow).queryLocalFonts;
  if (typeof query !== 'function') {
    throw new Error(
      'weasel enableLocalFontOutlines: this browser has no Local Font Access API ' +
      '(queryLocalFonts). Large text keeps rendering from the SDF tier.',
    );
  }

  const wanted = opts.families ? new Set(opts.families) : null;
  const data = await query.call(globalThis);

  // Several installed faces can land on one (family, weight, style) slot —
  // "Helvetica Neue Condensed Bold" reduces to 700/normal exactly like
  // "Helvetica Neue Bold". Registering both left whichever `queryLocalFonts`
  // happened to return last, so a condensed face could paint at the upright
  // face's advances. Pick the least-qualified name for each slot instead.
  const chosen = new Map<string, { font: LocalFontData; qualifiers: number }>();
  for (const font of data) {
    if (wanted && !wanted.has(font.family)) continue;
    const { weight, style } = parseFontStyle(font.style);
    const key = `${font.family}|${weight}|${style}`;
    const qualifiers = styleQualifierCount(font.style);
    const prev = chosen.get(key);
    if (prev && prev.qualifiers <= qualifiers) continue;
    chosen.set(key, { font, qualifiers });
  }

  const families = new Set<string>();
  for (const { font } of chosen.values()) {
    registerFontOutlines(font.family, parseFontStyle(font.style), () => font.blob(), {
      // The PostScript name is how a member is picked out of a `.ttc`
      // collection, which is what most macOS system families ship as.
      parser: createOpenTypeParser(font.postscriptName),
    });
    families.add(font.family);
  }
  return {
    families: [...families].sort((a, b) => a.localeCompare(b)),
    faces: chosen.size,
  };
}
