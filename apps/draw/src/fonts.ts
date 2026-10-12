/**
 * The font menu.
 *
 * WeaselDraw ships one baked MSDF atlas (Inter, as `sans-serif`). Every other
 * family is enrolled with `registerCanvasFont` and rasterized to an SDF from
 * whatever the browser already has — we name families, we don't ship them.
 * So this list is a set of candidates: `document.fonts.check` settles each one
 * before it reaches the menu.
 */

import {
  registerCanvasFont, listCanvasFonts,
  enableLocalFontOutlines, unregisterFontOutlines,
} from '@weasel-js/font';

/** A candidate family and the generic it falls back to if absent. */
interface FontCandidate {
  family: string;
  /** Grouping for the menu, and the CSS generic used in the probe. */
  genre: 'sans' | 'serif' | 'mono' | 'display' | 'script';
}

/** Deliberately mainstream: the families that ship with macOS, Windows, or both. */
const CANDIDATES: readonly FontCandidate[] = [
  // Sans — Inter is already registered as the baked default `sans-serif`.
  { family: 'Helvetica', genre: 'sans' },
  { family: 'Arial', genre: 'sans' },
  { family: 'Verdana', genre: 'sans' },
  { family: 'Trebuchet MS', genre: 'sans' },
  { family: 'Futura', genre: 'sans' },
  // Serif
  { family: 'Georgia', genre: 'serif' },
  { family: 'Times New Roman', genre: 'serif' },
  { family: 'Palatino', genre: 'serif' },
  { family: 'Baskerville', genre: 'serif' },
  // Mono
  { family: 'Courier New', genre: 'mono' },
  { family: 'Menlo', genre: 'mono' },
  { family: 'Consolas', genre: 'mono' },
  // Display
  { family: 'Impact', genre: 'display' },
  { family: 'Copperplate', genre: 'display' },
  { family: 'Papyrus', genre: 'display' },
  // Script
  { family: 'Brush Script MT', genre: 'script' },
  { family: 'Comic Sans MS', genre: 'script' },
  { family: 'Chalkboard SE', genre: 'script' },
];

/**
 * Is `family` actually installed?
 *
 * The quoted family name matters: `check('16px Comic Sans MS')` is a parse
 * error for a multi-word name and throws, which would take out the whole
 * menu. Anything unexpected is read as "not available".
 */
function isInstalled(family: string): boolean {
  if (typeof document === 'undefined' || !document.fonts?.check) return false;
  try {
    return document.fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}

/**
 * Enroll every candidate the machine actually has. Call once at startup,
 * after the baked atlas is registered. Returns the families enrolled, in menu
 * order; the picker reads the set from `listCanvasFonts()` instead.
 */
export function registerAvailableFonts(): string[] {
  const enrolled: string[] = [];
  for (const { family } of CANDIDATES) {
    if (!isInstalled(family)) continue;
    registerCanvasFont(family);
    enrolled.push(family);
  }
  return enrolled;
}

/** Genre of a candidate family, for menu grouping. `undefined` for anything
 *  not in the candidate list (a baked family, or a document's own value). */
export function genreOf(family: string): FontCandidate['genre'] | undefined {
  return CANDIDATES.find((c) => c.family === family)?.genre;
}

/**
 * Upgrade the enrolled machine families from sampled distance fields to real
 * outlines, read from the font files through `queryLocalFonts` — Chromium-only,
 * and gated behind a permission the user has to grant from a gesture. Scoped to
 * the families already in the menu rather than everything installed.
 *
 * Resolves to the families that gained outlines. Rejects when the API is
 * absent or the user says no.
 */
export async function enableMachineFontOutlines(): Promise<readonly string[]> {
  const families = listCanvasFonts().map((f) => f.family);
  const { families: enabled } = await enableLocalFontOutlines({ families });
  return enabled;
}

/** Drop the machine-font outline registrations, returning those families to
 *  the canvas-SDF tier. */
export function disableMachineFontOutlines(): void {
  for (const { family } of listCanvasFonts()) {
    for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      for (const style of ['normal', 'italic'] as const) {
        unregisterFontOutlines(family, { weight, style });
      }
    }
  }
}
