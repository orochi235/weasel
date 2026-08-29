/**
 * The outline tier's registry: which faces have real font bytes behind them,
 * and what a given glyph looks like.
 *
 * ### What this tier is for
 *
 * A distance field is a *sampled* representation. The baked MSDF atlas is
 * generated from outlines and holds up well; the dynamic canvas-SDF tier
 * (`../dynamic/`) reconstructs its field from a 48px raster, so magnifying it
 * past a few times the bake size exposes the raster as contour wobble — bumps
 * one bake-texel apart, ±2–3px at 8×. No bake size fixes that, it only moves
 * the size at which it appears (`glyphRasterizer.ts` measures the tradeoff:
 * error is *minimized at* the bake size, so raising it spoils the 12–32px
 * range where most text lives).
 *
 * Above a size threshold the answer is to stop sampling: parse the font, take
 * the glyph's outline, and hand it to the path renderer the kit already has.
 * Exact at every zoom, and — because a glyph becomes an ordinary path — it
 * takes strokes and non-solid fills for free.
 *
 * Below the threshold the atlas still wins, and not narrowly: outlines carry
 * no hinting and no stem darkening, so body text at 12–16px rendered from
 * them looks *worse* than a platform rasterizer that puts stems on the pixel
 * grid. Two tiers with a size threshold is the standard hybrid, not a
 * compromise.
 *
 * ### Metric neutrality (the load-bearing invariant)
 *
 * This tier replaces how a glyph is *painted*, never where it sits. Advances,
 * kerning, line breaking and baselines all keep coming from whichever tier
 * resolved the run — the baked atlas or the canvas face. That is what lets
 * the threshold be a rendering decision: zooming past it swaps glyph geometry
 * with the layout untouched, so text cannot reflow under the user's cursor,
 * and `measureTextBounds` / `textLineBoxes` need to know nothing about
 * outlines at all.
 *
 * The cost is that a face whose real advances disagree with the atlas's
 * inherits the atlas's. For the bundled Inter that is exact (the subset ships
 * from the same source the atlas was baked from), and for a machine font the
 * outline bytes and the canvas metrics come from the same file.
 *
 * ### Availability
 *
 * Everything here degrades rather than blocks. Bytes arrive over `fetch` or
 * `queryLocalFonts` — asynchronous, and in the local case gated behind a
 * permission the user can refuse — so `glyphOutline` answers `null` until a
 * face is loaded and forever if it failed, and the caller falls back down the
 * ladder to SDF. A family must never render *nothing* because the outline
 * tier could not get bytes.
 */

import { notifyGlyphReady } from '../glyphReady';
import type { OutlineFace, OutlineFontStyle, OutlineParser } from './OutlineFace';
import { openTypeParser } from './opentypeParser';

/**
 * Where a face's bytes come from. A URL is fetched; a buffer or blob is used
 * as-is; a thunk is called at first use, which is what lets `queryLocalFonts`
 * results be registered eagerly and read lazily — the permission prompt and
 * the (potentially many megabytes of) blob only happen for a family the
 * document actually sets text in.
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
  style?: OutlineFontStyle;
}

/** Options for registering an outline font. */
export interface OutlineFontOptions {
  /** Override the default opentype.js parser. Mostly a test seam; also the
   *  hook for a consumer who already has a font parser in their bundle. */
  parser?: OutlineParser;
}

/** Load state of one registered face. */
export type OutlineStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface FaceSlot {
  family: string;
  weight: number;
  style: OutlineFontStyle;
  source: OutlineSource;
  parser: OutlineParser;
  status: OutlineStatus;
  face: OutlineFace | null;
  /** Memoized `glyphD` answers, including the `null` misses — a codepoint the
   *  face lacks is asked for on every frame that draws it, and re-deriving
   *  the miss means re-running the cmap lookup forever. */
  glyphs: Map<number, string | null>;
}

let slots = new Map<string, FaceSlot>();

function slotKey(family: string, weight: number, style: OutlineFontStyle): string {
  return `${family}|${weight}|${style}`;
}

function normalize(v: OutlineVariant): { weight: number; style: OutlineFontStyle } {
  return { weight: v.weight ?? 400, style: v.style ?? 'normal' };
}

/**
 * Register font file bytes for one face, so text set in it can render from
 * outlines above the size threshold.
 *
 * Registration is cheap and synchronous: nothing is fetched, and the parser
 * is not even imported, until a frame actually asks for a glyph from this
 * face. Registering a face that is never drawn large costs one map entry.
 *
 * The variant must match exactly what the layout tier resolved — this is
 * deliberately *not* a fallback chain. Painting 400-weight outlines at
 * 700-weight advances, or upright outlines where the shader was going to
 * fake an oblique, looks worse than the SDF it replaced; a miss here falls
 * back down the ladder instead, which is always safe.
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
    parser: opts.parser ?? openTypeParser,
    status: 'idle',
    face: null,
    glyphs: new Map(),
  });
}

/** Drop a registration. Glyphs already handed out stay valid — they are
 *  plain path data — but nothing further resolves from this face. */
export function unregisterFontOutlines(family: string, variant: OutlineVariant = {}): void {
  const { weight, style } = normalize(variant);
  slots.delete(slotKey(family, weight, style));
}

/**
 * Is an outline face registered for this exact variant? Answers `true` while
 * the bytes are still loading — the question is "could this face serve
 * outlines", which is what a caller deciding whether to *ask* wants; use
 * `outlineStatus` for the narrower "can it right now".
 */
export function hasFontOutlines(
  family: string, weight = 400, style: OutlineFontStyle = 'normal',
): boolean {
  return slots.has(slotKey(family, weight, style));
}

/** Load state of a registered face; `null` when nothing is registered. */
export function outlineStatus(
  family: string, weight = 400, style: OutlineFontStyle = 'normal',
): OutlineStatus | null {
  return slots.get(slotKey(family, weight, style))?.status ?? null;
}

/** Every registered outline face and its load state — the enumeration a
 *  debug overlay or font picker needs, mirroring `listFonts`. */
export function listFontOutlines(): readonly {
  family: string; weight: number; style: OutlineFontStyle; status: OutlineStatus;
}[] {
  return [...slots.values()]
    .map(({ family, weight, style, status }) => ({ family, weight, style, status }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.weight - b.weight
      || a.style.localeCompare(b.style));
}

/**
 * Em-space SVG path data for one glyph, or `null` when this tier cannot serve
 * it — no registration, bytes still loading, load failed, no such glyph, or a
 * glyph with no contours.
 *
 * Synchronous by construction: it is called from the per-frame glyph walk, so
 * it can only ever report what is already in hand. The first call for an
 * unloaded face starts the load and returns `null`; when the load lands,
 * `notifyGlyphReady` asks the canvas to draw again and the second frame gets
 * the outline. Same shape as the dynamic tier's deferred bakes.
 */
/**
 * Close every contour of a glyph's path data.
 *
 * A glyph contour is closed by definition — neither TrueType nor CFF has any
 * other kind — but not every serializer writes the `Z` that says so, and the
 * omission is invisible until someone *strokes* the outline: a fill closes the
 * contour implicitly (earcut joins last point to first), while a stroke
 * follows exactly the path it is handed and leaves the closing edge unpainted,
 * with a cap at each loose end. That showed up as glyphs missing part of their
 * outline along long straight edges, which is where a contour's seam usually
 * falls.
 *
 * Normalized here rather than in one parser because the same hole is open to
 * every consumer-supplied `OutlineParser`, and a contract that says "closed"
 * is cheaper to guarantee than to document.
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
 * when there is nothing to draw.
 *
 * Synchronous and non-throwing by design: a face that has not been parsed yet
 * starts loading and answers `null` for now, so a renderer can call this every
 * frame and simply fall through to another text tier until the outline
 * arrives. Results are cached per codepoint.
 */
export function glyphOutline(
  family: string,
  weight: number,
  style: OutlineFontStyle,
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
 * The face is the *only* metrics source for a family that has no atlas, which
 * is the case this exists for: without it such a family cannot lay out at all.
 * It does not disturb metric neutrality — a family that has an atlas resolves
 * to the atlas long before anything asks here, so registering outlines still
 * cannot move text that was already rendering.
 *
 * Starts the load on a first call and answers `null` for now, exactly like
 * `glyphOutline`, so a per-frame caller falls through and picks it up on the
 * frame after the bytes land.
 */
export function outlineMetrics(
  family: string,
  weight: number,
  style: OutlineFontStyle,
): OutlineFace | null {
  const slot = slots.get(slotKey(family, weight, style));
  if (!slot) return null;
  if (slot.status === 'idle') {
    void beginLoad(slot);
    return null;
  }
  return slot.status === 'ready' ? slot.face! : null;
}

async function beginLoad(slot: FaceSlot): Promise<void> {
  slot.status = 'loading';
  try {
    slot.face = await slot.parser(await readSource(slot.source));
    slot.status = 'ready';
    // The frame that asked for these glyphs has long since drawn. Without
    // this the outlines sit in memory until something else invalidates the
    // canvas, which on a static document is "never".
    notifyGlyphReady();
  } catch (err) {
    slot.status = 'failed';
    warnOnce(`load|${slotKey(slot.family, slot.weight, slot.style)}`,
      `weasel registerFontOutlines("${slot.family}" ${slot.weight}/${slot.style}): ` +
      `${err instanceof Error ? err.message : String(err)}. Large text in this face ` +
      `keeps rendering from the SDF tier.`);
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
  slots = new Map();
  warned.clear();
}
