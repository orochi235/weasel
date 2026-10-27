import { useMemo } from 'react';
import type { RedrawSource } from '../../core/layers/render';

/**
 * What repaints a `<SceneCanvas>` besides its own render: the caller's
 * sources, then the canvas's. Neither a scene write nor an override write
 * renders the component, and an override write does not bump the scene version
 * either; nor does a scroll. An animator frame repaints for a `drawOne` reading
 * `animator.colorOverrides`.
 */
export function useSceneRedrawSources(args: {
  /** `<SceneCanvas>`'s own `redrawOn`, `animator` and `modes`. */
  props: {
    redrawOn?: readonly RedrawSource[];
    animator?: { onTick(listener: () => void): () => void };
    modes?: RedrawSource;
  };
  scene: RedrawSource & { overrides: RedrawSource; scroll?: RedrawSource };
  heldModifiers: RedrawSource;
  /** The ghosts `poseTransition` shows leaving, which move each frame. */
  departures: RedrawSource;
}): readonly RedrawSource[] {
  const { scene, heldModifiers, departures } = args;
  const { redrawOn: supplied, animator, modes } = args.props;
  return useMemo((): readonly RedrawSource[] => [
    ...(supplied ?? []),
    scene,
    scene.overrides,
    ...(scene.scroll ? [scene.scroll] : []),
    heldModifiers,
    ...(animator ? [{ subscribe: (repaint: () => void) => animator.onTick(repaint) }] : []),
    ...(modes ? [modes] : []),
    departures,
  ], [scene, heldModifiers, animator, modes, supplied, departures]);
}
