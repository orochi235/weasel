/**
 * The font menu.
 *
 * WeaselDraw ships one baked MSDF atlas (Inter, as `sans-serif`). Every other
 * family is enrolled with `registerCanvasFont` and rasterized to an SDF from
 * whatever the browser already has — we name families, we don't ship them.
 * So this list is a set of candidates, each measured before it reaches the
 * menu. `document.fonts.check` cannot settle it: it answers true for a family
 * the FontFaceSet does not hold, installed or not.
 */

import {
  registerCanvasFont, listCanvasFonts,
  enableLocalFontOutlines, unregisterFontOutlines, listFontOutlines,
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

const PROBE_TEXT = 'mmmmmmmmmmlli WQ@#';
const PROBE_GENERICS = ['monospace', 'serif', 'sans-serif'] as const;

function probeContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null;
  }
}

function probeWidth(ctx: CanvasRenderingContext2D, font: string): number {
  ctx.font = font;
  return ctx.measureText(PROBE_TEXT).width;
}

/**
 * Is `family` actually installed? Text set in `"family", generic` measures as the generic alone when the family
 * is absent, so it is installed when it differs from any of the generics. Comparing against more than one covers
 * a family that is itself a generic's default (Helvetica as macOS's `sans-serif`). The name is quoted because an
 * unquoted multi-word name is an invalid font, which canvas ignores. Anything unexpected reads as "not available".
 */
function isInstalled(ctx: CanvasRenderingContext2D, baselines: readonly number[], family: string): boolean {
  try {
    return PROBE_GENERICS.some((generic, i) => probeWidth(ctx, `72px "${family}", ${generic}`) !== baselines[i]);
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
  const ctx = probeContext();
  if (!ctx) return [];
  let baselines: number[];
  try {
    baselines = PROBE_GENERICS.map((generic) => probeWidth(ctx, `72px ${generic}`));
  } catch {
    return [];
  }
  const enrolled: string[] = [];
  for (const { family } of CANDIDATES) {
    if (!isInstalled(ctx, baselines, family)) continue;
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
 *  the canvas-SDF tier: every face the registry holds for an enrolled family,
 *  at whatever weight the local-font indexer filed it (a Semilight face at 350,
 *  say). */
export function disableMachineFontOutlines(): void {
  const enrolled = new Set(listCanvasFonts().map((f) => f.family));
  for (const { family, weight, style } of listFontOutlines()) {
    if (enrolled.has(family)) unregisterFontOutlines(family, { weight, style });
  }
}
