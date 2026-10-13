/**
 * The outline tier's registry: which faces have real font bytes behind them,
 * and what a given glyph looks like.
 *
 * ### What this tier is for
 *
 * A distance field is a *sampled* representation: the dynamic canvas-SDF tier
 * (`../dynamic/`) reconstructs its field from a 48px raster, so magnifying it
 * past a few times the bake size exposes the raster as contour wobble. Above a
 * size threshold the glyph's outline goes to the path renderer instead, which
 * is exact at every zoom and takes strokes and non-solid fills.
 *
 * Below the threshold the atlas still wins: outlines carry no hinting and no
 * stem darkening, so body text at 12–16px rendered from them looks *worse*
 * than a platform rasterizer that puts stems on the pixel grid.
 *
 * ### Metric neutrality (the load-bearing invariant)
 *
 * This tier replaces how a glyph is *painted*, never where it sits. Advances,
 * kerning, line breaking, and baselines all keep coming from whichever tier
 * resolved the run, so zooming past the threshold cannot reflow text. The cost
 * is that a face whose real advances disagree with the atlas's inherits the
 * atlas's.
 *
 * ### Availability
 *
 * Bytes arrive asynchronously, and in the local case behind a permission the
 * user can refuse, so `glyphOutline` answers `null` until a face is loaded and
 * forever if it failed, and the caller falls back to SDF. A family must never
 * render *nothing* because the outline tier could not get bytes.
 */

import { createReflectable, type Reflection } from '@weasel-js/registry';
import { notifyGlyphReady } from '../glyphReady';
import type { OutlineFace, OutlineParser } from './OutlineFace';
import type { FontStyle } from '../fontStyle';
import { openTypeParser } from './opentypeParser';

/**
 * Where a face's bytes come from. A URL is fetched; a buffer or blob is used
 * as-is; a thunk is called at first use.
 */
export type OutlineSource =
  | string
  | ArrayBuffer
  | Blob
  | (() => ArrayBuffer | Blob | Promise<ArrayBuffer | Blob>);

/** Which face within a family to register outlines for. Defaults to weight
 *  400, style `'normal'`. */
export interface OutlineVariant {
  weight?: number;
  style?: FontStyle;
}

/** Options for registering an outline font. */
export interface OutlineFontOptions {
  /** Override the default opentype.js parser. Mostly a test seam; also the
   *  hook for a consumer who already has a font parser in their bundle. */
  parser?: OutlineParser;
  /**
   * The `@font-face` `src` that gives DOM text this face — what the text edit
   * overlay sets its glyphs in, so they match the canvas's. Defaults to
   * `url(…)` of a URL source and to the bytes themselves otherwise; a face
   * whose bytes the browser cannot load directly, such as one member of a
   * `.ttc`, names it here instead (`local("Helvetica-Bold")`).
   */
  cssSrc?: string;
}

/** Load state of one registered face. */
export type OutlineStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** One registered outline face and its load state. */
export interface OutlineFaceInfo {
  readonly family: string;
  readonly weight: number;
  readonly style: FontStyle;
  readonly status: OutlineStatus;
}

interface FaceSlot extends OutlineFaceInfo {
  source: OutlineSource;
  cssSrc: string | undefined;
  parser: OutlineParser;
  status: OutlineStatus;
  face: OutlineFace | null;
  /** Memoized `glyphD` answers, including the `null` misses — a codepoint the
   *  face lacks is asked for on every frame that draws it. */
  glyphs: Map<number, string | null>;
  /** The in-flight or settled load, so every caller waiting on it shares one parse. */
  load: Promise<void> | null;
}

const slots = createReflectable<FaceSlot>();

/** Every registered outline face, keyed `family|weight|style`. */
export const fontOutlineRegistry: Reflection<OutlineFaceInfo> = slots.reflection;

function slotKey(family: string, weight: number, style: FontStyle): string {
  return `${family}|${weight}|${style}`;
}

function normalize(v: OutlineVariant): { weight: number; style: FontStyle } {
  return { weight: v.weight ?? 400, style: v.style ?? 'normal' };
}

/**
 * Register font file bytes for one face, so text set in it can render from
 * outlines above the size threshold.
 *
 * Registration is cheap and synchronous: nothing is fetched, and the parser
 * is not even imported, until a frame actually asks for a glyph from this
 * face.
 *
 * The variant must match exactly what the layout tier resolved — this is
 * deliberately *not* a fallback chain. Painting 400-weight outlines at
 * 700-weight advances looks worse than the SDF it replaced; a miss falls back
 * to SDF instead.
 */
export function registerFontOutlines(
  family: string,
  variant: OutlineVariant,
  source: OutlineSource,
  opts: OutlineFontOptions = {},
): void {
  const { weight, style } = normalize(variant);
  slots.set(slotKey(family, weight, style), {
    family, weight, style, source,
    cssSrc: opts.cssSrc,
    parser: opts.parser ?? openTypeParser,
    status: 'idle',
    face: null,
    glyphs: new Map(),
    load: null,
  });
  // Layouts cache which tier each run resolved to and poll `glyphGeneration()`
  // to know when to drop it; a registration that leaves it still is invisible.
  notifyGlyphReady();
  if (source instanceof ArrayBuffer) announceBytes(slots.get(slotKey(family, weight, style))!, source);
}

/** Drop a registration. Glyphs already handed out stay valid — they are
 *  plain path data — but nothing further resolves from this face. */
export function unregisterFontOutlines(family: string, variant: OutlineVariant = {}): void {
  const { weight, style } = normalize(variant);
  // Only when something was actually dropped: a miss must not invalidate any layout.
  if (slots.delete(slotKey(family, weight, style))) notifyGlyphReady();
}

/**
 * Is an outline face registered for this exact variant? Answers `true` while
 * the bytes are still loading; use `outlineStatus` for "can it right now".
 */
export function hasFontOutlines(
  family: string, weight = 400, style: FontStyle = 'normal',
): boolean {
  return slots.has(slotKey(family, weight, style));
}

/** Load state of a registered face; `null` when nothing is registered. */
export function outlineStatus(
  family: string, weight = 400, style: FontStyle = 'normal',
): OutlineStatus | null {
  return slots.get(slotKey(family, weight, style))?.status ?? null;
}

/** Every registered outline face and its load state — the enumeration a
 *  debug overlay or font picker needs, mirroring `listFonts`. */
export function listFontOutlines(): readonly OutlineFaceInfo[] {
  return slots.entries()
    .map(({ value: { family, weight, style, status } }) => ({ family, weight, style, status }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.weight - b.weight
      || a.style.localeCompare(b.style));
}

/**
 * Close every contour of a glyph's path data.
 *
 * A glyph contour is closed by definition, but not every serializer writes
 * the `Z` that says so, and the omission is invisible until someone *strokes*
 * the outline: a fill closes the contour implicitly, while a stroke leaves the
 * closing edge unpainted, with a cap at each loose end. Normalized here rather
 * than in one parser so it covers every consumer-supplied `OutlineParser`.
 */
export function closeContours(d: string): string {
  let out = '';
  let start = 0;
  for (let i = 1; i < d.length; i++) {
    const c = d[i];
    if (c !== 'M' && c !== 'm') continue;
    out += closeOne(d.slice(start, i));
    start = i;
  }
  return out + closeOne(d.slice(start));
}

function closeOne(contour: string): string {
  const trimmed = contour.trimEnd();
  if (trimmed.length === 0) return '';
  const last = trimmed[trimmed.length - 1];
  return last === 'Z' || last === 'z' ? trimmed : `${trimmed}Z`;
}

/**
 * Em-space SVG path data for one glyph of a registered outline face, or `null`
 * when this tier cannot serve it — no registration, bytes still loading, load
 * failed, no such glyph, or a glyph with no contours.
 *
 * Synchronous and non-throwing: a face that has not been parsed yet starts
 * loading and answers `null` for now, so a renderer can call this every frame
 * and fall through to another text tier until the outline arrives.
 */
export function glyphOutline(
  family: string,
  weight: number,
  style: FontStyle,
  cp: number,
): string | null {
  const slot = slots.get(slotKey(family, weight, style));
  if (!slot) return null;
  if (slot.status === 'idle') {
    void beginLoad(slot);
    return null;
  }
  if (slot.status !== 'ready') return null;

  const cached = slot.glyphs.get(cp);
  if (cached !== undefined) return cached;
  let d: string | null = null;
  try {
    const raw = slot.face!.glyphD(cp);
    d = raw === null ? null : closeContours(raw);
  } catch (err) {
    // A parser that throws on one glyph should cost that glyph, not the face.
    warnOnce(`glyph|${slotKey(family, weight, style)}`,
      `weasel: outline face "${family}" (${weight}/${style}) could not produce a glyph ` +
      `for U+${cp.toString(16).toUpperCase().padStart(4, '0')} — ` +
      `${err instanceof Error ? err.message : String(err)}. Falling back to the SDF tier.`);
  }
  slot.glyphs.set(cp, d);
  return d;
}

/**
 * Metrics for a registered outline face, or `null` when this tier cannot
 * supply them yet — nothing registered, bytes still loading, or a failed load.
 *
 * The face is the *only* metrics source for a family that has no atlas. A
 * family that has an atlas resolves to the atlas before anything asks here,
 * so registering outlines cannot move text that was already rendering.
 *
 * Starts the load on a first call and answers `null` for now, like
 * `glyphOutline`.
 */
export function outlineMetrics(
  family: string,
  weight: number,
  style: FontStyle,
): OutlineFace | null {
  const slot = slots.get(slotKey(family, weight, style));
  if (!slot) return null;
  if (slot.status === 'idle') {
    void beginLoad(slot);
    return null;
  }
  return slot.status === 'ready' ? slot.face! : null;
}

/**
 * Load a registered face's bytes now and resolve with its settled status:
 * `'ready'`, `'failed'`, or `null` when nothing is registered for the
 * variant. Never rejects — a failed load is a status. For a caller that needs
 * the geometry in one go, such as converting text to paths.
 */
export async function loadFontOutlines(
  family: string, variant: OutlineVariant = {},
): Promise<OutlineStatus | null> {
  const { weight, style } = normalize(variant);
  const slot = slots.get(slotKey(family, weight, style));
  if (!slot) return null;
  await beginLoad(slot);
  return slot.status;
}

function beginLoad(slot: FaceSlot): Promise<void> {
  slot.load ??= runLoad(slot);
  return slot.load;
}

async function runLoad(slot: FaceSlot): Promise<void> {
  slot.status = 'loading';
  slots.bump();
  try {
    const bytes = await readSource(slot.source);
    announceBytes(slot, bytes);
    slot.face = await slot.parser(bytes);
    slot.status = 'ready';
    slots.bump();
    // The frame that asked for these glyphs has long since drawn, and on a
    // static document nothing else invalidates the canvas.
    notifyGlyphReady();
  } catch (err) {
    slot.status = 'failed';
    slots.bump();
    // A layout that found this face still loading deferred its judgment on
    // the family; wake it so it can make one.
    notifyGlyphReady();
    warnOnce(`load|${slotKey(slot.family, slot.weight, slot.style)}`,
      `weasel registerFontOutlines("${slot.family}" ${slot.weight}/${slot.style}): ` +
      `${err instanceof Error ? err.message : String(err)}. Large text in this face ` +
      `keeps rendering from the SDF tier.`);
  }
}

/**
 * Where DOM text gets one face, from {@link outlineCssSource}. `registration`
 * is the same object until the face is registered again.
 */
export type OutlineCssSource =
  /** The registration's `cssSrc`, which names what the bytes cannot. */
  | { registration: OutlineFaceInfo; src: string }
  /** A URL source, as `url(…)`: interchangeable with its bytes. */
  | { registration: OutlineFaceInfo; url: string }
  | { registration: OutlineFaceInfo; bytes: () => Promise<ArrayBuffer> };

/**
 * Where DOM text gets this face. `null` when nothing is registered.
 * In-package only.
 */
export function outlineCssSource(
  family: string, weight: number, style: FontStyle,
): OutlineCssSource | null {
  const slot = slots.get(slotKey(family, weight, style));
  if (!slot) return null;
  if (slot.cssSrc !== undefined) return { registration: slot, src: slot.cssSrc };
  if (typeof slot.source === 'string') {
    return { registration: slot, url: `url(${JSON.stringify(slot.source)})` };
  }
  const source = slot.source;
  return { registration: slot, bytes: () => readSource(source) };
}

/** `registration` is the one {@link outlineCssSource} names. */
type BytesListener = (registration: OutlineFaceInfo, bytes: ArrayBuffer) => void;
let bytesListener: BytesListener | null = null;

/**
 * Hear about a face's bytes the moment they are in hand — handed to
 * `registerFontOutlines` directly, or read because the canvas asked for the
 * face. Never earlier: a URL or thunk registration fetches nothing until then.
 * One listener; in-package only.
 */
export function onOutlineBytes(listener: BytesListener): void {
  bytesListener = listener;
}

function announceBytes(slot: FaceSlot, bytes: ArrayBuffer): void {
  try {
    bytesListener?.(slot, bytes);
  } catch {
    // DOM text falling behind must not cost the canvas its outlines.
  }
}

async function readSource(source: OutlineSource): Promise<ArrayBuffer> {
  const resolved = typeof source === 'function' ? await source() : source;
  if (typeof resolved === 'string') {
    const res = await fetch(resolved);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${resolved}`);
    return res.arrayBuffer();
  }
  if (resolved instanceof ArrayBuffer) return resolved;
  return resolved.arrayBuffer();
}

// Loading and glyph lookup both run off the render loop, so an unguarded warn
// would repeat every frame.
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** @internal Test seam — registry and warn-once keys are module state. */
export function _resetFontOutlinesForTests(): void {
  slots.clear();
  warned.clear();
}
