import { useEffect, useRef } from 'react';
import {
  ActionsProvider, SceneCanvas, rectPath, solid, useIconRegistry, useMenuHost, useMenus, useScene, useSelection,
} from '@weasel-js/core';
import type { Fill, MenuDef, NodeId, Path, SceneCanvasApi } from '@weasel-js/core';
import { attachMenuHost } from '@weasel-js/hud';
import { pref } from '@weasel-js/prefs';
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import { DemoStage } from './DemoStage';

interface NodeData { path: Path; fill: Fill }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 260;

const rect = (id: string, pose: Pose, color: string) => ({
  id: id as NodeId, kind: 'leaf' as const, layer: 'default' as const, pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: solid(color) } },
});

const MENUS: MenuDef[] = [
  {
    id: 'demo.selection', when: { bodyTarget: 'selected-body' }, menu: pref.group('', {
      edit: pref.group('', { duplicate: pref.action('duplicate'), delete: pref.action('delete') }),
      order: pref.group('', { forward: pref.action('reorder.forward'), backward: pref.action('reorder.backward') }),
    }),
  },
  {
    id: 'demo.canvas', when: { bodyTarget: 'empty' }, menu: pref.group('', {
      selectAll: pref.action('selectAll'), undo: pref.action('undo'), redo: pref.action('redo'),
    }),
  },
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

  const canvasRef = useRef<SceneCanvasApi>(null);
  const size = useRef({ width: W, height: H });
  const hud = useHud();
  const hudEntry = useHudContribution(hud, { font: 'sans-serif' });
  const host = useMenuHost();
  const icons = useIconRegistry();
  useEffect(() => {
    if (!host) return;
    return attachMenuHost(hud, host, {
      ...(icons ? { icons } : {}),
      toCanvas: ({ x, y }) => {
        const r = canvasRef.current?.element?.getBoundingClientRect();
        return r ? { x: x - r.left, y: y - r.top } : { x, y };
      },
      canvasSize: () => size.current,
    });
  }, [hud, host, icons]);

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        ref={canvasRef}
        features={['pick', 'move', 'edit', 'arrange']}
        claimKeys
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        ambient={[hudEntry]}
        onResize={(s) => { size.current = s; }}
      />
    </DemoStage>
  );
}

export function HudContextMenuDemo() {
  return (
    <div className="ckd-shape-tools-demo">
      <ActionsProvider><Demo /></ActionsProvider>
    </div>
  );
}
