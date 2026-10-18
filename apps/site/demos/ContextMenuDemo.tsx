import { useCallback, useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';
import {
  ActionsProvider, SceneCanvas, rectPath, solid, useMenus, useScene, useSelection,
} from '@weasel-js/core';
import type { Fill, MenuDef, NodeId, Path } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui';
import { DemoStage } from './DemoStage';

interface NodeData { path: Path; fill: Fill }
interface Pose { x: number; y: number; width: number; height: number }

const rect = (id: string, pose: Pose, color: string) => ({
  id: id as NodeId, kind: 'leaf' as const, layer: 'default' as const, pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: solid(color) } },
});

const SELECTION = pref.group('', {
  edit: pref.group('', { duplicate: pref.action('duplicate'), delete: pref.action('delete') }),
  order: pref.group('', { forward: pref.action('reorder.forward'), backward: pref.action('reorder.backward') }),
});

const CANVAS = pref.group('', {
  selectAll: pref.action('selectAll'), undo: pref.action('undo'), redo: pref.action('redo'),
});

const MENUS: MenuDef[] = [
  { id: 'demo.selection', when: { bodyTarget: 'selected-body' }, menu: SELECTION },
  { id: 'demo.canvas', when: { bodyTarget: 'empty' }, menu: CANVAS },
  { id: 'demo.row', menu: SELECTION },
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
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const openRowMenu = useContextMenu('demo.row');
  const onRowMenu = useCallback((id: NodeId, e: MouseEvent) => {
    selection.set([id]);
    openRowMenu(e);
  }, [selection, openRowMenu]);

  return (
    <div className="ckd-shape-tools-demo">
      <ContextMenuHost />
      <DemoStage width={400} height={260}>
        <SceneCanvas
          features={['pick', 'move', 'edit', 'arrange']}
          claimKeys
          className="ckd-canvas"
          scene={scene}
          selection={selection}
        />
      </DemoStage>
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
