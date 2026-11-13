import type { Action } from '@weasel-js/routing';
import type { Stroke, VertexWidth } from '@weasel-js/paint';
import { createPaintAction } from './createPaintAction';
import { strokeOf, DEFAULT_STROKE_COLOR } from '../../../util/paint';

/** `setStrokeWidth`'s gesture state: what it writes, each part only when given. */
interface SetStrokeWidthState {
  width?: number;
  /** `null` takes the per-anchor widths off, leaving the stroke's own `width`. */
  vertexWidths?: readonly VertexWidth[] | null;
}

/**
 * Static descriptor for the `setStrokeWidth` Action.
 *
 * `params.width` becomes each node's stroke `width`, and `params.vertexWidths`
 * its per-anchor widths (`null` removes them), leaving the paint, cap, join and
 * dash alone. A node with no stroke yet gets a hairline one in the kit default
 * color.
 */
export const setStrokeWidthAction: Action & { requires: string[] } = createPaintAction<
  SetStrokeWidthState,
  Stroke,
  'stroke'
>({
  id: 'setStrokeWidth',
  label: 'Set stroke width',
  dataKey: 'stroke',
  initialState: (pick) => {
    const width = pick<number>('width');
    const vertexWidths = pick<readonly VertexWidth[] | null>('vertexWidths');
    return { ...(width !== undefined ? { width } : {}), ...(vertexWidths !== undefined ? { vertexWidths } : {}) };
  },
  readParams: (prev, params) => {
    const width = params?.width as number | undefined;
    const vertexWidths = params?.vertexWidths as readonly VertexWidth[] | null | undefined;
    if (width === undefined && vertexWidths === undefined) return null;
    return { ...prev, ...(width !== undefined ? { width } : {}), ...(vertexWidths !== undefined ? { vertexWidths } : {}) };
  },
  merge: (prev, state) => {
    const base: Stroke = prev ?? strokeOf(DEFAULT_STROKE_COLOR);
    const next: Stroke = state.width !== undefined ? { ...base, width: state.width } : { ...base };
    if (state.vertexWidths === null) delete next.vertexWidths;
    else if (state.vertexWidths !== undefined) next.vertexWidths = [...state.vertexWidths];
    return next;
  },
});
