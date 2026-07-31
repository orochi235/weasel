/**
 * The font menu.
 *
 * WeaselDraw ships exactly one baked MSDF atlas (Inter, as `sans-serif`).
 * Baking more would mean committing an atlas per family per weight and
 * carrying the redistribution rights for each — a lot of repository weight
 * for a drawing toy. The kit's dynamic tier makes that unnecessary: a family
 * enrolled with `registerCanvasFont` is rasterized to an SDF from whatever
 * the browser already has, on demand, glyph by glyph. Nothing is downloaded
 * and nothing is redistributed — we name families, we don't ship them.
 *
 * The cost is that availability is the *machine's* business, so this list is
 * a set of candidates rather than a promise. `document.fonts.check` settles
 * each one before it reaches the menu, which is why the picker never offers
 * a family that would silently render as something else.
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

/**
 * Deliberately mainstream: these are the families that ship with macOS,
 * Windows, or both, so the same document opens looking the same on either.
 * Breadth of *character* matters more than count here — a serif, a
 * typewriter, a poster face, and a couple of disreputable ones beat six
 * near-identical grotesques.
 */
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
 * Is `family` actually installed? `document.fonts.check` reports whether the
 * font would be used for the given specifier, so a missing family answers
 * `false` rather than quietly resolving to a default.
 *
 * The quoted family name matters: `check('16px Comic Sans MS')` is a parse
 * error for a multi-word name and throws, which would take out the whole
 * menu. Anything unexpected is read as "not available" — a font missing from
 * the menu is a small loss, a menu that fails to build is not.
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
 * after the baked atlas is registered.
 *
 * Returns the families enrolled, in menu order, for logging or a first-run
 * hint. The picker reads the same set back out of the registry via
 * `listCanvasFonts()` rather than from this return value — one source of
 * truth about what will render, and it stays right even if something else
 * enrolls a family later.
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

/* ------------------------------------------------------------------ */
/* Outlines for machine fonts                                          */
/* ------------------------------------------------------------------ */

/**
 * Upgrade the enrolled machine families from sampled distance fields to real
 * outlines.
 *
 * The dynamic tier above renders any installed family without ever seeing its
 * bytes — it asks canvas 2D to draw the glyph and takes the pixels. That is
 * what makes the font menu possible without shipping a single typeface, and
 * it is also its ceiling: the field is reconstructed from one 48px raster, so
 * magnifying it past a few times that size shows the raster as rippling
 * contours. Reading the font file fixes it exactly, and the only web API that
 * hands one over is `queryLocalFonts` — Chromium-only, and gated behind a
 * permission the user has to grant from a gesture.
 *
 * Scoped to the families already in the menu rather than everything
 * installed: a machine can carry hundreds of faces, and registering all of
 * them would hold hundreds of inert entries to serve a list of eighteen.
 *
 * Resolves to the families that gained outlines. Rejects when the API is
 * absent or the user says no — both ordinary, and neither changes what
 * renders today.
 */
export async function enableMachineFontOutlines(): Promise<readonly string[]> {
  const families = listCanvasFonts().map((f) => f.family);
  const { families: enabled } = await enableLocalFontOutlines({ families });
  return enabled;
}

/** Drop the machine-font outline registrations, returning those families to
 *  the canvas-SDF tier. The bundled default face is untouched — it is
 *  registered from a file this app ships, not from the machine. */
export function disableMachineFontOutlines(): void {
  for (const { family } of listCanvasFonts()) {
    for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      for (const style of ['normal', 'italic'] as const) {
        unregisterFontOutlines(family, { weight, style });
      }
    }
  }
}
