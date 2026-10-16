import { useCallback, useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';
import {
  ActionsProvider, SceneCanvas, rectPath, solid, useMenus, useScene, useSelection,
} from '@weasel-js/core';
import type { Fill, MenuDef, NodeId, Path } from '@weasel-js/core';
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui';

interface NodeData { path: Path; fill: Fill }
interface Pose { x: number; y: number; width: number; height: number }

const rect = (id: string, pose: Pose, color: string) => ({
  id: id as NodeId, kind: 'leaf' as const, layer: 'default' as const, pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: solid(color) } },
});

const SELECTION = [
  [{ action: 'duplicate' }, { action: 'delete' }],
  [{ action: 'reorder.forward' }, { action: 'reorder.backward' }],
];

const MENUS: MenuDef[] = [
  { id: 'demo.selection', when: { bodyTarget: 'selected-body' }, sections: SELECTION },
  { id: 'demo.canvas', when: { bodyTarget: 'empty' }, sections: [[{ action: 'selectAll' }, { action: 'undo' }, { action: 'redo' }]] },
  { id: 'demo.row', sections: SELECTION },
];

function Demo() {
  const scene = useScene<NodeData, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      rect('Green', { x: 30, y: 50, width: 90, height: 70 }, '#7fb069'),
      rect('Tan', { x: 160, y: 110, width: 80, height: 80 }, '#d4a574'),
      rect('Violet', { x: 270, y: 40, width: 90, height: 60 }, '#a48bd4'),
    ],
  });
  const selection = useSelection({ scene, mode: 'single' });
  useMenus(MENUS);
  useSyncExternalStore(scene.subscribe, scene.getVersion);

  const openRowMenu = useContextMenu('demo.row');
  const onRowMenu = useCallback((id: NodeId, e: MouseEvent) => {
    selection.set([id]);
    openRowMenu(e);
  }, [selection, openRowMenu]);

  return (
    <div className="ckd-shape-tools-demo">
      <ContextMenuHost />
      <SceneCanvas
        features={['pick', 'move', 'edit', 'arrange']}
        claimKeys
        width={400}
        height={260}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
      />
      <ul>
        {[...scene.nodes.keys()].map((id) => (
          <li key={id} onContextMenu={(e) => onRowMenu(id, e)}>{id}</li>
        ))}
      </ul>
    </div>
  );
}

export function ContextMenuDemo() {
  return <ActionsProvider><Demo /></ActionsProvider>;
}
