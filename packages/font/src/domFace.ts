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
import {
  listFontOutlines, outlineCssSource, onOutlineBytes, type OutlineFaceInfo,
} from './outline/outlineRegistry';

interface Loaded {
  /** The registration the face was built from, so a re-registration replaces it. */
  from: OutlineFaceInfo;
  face: FontFace | null;
  /** Settles once the face has loaded or failed; `settled` says it has. */
  done: Promise<void>;
  settled: boolean;
}

/** Private CSS family per registry family. */
const names = new Map<string, string>();
/** Faces added to `document.fonts`, keyed `family|weight|style`. */
const faces = new Map<string, Loaded>();
const warned = new Set<string>();

function domFonts(): boolean {
  return typeof FontFace !== 'undefined' && typeof document !== 'undefined' && !!document.fonts;
}

function nameFor(family: string): string {
  let name = names.get(family);
  if (!name) {
    name = `weasel-face-${names.size}`;
    names.set(family, name);
  }
  return name;
}

// Bytes already in hand make the DOM face too, so an edit opening later finds
// it loaded instead of starting the load itself.
onOutlineBytes((registration, bytes) => {
  if (!domFonts()) return;
  const { family, weight, style } = registration;
  ensureFace(nameFor(family), family, weight, style, bytes);
});

/**
 * The outline family and registered variants DOM text in `family` is set in,
 * or `null` when the DOM should use `family` as it stands.
 */
function privateFamily(family: string, variant: FontVariant): {
  target: string; variants: readonly OutlineFaceInfo[];
} | null {
  if (!domFonts()) return null;
  const resolved = resolveFontVariant(family, variant.weight ?? 400, variant.style ?? 'normal');
  if (resolved.source === 'canvas') return null;
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
    return null;
  }
  return { target, variants };
}

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
 * Starts loading the face on first call and never waits for it; ask
 * {@link cssFontFamilyLoading} for that. A face whose bytes arrived earlier —
 * passed to `registerFontOutlines` as an `ArrayBuffer`, or read for the canvas
 * — was built when they did. Outside a browser, `family` comes back unchanged.
 */
export function cssFontFamily(family: string, variant: FontVariant = {}): string {
  const priv = privateFamily(family, variant);
  if (!priv) return family;
  const name = nameFor(priv.target);
  for (const v of priv.variants) ensureFace(name, v.family, v.weight, v.style);
  return `${JSON.stringify(name)}, ${family}`;
}

/**
 * The load still in flight for the face {@link cssFontFamily} names for
 * `family` at this variant, or `null` when there is nothing to wait for: it
 * has loaded or failed, or the DOM uses `family` as it stands. Waits on the
 * variant's own face when one is registered and on the whole family
 * otherwise, since the browser then picks among them. Starts the load like
 * `cssFontFamily` does, and never rejects.
 *
 * `null` rather than a settled promise, so a caller whose face is loaded goes
 * on in the same task instead of a microtask later.
 */
export function cssFontFamilyLoading(
  family: string, variant: FontVariant = {},
): Promise<void> | null {
  const priv = privateFamily(family, variant);
  if (!priv) return null;
  const name = nameFor(priv.target);
  for (const v of priv.variants) ensureFace(name, v.family, v.weight, v.style);
  const weight = variant.weight ?? 400;
  const style = variant.style ?? 'normal';
  const exact = priv.variants.filter((v) => v.weight === weight && v.style === style);
  const pending = (exact.length > 0 ? exact : priv.variants)
    .map((v) => faces.get(`${v.family}|${v.weight}|${v.style}`))
    .filter((l): l is Loaded => l !== undefined && !l.settled)
    .map((l) => l.done);
  return pending.length === 0 ? null : Promise.all(pending).then(() => {});
}

function ensureFace(
  name: string, family: string, weight: number, style: FontStyle, bytes?: ArrayBuffer,
): void {
  const key = `${family}|${weight}|${style}`;
  const css = outlineCssSource(family, weight, style);
  if (!css) return;
  const have = faces.get(key);
  if (have?.from === css.registration) return;
  if (have?.face) document.fonts.delete(have.face);

  let settle!: () => void;
  const entry: Loaded = {
    from: css.registration, face: null, settled: false,
    done: new Promise<void>((r) => { settle = r; }),
  };
  const finish = () => {
    entry.settled = true;
    settle();
  };
  faces.set(key, entry);
  // `swap`: once the overlay's hold runs out it shows the fallback, never nothing.
  const descriptors: FontFaceDescriptors = { weight: String(weight), style, display: 'swap' };
  const add = (face: FontFace) => {
    if (faces.get(key) !== entry) return finish();
    entry.face = face;
    document.fonts.add(face);
    face.load().then(finish, () => {
      finish();
      // The fallback in the stack keeps the text visible; say why it differs.
      console.warn(`weasel: could not load "${family}" (${weight}/${style}) for DOM text; ` +
        'the text edit overlay falls back to the browser\'s own face.');
    });
  };
  if ('src' in css) add(new FontFace(name, css.src, descriptors));
  // Bytes in hand spare the browser fetching the same URL a second time.
  else if (bytes !== undefined) add(new FontFace(name, bytes, descriptors));
  else if ('url' in css) add(new FontFace(name, css.url, descriptors));
  else css.bytes().then((buf) => add(new FontFace(name, buf, descriptors)), finish);
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
