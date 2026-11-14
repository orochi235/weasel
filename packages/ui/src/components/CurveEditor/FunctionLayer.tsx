import { useMemo, type ReactElement } from 'react';
import { createFunctionLayer, type FunctionLayerConfig, type FunctionLayerState } from './createFunctionLayer';
import { CustomLayer, type LayerStateProps } from './CustomLayer';

/** Props for {@link FunctionLayer}: a function layer's configuration, and its state. */
export interface FunctionLayerProps extends FunctionLayerConfig, LayerStateProps<FunctionLayerState> {}

/**
 * A curve through control points, as a child of a `LayeredCurveEditor` or `CurveEditor`: drag anchors, click to
 * insert, right-click to delete. Built by {@link createFunctionLayer}; `functionLayerState(points)` starts its state.
 */
export function FunctionLayer({ state, onChange, onCommit, ...cfg }: FunctionLayerProps): ReactElement {
  const {
    id, domain, endpoints, interpolation, constrain, addPointMode, minPoints, maxPoints,
    curve, fill, hideNonInteractive, renderAnchor, interactive, xClamp, label,
  } = cfg;
  const layer = useMemo(() => createFunctionLayer({
    id, domain, endpoints, interpolation, constrain, addPointMode, minPoints, maxPoints,
    curve, fill, hideNonInteractive, renderAnchor, interactive, xClamp, label,
  }), [
    id, domain, endpoints, interpolation, constrain, addPointMode, minPoints, maxPoints,
    curve, fill, hideNonInteractive, renderAnchor, interactive, xClamp, label,
  ]);
  return <CustomLayer layer={layer} state={state} onChange={onChange} onCommit={onCommit} />;
}
