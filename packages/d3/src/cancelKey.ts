import { compositeKey, createPart } from '@weasel-js/registry';

const KEY_SPACE = 'd3-transition';

/** A number per scene, so two scenes sharing one animator never share a key: node ids are
 *  unique only within a scene. */
let nextToken = 0;
const sceneToken = createPart((_scene: object): string => String(nextToken++));

/** The cancelKey of the pose tween a transition named `name` runs on `nodeId` in `scene`, or
 *  with `tween`, of its custom tween by that name; `animator.cancelKey` takes it. */
export function transitionCancelKey(scene: object, name: string, nodeId: string, tween?: string): string {
  const parts = [KEY_SPACE, sceneToken(scene), name, nodeId];
  return compositeKey(tween === undefined ? parts : [...parts, tween]);
}
