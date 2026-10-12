import type { ComponentType } from 'react';
import type { FillStyle, GradStop } from '@weasel-js/paint';
import type { PaintDrawKind } from 'renderer/paintKinds';

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
 * One paint kind: the renderer's draw slots, plus what an editor and a
 * serializer read.
 *
 * `seed`, `label` and `colorOf` are the editor's slots and every kind has
 * them. The rest are optional because a kind may not need them.
 */
export interface PaintKindEntry extends PaintDrawKind {
  label: string;
  /** Glyph naming this kind in an editor's kind bar, as an icon name the UI
   *  layer resolves — the same indirection `PrefBase.icon` uses. A kind
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
