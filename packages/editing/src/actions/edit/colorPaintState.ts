import type { PaintParams } from '@weasel-js/core';
import type { Paint } from '@weasel-js/paint';
import type { PickParam } from './createPaintAction';

/** `setFill`'s and `setStroke`'s gesture state. A `paint` shadows the color until a later color supersedes it. */
export interface ColorPaintState {
  /** May be 6- or 8-char hex. Ignored while `paint` is set. */
  color: string;
  /** `null` is None, distinct from `undefined`, which means this gesture
   *  carries no paint and the color applies. */
  paint?: Paint | null;
}

const colorOf = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const paintOf = (v: unknown): Paint | null | undefined =>
  v === null || (typeof v === 'object' && !Array.isArray(v)) ? (v as Paint | null) : undefined;

/** How `setFill` and `setStroke` read `color` and `paint`; a value of the wrong type is ignored, as if absent. */
export function colorPaintReader(defaultColor: string): {
  initialState(pick: PickParam<PaintParams>): ColorPaintState;
  readParams(prev: ColorPaintState, params: Readonly<Partial<PaintParams>> | undefined): ColorPaintState | null;
} {
  return {
    initialState: (pick) => ({ color: colorOf(pick('color')) ?? defaultColor, paint: paintOf(pick('paint')) }),
    readParams: (prev, params) => {
      const color = colorOf(params?.color);
      const paint = paintOf(params?.paint);
      if (color === undefined && paint === undefined) return null;
      if (color === undefined) return { ...prev, paint };
      // An explicit color supersedes a paint from an earlier tick; otherwise a
      // picker drag after a gradient would do nothing.
      return { color, paint };
    },
  };
}
