/**
 * The renderer's half of a paint kind: what it takes to draw one.
 *
 * Solids, patterns and the three gradients are branches inside the
 * renderer and never come through here. A kind beyond those registers its
 * bind slot, its frame conversions and its shaders, and the renderer consults
 * this registry for any kind it does not recognize.
 */

import type { ColorSpace, Paint, PaintUnits, GradStop } from '@weasel-js/paint';
import { createReflectable, type Reflection } from '@weasel-js/registry';
import type { FillPoseBox } from './fillInPoseFrame';
import type { GlMat3 } from '@weasel-js/geom';
import type { GpuTexture } from './gpu/types';
import {
  getProgramSource, registerProgram, sameProgramSource, type ProgramSource, type ShaderUniform,
} from './shaders/registerProgram';
import { assemblePaintWgsl } from './gpu/webgpu/wgsl/paintPrelude';

/** A texture a paint kind made through {@link PaintBindContext.createTexture},
 *  or the ramp atlas {@link PaintBindContext.ramp} hands back. Opaque: only
 *  the renderer reads it. */
export type PaintTexture = GpuTexture;

/** A uniform value a paint kind hands back: anything a shader command's
 *  `uniforms` take, or a {@link PaintTexture}. */
export type PaintUniform = ShaderUniform | PaintTexture;

/** What a paint kind's `bind` hands back: the program to draw with and the
 *  uniforms to draw it under, by name. The renderer binds them on whichever
 *  backend it runs, and sends `u_proj`, `u_model` and `u_origin` itself. */
export interface PaintBinding {
  /** A `registerProgram` id, typically one the kind's `programs` declares. */
  readonly program: string;
  readonly uniforms?: Readonly<Record<string, PaintUniform>>;
}

/**
 * The lifetime a paint kind's GPU state belongs to: one renderer on one live
 * context. The object itself is the key — a kind caches textures in a
 * `WeakMap` on it, so two renderers sharing a context never trade them — and
 * `onRelease` is where it frees them.
 */
export interface PaintResources {
  /** Run `release` once, when this lifetime ends: the renderer is disposed, or
   *  its context was lost and restored. Free every texture made under it
   *  there. */
  onRelease(release: () => void): void;
}

/**
 * The renderer surface a paint kind binds against, narrowed to what a paint
 * needs. The full `DrawContext` is not consumer surface.
 */
export interface PaintBindContext {
  /** The group alpha this draw inherits — multiply it into the paint's own. */
  readonly alpha: number;
  /**
   * `u_worldInv` for a paint declaring `units` — the inverse of the transform
   * from the paint's space to the frame the geometry arrives in. Paired with
   * the vertex shader's `v_world` varying this is *the* paint-space
   * convention; it is not gradient-specific.
   *
   * `about`, a point in that space, is where `v_world` measures from: the
   * paint's own anchor, such as a bake's corner. Subtracted in doubles, it is
   * what keeps a paint exact far from the origin, where a float32 paint-space
   * point is coarser than a pixel.
   *
   * `null` when that space has no inverse — a transform or view that flattens
   * an axis. Nothing the paint draws there means anything, so `bind` should
   * return `null` and draw nothing.
   */
  spaceInverse(units: PaintUnits | undefined, about?: { readonly x: number; readonly y: number }): GlMat3 | null;
  /**
   * The transform from the space `units` names to device pixels of the target
   * this draw lands in — screen pixels times the pixel ratio on screen, output
   * pixels in a headless render. It is what a paint baking a texture measures
   * its resolution against. `null` where `spaceInverse` is.
   */
  spaceToDevice(units: PaintUnits | undefined): GlMat3 | null;
  /** The largest texture side this context accepts, `MAX_TEXTURE_SIZE`. */
  readonly maxTextureSize: number;
  /** The lifetime GPU state made for this draw belongs to. Stable across the
   *  frames of one renderer, so it is the key for a kind's texture cache. */
  readonly resources: PaintResources;
  /**
   * Bake a stop ramp into the frame's ramp atlas and return the atlas and the
   * `v` the ramp's own row sits at — every ramp in a frame shares one
   * texture, so a paint must sample at the returned `v` and not at a constant.
   *
   * `space` is the blend the stops are baked through, defaulting to `'rgb'`.
   * It is part of the atlas key, so the same stops under two spaces take two
   * rows rather than colliding.
   */
  ramp(stops: GradStop[], space?: ColorSpace): { readonly texture: PaintTexture; readonly v: number };
  /**
   * A `width × height` texture of premultiplied RGBA8 texels, its first row
   * sampled at `v = 0`, bilinear and clamped. It lives until `deleteTexture`,
   * which a kind caching one calls from `resources.onRelease`.
   */
  createTexture(width: number, height: number, pixels: Uint8Array | Uint8ClampedArray): PaintTexture;
  deleteTexture(texture: PaintTexture): void;
}

/**
 * What the renderer needs of one paint kind. Every slot is optional, but
 * `inPoseFrame` and `toBoundsFrame` come as a pair or not at all: a kind that
 * converts one direction and not the other paints correctly once and then
 * drifts on the next resize.
 */
export interface PaintDrawKind {
  id: string;
  /**
   * Render slot: the program and uniforms that paint `fill`; `null` declines
   * the paint. Shader output must be premultiplied:
   * `outColor = vec4(rgb * a, a)`.
   *
   * The geometry is not always the node's own. Text below the outline tier
   * paints by drawing a quad over its glyphs' screen box into an offscreen
   * buffer and masking that with glyph coverage, so a paint must come from
   * `v_world` through `spaceInverse`, not from where `a_position` happens to
   * lie.
   */
  bind?(ctx: PaintBindContext, fill: Paint): PaintBinding | null;
  /** Bounds frame → the frame the node is painted in. */
  inPoseFrame?(fill: Paint, box: FillPoseBox): Paint;
  /** The inverse. Required whenever `inPoseFrame` is supplied. */
  toBoundsFrame?(fill: Paint, box: FillPoseBox): Paint;
  /**
   * Shader programs `bind` names, keyed by program id; registering the kind
   * registers them. Declaring them here rather than
   * calling `registerProgram` at import keeps a kind loaded by
   * {@link registerPaintDrawKindLoader} free of the shader registry.
   *
   * GLSL supplies both stages; its vertex stage reads `a_position` and the
   * `u_proj`, `u_model`, `u_origin` and `u_worldInv` the renderer and `bind`
   * set. WGSL supplies `fn fragment(in: PaintVaryings) -> vec4f` and, where
   * set, `vert`'s `fn vertex(v: PaintVertex) -> PaintVaryings`; the kit's
   * paint prelude declares both types, the `kit` uniforms and the entry
   * points (`gpu/webgpu/wgsl/paintPrelude.ts`). WGSL declaring entry points of
   * its own is compiled as it is.
   */
  programs?: Readonly<Record<string, ProgramSource>>;
}

const KINDS = createReflectable<PaintDrawKind>();

/** Every registered draw kind, with the overrides each displaced. */
export const paintDrawKindRegistry: Reflection<PaintDrawKind> = KINDS.reflection;

/** Register a kind's draw half. Returns a disposer that removes it.
 *  Re-registering an existing id is an override; disposing it uncovers
 *  whatever it displaced. */
export function registerPaintDrawKind(entry: PaintDrawKind): () => void {
  if ((entry.inPoseFrame === undefined) !== (entry.toBoundsFrame === undefined)) {
    const missing = entry.inPoseFrame === undefined ? 'inPoseFrame' : 'toBoundsFrame';
    throw new Error(
      `weasel registerPaintKind: kind "${entry.id}" is missing ${missing}. A kind ` +
      'that converts one frame direction and not the other drifts on the next ' +
      'resize; supply both or neither.',
    );
  }
  for (const [id, declared] of Object.entries(entry.programs ?? {})) {
    const src = paintProgramSource(declared);
    const have = getProgramSource(id);
    if (!have || !sameProgramSource(have, src)) registerProgram(id, src);
  }
  return KINDS.push(entry.id, entry);
}

/** A kind's program as the registry holds it: its WGSL inside the paint prelude. */
function paintProgramSource(src: ProgramSource): ProgramSource {
  return src.wgsl ? { ...src, wgsl: { frag: assemblePaintWgsl(src.wgsl) } } : src;
}

/** The draw half for `kind`, or `undefined`. A lookup that misses on a kind
 *  with a loader starts that load; see {@link registerPaintDrawKindLoader}. */
export function getPaintDrawKind(kind: string | undefined): PaintDrawKind | undefined {
  const id = kind ?? 'solid';
  const entry = KINDS.get(id);
  if (!entry && LOADERS.has(id)) void startLoad(id).catch(() => {});
  return entry;
}

/** Resolves with the draw half of a kind that is loaded on first use. */
export type PaintDrawKindLoader = () => Promise<PaintDrawKind>;

const LOADERS = new Map<string, PaintDrawKindLoader>();

/** One load per kind, kept after it settles: a failed load is not retried on
 *  every frame that meets the kind. */
const LOADS = new Map<string, Promise<void>>();

/**
 * Declare a paint kind that is loaded the first time something looks it up,
 * so its code stays out of the bundle until a paint of it appears — typically
 * `() => import('./myKind').then((m) => m.myKindEntry)`.
 *
 * Until it lands the kind is unregistered and the renderer draws nothing for
 * its paints. Call {@link warmPaintKinds} to load ahead of the first frame
 * instead.
 *
 * A kind that is already registered never calls its loader. Returns a
 * disposer that removes the loader.
 */
export function registerPaintDrawKindLoader(id: string, load: PaintDrawKindLoader): () => void {
  LOADERS.set(id, load);
  return () => {
    if (LOADERS.get(id) === load) LOADERS.delete(id);
  };
}

function startLoad(id: string): Promise<void> {
  const running = LOADS.get(id);
  if (running) return running;
  const load = LOADERS.get(id)!;
  const done = load().then(
    (entry) => {
      if (entry.id !== id) {
        throw new Error(`weasel: the loader for paint kind "${id}" resolved to "${entry.id}".`);
      }
      if (!KINDS.has(id)) registerPaintDrawKind(entry);
    },
  ).catch((err: unknown) => {
    console.error(`weasel: paint kind "${id}" failed to load:`, err);
    throw err;
  });
  LOADS.set(id, done);
  return done;
}

/** Is `id` registered, or declared with a loader? */
export function isPaintKindKnown(id: string): boolean {
  return KINDS.has(id) || LOADERS.has(id);
}

/**
 * Load paint kinds ahead of their first use, so the first frame that meets
 * one draws it rather than a blank. With no list, loads every kind that has a
 * loader.
 *
 * Resolves once every kind is registered; a kind already registered counts
 * as loaded. Rejects when a load fails, or for a kind that is neither
 * registered nor loadable.
 */
export function warmPaintKinds(kinds?: readonly string[]): Promise<void> {
  const ids = kinds ?? [...LOADERS.keys()];
  const loads: Promise<void>[] = [];
  for (const id of ids) {
    if (KINDS.has(id)) continue;
    if (!LOADERS.has(id)) {
      return Promise.reject(new Error(
        `weasel warmPaintKinds: "${id}" is neither registered nor loadable.`,
      ));
    }
    loads.push(startLoad(id));
  }
  return Promise.all(loads).then(() => undefined);
}

/** @internal Test helper — do not call from product code. */
export function _resetPaintDrawKindsForTests(): void {
  KINDS.clear();
  LOADERS.clear();
  LOADS.clear();
}
