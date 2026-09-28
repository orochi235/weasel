/**
 * The paint-kind registry — what makes `FillStyle` open.
 *
 * A consumer registers a sixth kind and it renders, converts between the
 * bounds and pose frames, and serializes, with no kit edits. The five built-in
 * kinds are registered here at module load so an editor's kind bar can
 * enumerate every kind through one list.
 *
 * Each kit layer consults this registry for a kind it does not recognize and
 * otherwise runs its own built-in branch. That split is not laziness: a built-in
 * kind's render slot lives in the GL renderer, its serialize slot lives in
 * `@weasel-js/svg`, and neither can be imported from here without inverting a
 * package dependency.
 */

import type {
  ColorSpace, FillStyle, GradientFill, GradientKind, GradientUnits, GradStop, TilePatternSpec,
} from '@weasel-js/paint';
import { gradientForBounds, isGradientFill, withGradientKind } from './gradient';
import { bumpNodeMemoGeneration } from './scene/nodeMemo';
import type { ComponentType } from 'react';
import { createReflectable, type Reflection } from '@weasel-js/registry';
import type { FillPoseBox } from './fillInPoseFrame';
import type { GlMat3 } from '../renderer/math/mat3';
import type { ShaderProgram } from '../renderer/shaders/ShaderProgram';

/** A compiled GL program. A paint kind gets one from
 *  {@link PaintBindContext.program} and hands it back from `bind`. */
export type PaintProgram = ShaderProgram;

/**
 * `FillStyle`'s discriminant, open on the string the way `ChromeId` is: the
 * five kinds the kit ships, plus whatever a consumer registers.
 */
export type PaintKind = 'solid' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient' | 'pattern' | (string & {});

/** What a registered kind's editor renders. `PaintInput` in `@weasel-js/ui`
 *  is the control that mounts it. */
export interface PaintKindEditorProps {
  value: FillStyle;
  onInput?(next: FillStyle): void;
  onChange(next: FillStyle): void;
}

/**
 * The renderer surface a paint kind binds against, narrowed to what a paint
 * needs. The full `DrawContext` is not consumer surface.
 */
export interface PaintBindContext {
  readonly gl: WebGL2RenderingContext;
  /** The group alpha this draw inherits — multiply it into the paint's own. */
  readonly alpha: number;
  /**
   * The compiled program for a `registerProgram` id, compiled against this
   * renderer on first use. `null` when no source is registered under `id` or
   * compilation failed.
   */
  program(id: string): PaintProgram | null;
  /** Send `u_proj` and `u_model`, which every kit vertex shader takes. */
  setProjAndModel(program: PaintProgram): void;
  /**
   * `u_worldInv` for a paint declaring `units` — the inverse of the transform
   * from the paint's space to the frame the geometry arrives in. Paired with
   * the vertex shader's `v_world` varying this is *the* paint-space
   * convention; it is not gradient-specific.
   *
   * `null` when that space has no inverse — a transform or view that flattens
   * an axis. Nothing the paint draws there means anything, so `bind` should
   * return `null` and draw nothing.
   */
  spaceInverse(units: GradientUnits | undefined): GlMat3 | null;
  /**
   * Bake a stop ramp into the frame's ramp atlas, bind that atlas to a texture
   * unit, and return the `v` the ramp's own row sits at — every ramp in a
   * frame shares one texture, so a paint must sample at the returned `v` and
   * not at a constant.
   *
   * `space` is the blend the stops are baked through, defaulting to `'rgb'`.
   * It is part of the atlas key, so the same stops under two spaces take two
   * rows rather than colliding.
   */
  bindRamp(stops: GradStop[], unit: number, space?: ColorSpace): number;
}

/**
 * One paint kind.
 *
 * `seed`, `label` and `colorOf` are the editor's slots and every kind has
 * them. The rest are optional because a kind may not need them — but
 * `inPoseFrame` and `toBoundsFrame` come as a pair or not at all: a kind that
 * converts one direction and not the other paints correctly once and then
 * drifts on the next resize.
 */
export interface PaintKindEntry {
  id: string;
  label: string;
  /** Glyph naming this kind in an editor's kind bar, as an icon name the UI
   *  layer resolves — the same indirection `ToolPrefBase.icon` uses. A kind
   *  without one is named by its `label`. */
  icon?: string;
  /** A paint of this kind seeded from a color — what an editor writes when a
   *  consumer switches a solid to this kind. */
  seed(fromColor: string): FillStyle;
  /** The single color this paint shows, or `undefined` when it has none. */
  colorOf(paint: FillStyle): string | undefined;
  /** Editor slot. */
  Editor?: ComponentType<PaintKindEditorProps>;
  /**
   * The stop list this paint reads as. With `fromStops`, it is what makes a
   * kind a gradient: `listGradientKinds` returns the kinds carrying both, and
   * `switchGradientKind` converts between any two of them through the list.
   */
  stopsOf?(paint: FillStyle): GradStop[];
  /** A paint of this kind built from a stop list, in `bounds` units. The
   *  converse of `stopsOf`; supply both or neither. */
  fromStops?(stops: GradStop[]): FillStyle;
  /**
   * Render slot: bind program, uniforms and textures for `fill` and return the
   * bound program; `null` declines the paint.
   *
   * Binding is split from drawing on purpose — a caller owning its own stencil
   * state (an inner/outer-aligned stroke, an even-odd fill) must issue its own
   * draw call, and the kit's draw wrapper would clobber that state. Shader
   * output must be premultiplied: `outColor = vec4(rgb * a, a)`.
   */
  bind?(ctx: PaintBindContext, fill: FillStyle): PaintProgram | null;
  /** Bounds frame → the frame the node is painted in. */
  inPoseFrame?(fill: FillStyle, box: FillPoseBox): FillStyle;
  /** The inverse. Required whenever `inPoseFrame` is supplied. */
  toBoundsFrame?(fill: FillStyle, box: FillPoseBox): FillStyle;
  /**
   * The `<defs>` entry backing a `url(#id)` reference.
   *
   * SVG has paint servers for two gradients and a pattern and nothing else, so
   * a kind beyond those has no element to target: write a foreign-namespaced
   * one under the `wzl:` prefix `@weasel-js/svg` declares on the root whenever
   * a document holds such a paint. That package emits the fallback color
   * beside the reference on its own, from `colorOf`.
   */
  toSvg?(id: string, fill: FillStyle): string;
}

const BUILTINS: readonly PaintKindEntry[] = [
  {
    id: 'solid',
    label: 'Solid',
    icon: 'paintSolid',
    seed: (color) => ({ color }),
    colorOf: (paint) => ((paint.fill ?? 'solid') === 'solid'
      ? (paint as { color: string }).color
      : undefined),
  },
  gradientKind('linear-gradient', 'Linear', 'paintLinear'),
  gradientKind('radial-gradient', 'Radial', 'paintRadial'),
  gradientKind('conic-gradient', 'Conic', 'paintConic'),
  {
    id: 'pattern',
    label: 'Pattern',
    icon: 'paintPattern',
    seed: (color) => ({
      fill: 'pattern',
      pattern: { tile: 'hatch', color },
      units: 'bounds',
    }),
    colorOf: (paint) => (paint.fill === 'pattern'
      ? (paint.pattern as Partial<TilePatternSpec>).color
      : undefined),
  },
];

function gradientKind(id: GradientKind, label: string, icon: string): PaintKindEntry {
  return {
    id,
    label,
    icon,
    // `bounds` units make the seed independent of the node's actual size.
    seed: (color) => gradientForBounds(id, UNIT_BOX, twoStopRamp(color), 'bounds'),
    colorOf: (paint) => (paint as Partial<GradientFill>).stops?.[0]?.color,
    stopsOf: (paint) => (paint as GradientFill).stops,
    fromStops: (stops) => gradientForBounds(id, UNIT_BOX, stops, 'bounds'),
  };
}

const UNIT_BOX = { x: 0, y: 0, width: 1, height: 1 };

/** `color` to a contrasting end — white reads against any hue; against white
 *  itself, black does. */
function twoStopRamp(color: string): GradStop[] {
  const isWhite = color.slice(0, 7).toLowerCase() === '#ffffff';
  return [{ offset: 0, color }, { offset: 1, color: isWhite ? '#000000ff' : '#ffffffff' }];
}

const KINDS = createReflectable<PaintKindEntry>();

function seedBuiltins(): void {
  for (const entry of BUILTINS) KINDS.push(entry.id, entry, { source: 'kit' });
}
seedBuiltins();
// `NodeShape`'s paint slot memoizes per node and resolves a fill's frame
// inside it, so the kind set is ambient state that memo cannot see change.
KINDS.subscribe(bumpNodeMemoGeneration);

/** Every registered paint kind, with the overrides each displaced. */
export const paintKindRegistry: Reflection<PaintKindEntry> = KINDS.reflection;

/**
 * A consumer's own paint, typed as a `FillStyle`.
 *
 * `FillStyle` stays a closed union: opening its discriminant would widen every
 * built-in member and break the narrowing the kit's own branches depend on.
 * A registered kind declares its own interface instead and passes it through
 * here — the kit reads only `fill` and hands the whole object back to that
 * kind's slots.
 */
export function asPaint<T extends { fill: string }>(paint: T): FillStyle {
  return paint as unknown as FillStyle;
}

/** Register a paint kind. Returns a disposer that removes it. Re-registering an
 *  existing id is an override; disposing it uncovers whatever it displaced. */
export function registerPaintKind(entry: PaintKindEntry): () => void {
  if ((entry.stopsOf === undefined) !== (entry.fromStops === undefined)) {
    const missing = entry.stopsOf === undefined ? 'stopsOf' : 'fromStops';
    throw new Error(
      `weasel registerPaintKind: kind "${entry.id}" is missing ${missing}. A ` +
      'gradient kind reads as a stop list and builds from one; supply both or neither.',
    );
  }
  if ((entry.inPoseFrame === undefined) !== (entry.toBoundsFrame === undefined)) {
    const missing = entry.inPoseFrame === undefined ? 'inPoseFrame' : 'toBoundsFrame';
    throw new Error(
      `weasel registerPaintKind: kind "${entry.id}" is missing ${missing}. A kind ` +
      'that converts one frame direction and not the other drifts on the next ' +
      'resize; supply both or neither.',
    );
  }
  // Re-registering a built-in id is how a consumer closes a gap the kit leaves,
  // so disposing that override puts the built-in back rather than deleting the
  // kind.
  return KINDS.push(entry.id, entry);
}

/** The entry for `kind`, or `undefined`. A lookup that misses on a kind with
 *  a loader starts that load; see {@link registerPaintKindLoader}. */
export function getPaintKind(kind: string | undefined): PaintKindEntry | undefined {
  const id = kind ?? 'solid';
  const entry = KINDS.get(id);
  if (!entry && LOADERS.has(id)) void startLoad(id).catch(() => {});
  return entry;
}

/** Resolves with the entry for a kind that is loaded on first use. */
export type PaintKindLoader = () => Promise<PaintKindEntry>;

const LOADERS = new Map<string, PaintKindLoader>();

/** One load per kind, kept after it settles: a failed load is not retried on
 *  every frame that meets the kind. */
const LOADS = new Map<string, Promise<void>>();

// A built-in kind heavy enough to keep off a consumer's bundle until a paint
// of it turns up. Importing the module statically still registers it at once.
const LAZY_BUILTINS: ReadonlyArray<readonly [string, PaintKindLoader]> = [
  ['mesh-gradient', async () => (await import('../features/meshPaint/meshPaint')).meshGradientKind],
];

function seedLoaders(): void {
  LOADERS.clear();
  LOADS.clear();
  for (const [id, load] of LAZY_BUILTINS) LOADERS.set(id, load);
}
seedLoaders();

/**
 * Declare a paint kind that is loaded the first time something looks it up,
 * so its code stays out of the bundle until a paint of it appears — typically
 * `() => import('./myKind').then((m) => m.myKindEntry)`.
 *
 * Until it lands the kind is unregistered: the renderer draws nothing for its
 * paints, and every other reader treats it as unknown. Registering it fires
 * `paintKindRegistry`'s subscribers, which is what `<SceneCanvas>` repaints
 * on. Call {@link warmPaintKinds} to load ahead of the first frame instead.
 *
 * A kind that is already registered never calls its loader. Returns a
 * disposer that removes the loader.
 */
export function registerPaintKindLoader(id: string, load: PaintKindLoader): () => void {
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
      if (!KINDS.has(id)) registerPaintKind(entry);
    },
  ).catch((err: unknown) => {
    console.error(`weasel: paint kind "${id}" failed to load:`, err);
    throw err;
  });
  LOADS.set(id, done);
  return done;
}

/**
 * Load paint kinds ahead of their first use, so the first frame that meets
 * one draws it rather than a blank. With no list, loads every kind that has a
 * loader — the kit's lazily loaded built-ins (`mesh-gradient`) plus any a
 * consumer declared with {@link registerPaintKindLoader}.
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

/** Every registered kind, built-ins first, in registration order. */
export function listPaintKinds(): readonly PaintKindEntry[] {
  return KINDS.entries().map((e) => e.value);
}

/** Every registered gradient kind — the ones that read as and build from a
 *  stop list — in registration order. */
export function listGradientKinds(): readonly PaintKindEntry[] {
  return listPaintKinds().filter((entry) => entry.stopsOf && entry.fromStops);
}

/**
 * `paint` retargeted to gradient kind `kind`, or `undefined` when either side
 * is not a gradient kind.
 *
 * Between two of the stop gradients this is `withGradientKind`, which carries
 * the geometry. Any other pair goes through the stop list — `stopsOf` on the
 * way out, `fromStops` on the way in — keeping `interpolate` and `opacity`.
 * Lossy wherever the kinds hold different information; an editor that wants a
 * switch to be undoable should keep the original paint.
 */
export function switchGradientKind(paint: FillStyle, kind: PaintKind): FillStyle | undefined {
  const from = paintKindOf(paint);
  const to = getPaintKind(kind);
  if (!from?.stopsOf || !to?.fromStops) return undefined;
  if (from.id === to.id) return paint;
  if (isGradientFill(paint) && isGradientFill({ fill: kind } as FillStyle)) {
    return withGradientKind(paint, kind as GradientKind);
  }
  const { interpolate, opacity } = paint as { interpolate?: ColorSpace; opacity?: number };
  return {
    ...to.fromStops(from.stopsOf(paint)),
    ...(interpolate !== undefined ? { interpolate } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  } as FillStyle;
}

/** The registry entry for a paint, or `undefined` when its kind is unknown. */
export function paintKindOf(fill: FillStyle): PaintKindEntry | undefined {
  return getPaintKind(fill.fill ?? 'solid');
}

/** @internal Test helper — do not call from product code. */
export function _resetPaintKindsForTests(): void {
  KINDS.clear();
  seedBuiltins();
  seedLoaders();
}
