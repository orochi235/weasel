import { compositeKey } from '@weasel-js/registry';

const KEY_SPACE = 'd3-transition';

/** The cancelKey of the pose tween a transition named `name` runs on `nodeId`, or with `tween`, of
 *  its custom tween by that name; `animator.cancelKey` takes it. */
export function transitionCancelKey(name: string, nodeId: string, tween?: string): string {
  return compositeKey(tween === undefined ? [KEY_SPACE, name, nodeId] : [KEY_SPACE, name, nodeId, tween]);
}
