import type { PoseComposition } from 'core/scene/composePose';
import type { Scene, SerializedScene } from 'core/scene/types';

/** `<SceneCanvas>`'s scene: a live one, or a saved one it bakes. */
export interface SceneCanvasSceneProps<TData, TLayer extends string, TPose> {
  /** A `Scene` (typically from `useScene`) or an `EditingSession` over one —
   *  the session whose selection, previews and scroll this canvas and its views
   *  act on, the scene's own when handed the scene — or a `SerializedScene` JSON
   *  object, which SceneCanvas bakes into a Scene on first render. The
   *  serialized form is read once; pass a `key` on `<SceneCanvas>` to force
   *  a fresh canvas from updated JSON.
   *
   *  The JSON shape is relaxed (`version: number` rather than the `1`
   *  literal) so an `import json from './x.json'` result satisfies the type
   *  without an `as` cast. */
  scene:
    | Scene<TData, TLayer, TPose>
    | SerializedScene<TData, TLayer, TPose>
    | { version: number; systemLayers?: ReadonlyArray<{ id: string }>; nodes: ReadonlyArray<unknown> };

  /** The composition a serialized `scene` is baked with, as `sceneFromJSON(json, { composition })`
   *  takes it: a scene whose poses are not rects needs its own to nest (kernel3d's
   *  `POSE3_COMPOSITION`). Read once, with the JSON; a live `Scene` keeps the one it was made with. */
  composition?: PoseComposition<TPose>;
}
