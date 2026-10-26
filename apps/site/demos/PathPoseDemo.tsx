import { useState } from 'react';
import {
  asNodeId,
  polygonFromPoints,
  SceneCanvas,
  useScene,
  useSelection,
} from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import type {
  Path,
  DebugConfig,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';

const DEBUG_STATES: Array<{ label: string; config: DebugConfig | false }> = [
  { label: 'off',          config: false },
  { label: 'bounds',       config: { bounds: true } },
  { label: '+origins',     config: { bounds: true, origins: true } },
  { label: '+hitboxes',    config: { bounds: true, origins: true, hitboxes: true } },
  { label: '+handles',     config: { bounds: true, origins: true, hitboxes: true, handles: true } },
  { label: 'all',          config: { bounds: true, origins: true, hitboxes: true, handles: true, snap: true, layers: true } },
];

const W = 400, H = 300;
const SNAP = { sources: [gridSnapSource({ spacing: 20 })] };
const ID = 'p';

const INITIAL_PATH: Path = polygonFromPoints([
  { x: 80, y: 200 },
  { x: 200, y: 60 },
  { x: 320, y: 200 },
  { x: 260, y: 240 },
  { x: 140, y: 240 },
]);

export function PathPoseDemo() {
  const [debugIdx, setDebugIdx] = useState(0);
  const debug = DEBUG_STATES[debugIdx].config;

  // Path TPose needs the full useScene shape (the trivial form aliases
  // pose === data === item, so item would have to BE a Path — but Path
  // carries no id field).
  const scene = useScene<{ id: string }, 'default', Path>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'mark',
      layer: 'default',
      pose: INITIAL_PATH,
      data: { id: ID },
      id: asNodeId(ID),
    }],
  });
  const selection = useSelection({ initial: [asNodeId(ID)] });

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <Button
          onClick={() => setDebugIdx((i) => (i + 1) % DEBUG_STATES.length)}
        >
          Debug overlay: {DEBUG_STATES[debugIdx].label}
        </Button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={['pick', 'move', 'transform']}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          snap={SNAP}
          debug={debug}
          layers={{
            scene: {
              drawOne: (_o, p): DrawCommand[] => [{
                kind: 'path',
                path: p,
                fill: { paint: { color: '#7fb069' } },
                stroke: { paint: { color: '#1a130d' }, width: 1.5 },
              }],
            },
          }}
        />
      </DemoStage>
    </div>
  );
}
