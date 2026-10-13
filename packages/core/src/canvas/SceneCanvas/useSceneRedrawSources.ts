import { useMemo } from 'react';
import type { RedrawSource } from '../../core/layers/render';

/**
 * What repaints a `<SceneCanvas>` besides its own render: the caller's
 * sources, then the canvas's. Neither a scene write nor an override write
 * renders the component, and an override write does not bump the scene version
 * either. An animator frame repaints for a `drawOne` reading
 * `animator.colorOverrides`.
 */
export function useSceneRedrawSources(args: {
  /** `<SceneCanvas redrawOn>`. */
  supplied: readonly RedrawSource[] | undefined;
  scene: RedrawSource & { overrides: RedrawSource };
  heldModifiers: RedrawSource;
  animator: { onTick(listener: () => void): () => void } | undefined;
  modes: RedrawSource | undefined;
}): readonly RedrawSource[] {
  const { supplied, scene, heldModifiers, animator, modes } = args;
  return useMemo((): readonly RedrawSource[] => [
    ...(supplied ?? []),
    scene,
    scene.overrides,
    heldModifiers,
    ...(animator ? [{ subscribe: (repaint: () => void) => animator.onTick(repaint) }] : []),
    ...(modes ? [modes] : []),
  ], [scene, heldModifiers, animator, modes, supplied]);
}
