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
  FillStyle, GradientFill, GradientKind, GradientUnits, GradStop, TilePatternSpec,
} from './paint-types';
import { gradientForBounds } from './gradient';
import { bumpNodeMemoGeneration } from './scene/nodeMemo';
import type { ComponentType } from 'react';
import type { FillPoseBox } from './fillInPoseFrame';
import type { Mat3 } from '../renderer/math/mat3';
import type { ShaderProgram } from '../renderer/shaders/ShaderProgram';

/** A compiled GL program. A paint kind gets one from
 *  {@link PaintBindContext.program} and hands it back from `bind`. */
export type PaintProgram = ShaderProgram;

/**
 * `FillStyle`'s discriminant, open on the string the way `ChromeId` is: the
 * five kinds the kit ships, plus whatever a consumer registers.
 */
export type PaintKind = 'solid' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient' | 'pattern' | (string & {});

/** What a registered kind's editor renders. Arc 4 supplies the control. */
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
   */
  spaceInverse(units: GradientUnits | undefined): Mat3;
  /** Upload a stop ramp and bind it to a texture unit. */
  bindRamp(stops: GradStop[], unit: number): void;
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
  /** A paint of this kind seeded from a color — what an editor writes when a
   *  consumer switches a solid to this kind. */
  seed(fromColor: string): FillStyle;
  /** The single color this paint shows, or `undefined` when it has none. */
  colorOf(paint: FillStyle): string | undefined;
  /** Editor slot. */
  Editor?: ComponentType<PaintKindEditorProps>;
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
  /** The `<defs>` entry backing a `url(#id)` reference. */
  toSvg?(id: string, fill: FillStyle): string;
}

const BUILTINS: readonly PaintKindEntry[] = [
  {
    id: 'solid',
    label: 'Solid',
    seed: (color) => ({ color }),
    colorOf: (paint) => ((paint.fill ?? 'solid') === 'solid'
      ? (paint as { color: string }).color
      : undefined),
  },
  gradientKind('linear-gradient', 'Linear'),
  gradientKind('radial-gradient', 'Radial'),
  gradientKind('conic-gradient', 'Conic'),
  {
    id: 'pattern',
    label: 'Pattern',
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

function gradientKind(id: GradientKind, label: string): PaintKindEntry {
  return {
    id,
    label,
    // `bounds` units make the seed independent of the node's actual size.
    seed: (color) => gradientForBounds(id, UNIT_BOX, twoStopRamp(color), 'bounds'),
    colorOf: (paint) => (paint as Partial<GradientFill>).stops?.[0]?.color,
  };
}

const UNIT_BOX = { x: 0, y: 0, width: 1, height: 1 };

/** `color` to a contrasting end — white reads against any hue; against white
 *  itself, black does. */
function twoStopRamp(color: string): GradStop[] {
  const isWhite = color.slice(0, 7).toLowerCase() === '#ffffff';
  return [{ offset: 0, color }, { offset: 1, color: isWhite ? '#000000ff' : '#ffffffff' }];
}

let KINDS = new Map<string, PaintKindEntry>();

function seedBuiltins(): void {
  for (const entry of BUILTINS) KINDS.set(entry.id, entry);
}
seedBuiltins();

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

/** Register a paint kind. Returns a disposer that removes it. */
export function registerPaintKind(entry: PaintKindEntry): () => void {
  if ((entry.inPoseFrame === undefined) !== (entry.toBoundsFrame === undefined)) {
    const missing = entry.inPoseFrame === undefined ? 'inPoseFrame' : 'toBoundsFrame';
    throw new Error(
      `weasel registerPaintKind: kind "${entry.id}" is missing ${missing}. A kind ` +
      'that converts one frame direction and not the other drifts on the next ' +
      'resize; supply both or neither.',
    );
  }
  // Re-registering a built-in id is how a consumer closes a gap the kit leaves
  // — conic gradients still serialize as nothing — so disposing that override
  // puts the built-in back rather than deleting the kind.
  const displaced = KINDS.get(entry.id);
  KINDS.set(entry.id, entry);
  // `NodeShape`'s paint slot memoizes per node and resolves a fill's frame
  // inside it, so the kind set is ambient state that memo cannot see change.
  bumpNodeMemoGeneration();
  return () => {
    if (KINDS.get(entry.id) !== entry) return;
    if (displaced) KINDS.set(entry.id, displaced);
    else KINDS.delete(entry.id);
    bumpNodeMemoGeneration();
  };
}

/** The entry for `kind`, or `undefined`. */
export function getPaintKind(kind: string | undefined): PaintKindEntry | undefined {
  return KINDS.get(kind ?? 'solid');
}

/** Every registered kind, built-ins first, in registration order. */
export function listPaintKinds(): readonly PaintKindEntry[] {
  return [...KINDS.values()];
}

/** The registry entry for a paint, or `undefined` when its kind is unknown. */
export function paintKindOf(fill: FillStyle): PaintKindEntry | undefined {
  return getPaintKind(fill.fill ?? 'solid');
}

/** @internal Test helper — do not call from product code. */
export function _resetPaintKindsForTests(): void {
  KINDS = new Map();
  seedBuiltins();
  bumpNodeMemoGeneration();
}
