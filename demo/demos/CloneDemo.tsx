import { useState } from 'react';
import {
  asNodeId,
  rectPath,
  SceneCanvas,
  useScene,
  useSelection,
  type ToolsApi,
} from '@orochi235/weasel';

const W = 400, H = 300;

const INITIAL = [
  { id: asNodeId('a'), kind: 'leaf' as const, layer: 'default' as const, parent: null,
    pose: { x: 60,  y: 80,  width: 80, height: 60 },
    data: { path: rectPath(60, 80, 80, 60), fill: '#7fb069' } },
  { id: asNodeId('b'), kind: 'leaf' as const, layer: 'default' as const, parent: null,
    pose: { x: 220, y: 140, width: 80, height: 60 },
    data: { path: rectPath(220, 140, 80, 60), fill: '#d4a574' } },
];

export function CloneDemo() {
  // SceneCanvas's `toolBundle="everything"` includes useCloneTool with the
  // built-in `cloneByAltDrag` behavior — Alt+drag a rect to spawn a copy.
  // Default clone target is the hit object; multi-selection cloning would
  // need per-tool options the kit doesn't surface through toolBundle yet.
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL,
  });
  const selection = useSelection({ mode: 'multi', extend: 'shift' });
  const [, setTools] = useState<ToolsApi | null>(null);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectionMode="multi"
      toolBundle="everything"
      onToolsCreated={setTools}
    />
  );
}
