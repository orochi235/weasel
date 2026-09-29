/**
 * The face the canvas draws, handed to DOM text.
 *
 * A family name means one thing to the registry and another to CSS: the kit
 * may draw `sans-serif` from a baked Inter atlas while a `font-family:
 * sans-serif` in the page resolves to Helvetica. Anything the DOM sets in
 * place of canvas text — the text edit overlay above all — asks here instead
 * of writing the name through. The answer names a private `FontFace` loaded
 * from the family's registered font file, with the family itself as fallback
 * while that loads.
 *
 * The font file is the one `registerFontOutlines` holds; that registry is the
 * kit's record of which faces have real bytes behind them. An atlas-only
 * family has none, so the DOM gets the browser's own face for the name and a
 * one-time warning says which registration would fix it.
 */

import type { FontStyle } from './fontStyle';
import { resolveFontVariant, type FontVariant } from './registerFont';
import { listFontOutlines, outlineCssSource } from './outline/outlineRegistry';

interface Loaded {
  /** What the face was built from, so a re-registration replaces it. */
  from: unknown;
  face: FontFace | null;
}

/** Private CSS family per registry family. */
const names = new Map<string, string>();
/** Faces added to `document.fonts`, keyed `family|weight|style`. */
const faces = new Map<string, Loaded>();
const warned = new Set<string>();

/**
 * The CSS `font-family` value that sets DOM text in the face the canvas draws
 * for `family` at this variant.
 *
 * - A family the canvas draws through the browser (`registerCanvasFont`, or
 *   the `'canvas'` fallback policy) comes back unchanged: the DOM already
 *   resolves the name to the same face.
 * - A family drawn from a baked atlas or from outlines comes back as a private
 *   face built from its `registerFontOutlines` file — every registered weight
 *   and style of it, so the browser picks and synthesizes within the family
 *   the way the canvas does — followed by `family` as the fallback.
 * - Under the `'substitute'` policy, the face is the substitute's.
 *
 * Starts loading the face on first call and never waits for it. Outside a
 * browser, `family` comes back unchanged.
 */
export function cssFontFamily(family: string, variant: FontVariant = {}): string {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
    return family;
  }
  const weight = variant.weight ?? 400;
  const style: FontStyle = variant.style ?? 'normal';
  const resolved = resolveFontVariant(family, weight, style);
  if (resolved.source === 'canvas') return family;

  const target = resolved.resolved.family;
  const variants = listFontOutlines().filter((f) => f.family === target && f.status !== 'failed');
  if (variants.length === 0) {
    if (resolved.entry && !warned.has(target)) {
      warned.add(target);
      console.warn(
        `weasel: "${target}" draws from a baked atlas with no font file registered, so DOM text ` +
        `in it (the text edit overlay) uses the browser's own "${family}" and will not match the ` +
        `canvas. Register the file the atlas was baked from: registerFontOutlines("${target}", …).`,
      );
    }
    return family;
  }

  let name = names.get(target);
  if (!name) {
    name = `weasel-face-${names.size}`;
    names.set(target, name);
  }
  for (const v of variants) ensureFace(name, v.family, v.weight, v.style);
  return `${JSON.stringify(name)}, ${family}`;
}

function ensureFace(name: string, family: string, weight: number, style: FontStyle): void {
  const key = `${family}|${weight}|${style}`;
  const css = outlineCssSource(family, weight, style);
  if (!css) return;
  const from = 'src' in css ? css.src : css.source;
  const have = faces.get(key);
  if (have?.from === from) return;
  if (have?.face) document.fonts.delete(have.face);

  const entry: Loaded = { from, face: null };
  faces.set(key, entry);
  // `swap`: while the file loads the overlay shows the fallback, never nothing.
  const descriptors: FontFaceDescriptors = { weight: String(weight), style, display: 'swap' };
  const add = (face: FontFace) => {
    if (faces.get(key) !== entry) return;
    entry.face = face;
    document.fonts.add(face);
    face.load().catch(() => {
      // The fallback in the stack keeps the text visible; say why it differs.
      console.warn(`weasel: could not load "${family}" (${weight}/${style}) for DOM text; ` +
        'the text edit overlay falls back to the browser\'s own face.');
    });
  };
  if ('src' in css) add(new FontFace(name, css.src, descriptors));
  else {
    css.bytes().then(
      (buf) => add(new FontFace(name, buf, descriptors)),
      () => {},
    );
  }
}

/** @internal Test seam — module state. */
export function _resetDomFacesForTests(): void {
  if (typeof document !== 'undefined' && document.fonts) {
    for (const { face } of faces.values()) if (face) document.fonts.delete(face);
  }
  names.clear();
  faces.clear();
  warned.clear();
}
