import { useMemo } from 'react';
import type { RedrawSource } from '../../core/layers/render';
import { paintOverrideSources, type PaintOverrides } from '../paintOverrides';

/**
 * What repaints a `<SceneCanvas>` besides its own render: the caller's
 * sources, then the canvas's. Neither a scene write nor an override write
 * renders the component, and an override write does not bump the scene version
 * either; nor does a scroll. An animator frame repaints for a `drawOne` reading
 * `animator.colorOverrides` or `animator.trimOverrides`, and so does a bare
 * `set` or `clear` on either.
 */
export function useSceneRedrawSources(args: {
  /** `<SceneCanvas>`'s own `redrawOn`, `animator` and `modes`. */
  props: {
    redrawOn?: readonly RedrawSource[];
    animator?: { onTick(listener: () => void): () => void } & PaintOverrides;
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
    ...paintOverrideSources(animator),
    ...(modes ? [modes] : []),
    departures,
  ], [scene, heldModifiers, animator, modes, supplied, departures]);
}
