import {
  asNodeId,
  boundsOfPath,
  createScene,
  type NodeId,
  type Path,
  type PathEditHost,
  pathFromD,
  type RectPose,
  type RedrawSource,
  solid,
  useSelection,
} from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';
import { useState } from 'react';

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

/**
 * The path selected and open for anchor editing, the way a double-click on it
 * leaves it: a selection holding it, and a path-edit host whose open path
 * starts as it. Escape closes it and a double-click reopens it, through the
 * host. `redrawOn` repaints the canvas when the host's answer changes.
 */
export function useSeededPathEdit(): {
  selection: ReturnType<typeof useSelection>;
  pathEdit: PathEditHost;
  redrawOn: readonly RedrawSource[];
} {
  const selection = useSelection({ initial: [EDITED_ID] });
  const [seeded] = useState(() => {
    let editing: string | null = EDITED_ID;
    const listeners = createEmitter();
    const changes: RedrawSource = { subscribe: listeners.subscribe };
    const pathEdit: PathEditHost = {
      editingId: () => editing,
      setEditingId(id) {
        editing = id;
        listeners.emit();
      },
    };
    return { pathEdit, redrawOn: [changes] };
  });
  return { selection, ...seeded };
}
