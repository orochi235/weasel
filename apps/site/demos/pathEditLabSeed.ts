import {
  asNodeId,
  boundsOfPath,
  createScene,
  type NodeId,
  type Path,
  type PathEditOpening,
  pathFromD,
  type RectPose,
  solid,
} from '@weasel-js/core';

/** The one path each path-edit lab opens with its anchors already editable. */
export const EDITED_ID: NodeId = asNodeId('curve');

/** A scene holding one stroked path, `d` or a built one, filled with `fill`
 *  when given, in the node shape the kit's shape tools produce: `data.path`
 *  under a rect pose. */
export function createPathLabScene(d: string | Path, fill?: string) {
  const path = typeof d === 'string' ? pathFromD(d) : d;
  const { x, y, width, height } = boundsOfPath(path);
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'mark',
      id: EDITED_ID,
      layer: 'default',
      pose: { x, y, width, height },
      data: { path, ...(fill ? { fill: { paint: solid(fill) } } : {}), stroke: { paint: solid('#3b4252'), width: 2 } },
    }],
  });
}

/** Opens {@link EDITED_ID} in anchor edit as the canvas mounts, for `defaultPathEdit`: the selection must
 *  hold it too, as `useSelection({ scene, initial: [EDITED_ID] })` does. */
export const EDITED_OPENING: PathEditOpening = { id: EDITED_ID };
