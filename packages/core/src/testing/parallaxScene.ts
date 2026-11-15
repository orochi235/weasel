import { createScene, type ParallaxOptions, type RectPose, type Scene } from '@weasel-js/core';

/** A scene with a parallax plane `back` under a plain layer `main`. */
export type ParallaxScene = Scene<unknown, 'back' | 'main', RectPose>;

/** Where both of {@link parallaxScene}'s nodes sit. */
export const PARALLAX_POSE: RectPose = { x: 100, y: 0, width: 10, height: 10 };

const fill = (color: string) => ({ paint: { kind: 'solid', color } });

/** A red rect `a` on the plane `back`, moving as `parallax` says, and a green rect `b` at the same pose on `main`, over it. */
export function parallaxScene(parallax: ParallaxOptions, pose: RectPose = PARALLAX_POSE): ParallaxScene {
  const scene: ParallaxScene = createScene<unknown, 'back' | 'main', RectPose>({ systemLayers: [{ id: 'back', parallax }, { id: 'main' }] });
  scene.untracked(() => scene.batch('Load', () => {
    scene.add({ id: 'a', kind: 'mark', layer: 'back', pose, data: { shape: 'rect', fill: fill('#ff0000') } } as never);
    scene.add({ id: 'b', kind: 'mark', layer: 'main', pose, data: { shape: 'rect', fill: fill('#00ff00') } } as never);
  }));
  return scene;
}
