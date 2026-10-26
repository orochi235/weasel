import type React from 'react';
import { forwardRef } from 'react';
import type { SceneCanvasApi } from './canvasExtension';
import { renderSceneCanvas } from './SceneCanvas';
import type { FeaturePreset, PresetSource } from './SceneCanvas/features';
import type { SceneCanvasProps } from './SceneCanvas/props';
import { toolDrivenActions } from './SceneCanvas/presets/toolDriven';
import { baselineActions } from './SceneCanvas/presets/baseline';

const LEAN_SOURCE: PresetSource = { named: null, pool: toolDrivenActions, baseline: baselineActions };

/** Props for {@link LeanSceneCanvas}: `<SceneCanvas>`'s, with `features`
 *  taking preset objects only. */
export type LeanSceneCanvasProps<TData, TLayer extends string, TPose> =
  Omit<SceneCanvasProps<TData, TLayer, TPose>, 'features'> & { features?: readonly FeaturePreset[] };

function LeanSceneCanvasWrapper<TData, TLayer extends string, TPose>(
  props: LeanSceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return renderSceneCanvas(LEAN_SOURCE, props, ref);
}

/**
 * `<SceneCanvas>` without core's preset names: `features` takes preset
 * objects (`selectPreset`, `editPreset`, a package's own), and a preset the
 * app does not import is not in its bundle. `viewport` does not imply
 * `viewPreset` here; pass it.
 */
export const LeanSceneCanvas = forwardRef(LeanSceneCanvasWrapper) as <
  TData, TLayer extends string, TPose,
>(
  props: LeanSceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<SceneCanvasApi> },
) => React.ReactElement;
