import { useMemo, type ReactElement } from 'react';
import { createKeyframeLayer, type KeyframeLayerConfig, type KeyframeLayerState } from './createKeyframeLayer';
import { CustomLayer, type LayerStateProps } from './CustomLayer';

/** Props for {@link KeyframeLayer}: a keyframe layer's configuration, and its state. */
export interface KeyframeLayerProps extends KeyframeLayerConfig, LayerStateProps<KeyframeLayerState> {}

/**
 * Keyframes and the easing between them, as a child of a `LayeredCurveEditor`: drag keys and bezier handles, select
 * keys and segments, step with the arrows. Built by {@link createKeyframeLayer}; `keyframeLayerState(keys)` starts its
 * state.
 */
export function KeyframeLayer({ state, onChange, onCommit, ...cfg }: KeyframeLayerProps): ReactElement {
  const { id, label, formatX, snapX, snapRadiusPx, xClamp, yClamp, step } = cfg;
  const layer = useMemo(
    () => createKeyframeLayer({ id, label, formatX, snapX, snapRadiusPx, xClamp, yClamp, step }),
    [id, label, formatX, snapX, snapRadiusPx, xClamp, yClamp, step],
  );
  return <CustomLayer layer={layer} state={state} onChange={onChange} onCommit={onCommit} />;
}
