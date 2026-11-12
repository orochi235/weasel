import type { Action } from '@weasel-js/routing';
import { createPaintAction } from './createPaintAction';

/** One anchor's color: its index, and its RGBA, each channel 0..1. */
interface SetVertexColorState {
  index: number;
  rgba: readonly [number, number, number, number] | null;
}

/**
 * Static descriptor for the `setVertexColor` Action.
 *
 * `params.index` names an anchor and `params.rgba` its new color, written into
 * each selected node's `data.vertexColors` (one RGBA per anchor of its path),
 * leaving the other anchors alone. A node with no vertex colors, or fewer
 * anchors than `index` names, is left as it is.
 */
export const setVertexColorAction: Action & { requires: string[] } = createPaintAction<
  SetVertexColorState,
  number[],
  'vertexColors'
>({
  id: 'setVertexColor',
  label: 'Set vertex color',
  dataKey: 'vertexColors',
  initialState: (pick) => ({ index: pick<number>('index') ?? 0, rgba: pick<SetVertexColorState['rgba']>('rgba') ?? null }),
  readParams: (prev, params) => {
    const rgba = params?.rgba as SetVertexColorState['rgba'] | undefined;
    const index = params?.index as number | undefined;
    if (rgba === undefined && index === undefined) return null;
    return { index: index ?? prev.index, rgba: rgba ?? prev.rgba };
  },
  merge: (prev, { index, rgba }) => {
    if (!prev || !rgba || !Number.isInteger(index) || index < 0 || index * 4 + 4 > prev.length) return prev ?? null;
    const next = [...prev];
    next.splice(index * 4, 4, ...rgba);
    return next;
  },
});
