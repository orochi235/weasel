/**
 * What a canvas outlines while a boolean group, or a group inside one, is entered: the
 * children it consumes are drawn only through the group's result, so without these only the
 * selection chrome says where they are.
 */
import type { Path } from '@weasel-js/geom';
import type { NodeId, Scene } from 'core/scene/types';
import { operandOf } from 'core/scene/booleanOfChildren';
import { sceneDepLookup } from 'canvas/derivedPath';

/** The world outline of each shown node under the outermost node at or above `entered` that
 *  consumes its children, a group's members each on their own; none when no such node is. */
export function enteredOperandOutlines<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  entered: NodeId,
): Path[] {
  let top: NodeId | null = null;
  for (let at: NodeId | null = entered; at !== null; at = scene.get(at)?.parent ?? null) {
    if (scene.get(at)?.consumesChildren === true) top = at;
  }
  if (top === null) return [];
  const depOf = sceneDepLookup(scene);
  const out: Path[] = [];
  const walk = (id: NodeId): void => {
    for (const child of scene.childrenOf(id)) {
      const node = scene.get(child);
      if (node === undefined || node.hidden === true) continue;
      const dep = node.kind === 'group' ? undefined : depOf(child);
      const outline = dep === undefined ? null : operandOf(dep as never);
      if (outline !== null) out.push(outline);
      walk(child);
    }
  };
  walk(top);
  return out;
}
