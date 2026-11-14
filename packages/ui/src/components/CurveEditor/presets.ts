import type { CurveEditorProps } from './CurveEditor';

/**
 * Spread into a `CurveEditor` to plot free points: no curve, no fill, no pinned endpoints, and a
 * click on empty space adds a point. Props written after the spread win.
 *
 * ```tsx
 * <CurveEditor {...POINT_PLOTTER_PROPS} value={points} onInput={setPoints} width={400} height={200} />
 * ```
 */
export const POINT_PLOTTER_PROPS = {
  curve: false,
  fill: false,
  endpoints: 'free',
  addPointMode: 'click-empty',
} as const satisfies Partial<CurveEditorProps>;
