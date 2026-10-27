import type { ComponentType } from 'react';
import type { IconRef } from '@weasel-js/icons';
import type { Paint, GradStop, TileKind } from '@weasel-js/paint';
import type { PaintDrawKind } from '@weasel-js/renderer';

/**
 * `Paint`'s discriminant, open on the string the way `ChromeId` is: the
 * kinds the kit ships, plus whatever a consumer registers.
 */
export type PaintKind =
  | 'solid' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient'
  | TileKind | 'image' | 'texture'
  | (string & {});

/**
 * A set of kinds an editor offers as one choice. Kinds sharing a family show
 * as a single segment in a kind bar, named by the family, and the member is
 * picked inside that segment's body. The built-in tiles, `image` and `texture` are the
 * `patternFamily`.
 */
export interface PaintKindFamily {
  id: string;
  label: string;
  /** Glyph for the family's segment. */
  icon?: IconRef;
}

/** What a registered kind's editor renders. `PaintInput` in `@weasel-js/ui`
 *  is the control that mounts it. */
export interface PaintKindEditorProps {
  value: Paint;
  onInput?(next: Paint): void;
  onChange(next: Paint): void;
}

/**
 * One paint kind: the renderer's draw slots, plus what an editor and a
 * serializer read.
 *
 * `seed`, `label` and `colorOf` are the editor's slots and every kind has
 * them. The rest are optional because a kind may not need them.
 */
export interface PaintKindEntry extends PaintDrawKind {
  label: string;
  /** Glyph naming this kind in an editor's kind bar. A kind without one is
   *  named by its `label`. */
  icon?: IconRef;
  /** The family this kind is offered under; see {@link PaintKindFamily}. A
   *  kind without one is its own segment. */
  family?: PaintKindFamily;
  /** A paint of this kind seeded from a color — what an editor writes when a
   *  consumer switches a solid to this kind. */
  seed(fromColor: string): Paint;
  /** The single color this paint shows, or `undefined` when it has none. */
  colorOf(paint: Paint): string | undefined;
  /** Editor slot. */
  Editor?: ComponentType<PaintKindEditorProps>;
  /**
   * The stop list this paint reads as. With `fromStops`, it is what makes a
   * kind a gradient: `listGradientKinds` returns the kinds carrying both, and
   * `switchGradientKind` converts between any two of them through the list.
   */
  stopsOf?(paint: Paint): GradStop[];
  /** A paint of this kind built from a stop list, in `bounds` units. The
   *  converse of `stopsOf`; supply both or neither. */
  fromStops?(stops: GradStop[]): Paint;
  /**
   * The `<defs>` entry backing a `url(#id)` reference.
   *
   * SVG has paint servers for two gradients and a pattern and nothing else, so
   * a kind beyond those has no element to target: write a foreign-namespaced
   * one under the `wzl:` prefix `@weasel-js/svg` declares on the root whenever
   * a document holds such a paint. That package emits the fallback color
   * beside the reference on its own, from `colorOf`.
   */
  toSvg?(id: string, fill: Paint): string;
}

/**
 * A consumer's own paint, typed as a `Paint`.
 *
 * `Paint` stays a closed union: opening its discriminant would widen every
 * built-in member and break the narrowing the kit's own branches depend on.
 * A registered kind declares its own interface instead and passes it through
 * here — the kit reads only `kind` and hands the whole object back to that
 * kind's slots.
 */
export function asPaint<T extends { kind: string }>(paint: T): Paint {
  return paint as unknown as Paint;
}
