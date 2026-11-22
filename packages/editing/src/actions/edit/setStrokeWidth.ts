import type { Action, ActionParamsOf } from '@weasel-js/routing';
import type { Stroke, VertexWidth, VertexWidthSides } from '@weasel-js/paint';
import { createPaintAction, finiteOr } from './createPaintAction';
import { solidStroke, DEFAULT_STROKE_COLOR } from '@weasel-js/paint';

/** `setStrokeWidth`'s gesture state: what it writes, each part only when given. */
interface SetStrokeWidthState {
  width?: number;
  /** `null` takes the per-anchor widths off, leaving the stroke's own `width`. */
  vertexWidths?: readonly VertexWidth[] | null;
}

/** `v` when it is a width a stroke can take: a finite number, zero or more. */
const widthOf = (v: unknown): number | undefined => {
  const w = finiteOr(v, undefined);
  return w !== undefined && w >= 0 ? w : undefined;
};

const isVertexWidth = (v: unknown): v is VertexWidth => {
  if (typeof v !== 'object' || v === null) return widthOf(v) !== undefined;
  const { left, right } = v as Partial<VertexWidthSides>;
  return widthOf(left) !== undefined && widthOf(right) !== undefined;
};

/** `v` when it is per-anchor widths a stroke can take, or `null`, which takes them off. */
const vertexWidthsOf = (v: unknown): readonly VertexWidth[] | null | undefined =>
  v === null ? null : Array.isArray(v) && v.every(isVertexWidth) ? v : undefined;

/**
 * Static descriptor for the `setStrokeWidth` Action.
 *
 * `params.width` (ignored unless a finite number, zero or more) becomes each
 * node's stroke `width`, and `params.vertexWidths` its per-anchor widths
 * (`null` removes them; ignored unless every entry is such a width, or sides that are), leaving the paint, cap, join and dash alone. A node with no stroke yet gets a hairline one in the kit default
 * color.
 */
export const setStrokeWidthAction: Action = createPaintAction<
  SetStrokeWidthState,
  Stroke,
  'stroke',
  ActionParamsOf<'setStrokeWidth'>
>({
  id: 'setStrokeWidth',
  label: 'Set stroke width',
  dataKey: 'stroke',
  initialState: (pick) => {
    const width = widthOf(pick('width'));
    const vertexWidths = vertexWidthsOf(pick('vertexWidths'));
    return { ...(width !== undefined ? { width } : {}), ...(vertexWidths !== undefined ? { vertexWidths } : {}) };
  },
  readParams: (prev, params) => {
    const width = widthOf(params?.width);
    const vertexWidths = vertexWidthsOf(params?.vertexWidths);
    if (width === undefined && vertexWidths === undefined) return null;
    return { ...prev, ...(width !== undefined ? { width } : {}), ...(vertexWidths !== undefined ? { vertexWidths } : {}) };
  },
  merge: (prev, state) => {
    if (state.width === undefined && (state.vertexWidths === undefined || (state.vertexWidths === null && prev == null))) return prev ?? null;
    const base: Stroke = prev ?? solidStroke(DEFAULT_STROKE_COLOR);
    const next: Stroke = state.width !== undefined ? { ...base, width: state.width } : { ...base };
    if (state.vertexWidths === null) delete next.vertexWidths;
    else if (state.vertexWidths !== undefined) next.vertexWidths = [...state.vertexWidths];
    return next;
  },
});
