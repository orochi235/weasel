import {
  IDENTITY_POSE_COMPOSITION, OUTPUT_GRID_KEY, createScene,
  type PoseComposition, type RectPose, type Scene, type SceneFromJSONOptions,
} from '@weasel-js/core';
import type { Path } from '@weasel-js/geom';

/** Clips a group to the left half of its box. */
const leftHalf = (p: RectPose): Path => ({ kind: 'rect', x: p.x, y: p.y, width: p.width / 2, height: p.height });

/** A bar under its one dependency, as wide as it. */
const below = (_node: unknown, deps: readonly ({ pose: RectPose } | undefined)[]): RectPose | null => {
  const dep = deps[0]?.pose;
  return dep ? { x: dep.x, y: dep.y + dep.height + 2, width: dep.width, height: 4 } : null;
};

/** Draws every node 3 units right of where it is stored, so a page that drops the rule draws elsewhere. */
const shifted = ({ pose }: { pose: RectPose }): RectPose => ({ ...pose, x: pose.x + 3 });

/** What {@link registeredScene} is built with and read back with: registered functions, an identity
 *  composition and a drawn quantize rule, none of which a snapshot carries. */
export const REGISTERED_SCENE_OPTIONS = {
  registry: { clipFromPose: { leftHalf }, derivePose: { below } },
  composition: IDENTITY_POSE_COMPOSITION as PoseComposition<RectPose>,
  quantize: { drawn: shifted },
} satisfies SceneFromJSONOptions<unknown, string, RectPose>;

/** A group clipped through the registry over a red rect that spans it, every pose world (identity
 *  composition), a bar deriving its pose from the rect, and a document grid the drawn rule reads. */
export function registeredScene(): Scene<unknown, 'main', RectPose> {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    ...REGISTERED_SCENE_OPTIONS,
    doc: { [OUTPUT_GRID_KEY]: { pitch: 1, origin: { x: 0, y: 0 } } },
  });
  const group = scene.add({
    kind: 'group', layer: 'main', pose: { x: 8, y: 8, width: 64, height: 40 }, data: {}, clipFromPose: leftHalf,
  });
  // World coordinates: under the rigid default this would land at (16, 16).
  const rect = scene.add({
    kind: 'mark', layer: 'main', parent: group, pose: { x: 8, y: 8, width: 64, height: 30 },
    data: { shape: 'rect', fill: { paint: { color: '#d03030' } } },
  });
  scene.add({
    kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { shape: 'rect', fill: { paint: { color: '#2060ff' } } },
    dependsOn: [rect], derivePose: below,
  });
  return scene;
}

/** A render covering {@link registeredScene}. */
export const REGISTERED_RENDER = {
  sourceRect: { x: 0, y: 0, width: 80, height: 56 },
  scale: { x: 2, y: 2 },
  background: '#ffffff',
} as const;
