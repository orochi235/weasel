import { useState } from 'react';
import {
  asNodeId,
  polygonFromPoints,
  gridSnapStrategy,
  SceneCanvas,
  useScene,
  useSelection,
} from '@weasel-js/core';
import type {
  Path,
  DebugConfig,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';

const DEBUG_STATES: Array<{ label: string; config: DebugConfig | false }> = [
  { label: 'off',          config: false },
  { label: 'bounds',       config: { bounds: true } },
  { label: '+origins',     config: { bounds: true, origins: true } },
  { label: '+hitboxes',    config: { bounds: true, origins: true, hitboxes: true } },
  { label: '+handles',     config: { bounds: true, origins: true, hitboxes: true, handles: true } },
  { label: 'all',          config: { bounds: true, origins: true, hitboxes: true, handles: true, snap: true, layers: true } },
];

const btn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  background: '#2a2018', color: '#d4c4a8',
  border: '1px solid #4a3c2e', borderRadius: 3,
};

const W = 400, H = 300;
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
      kind: 'leaf',
      layer: 'default',
      pose: INITIAL_PATH,
      data: { id: ID },
      id: asNodeId(ID),
    }],
  });
  const selection = useSelection({ initial: [asNodeId(ID)] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          style={btn}
          onClick={() => setDebugIdx((i) => (i + 1) % DEBUG_STATES.length)}
        >
          Debug overlay: {DEBUG_STATES[debugIdx].label}
        </button>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectTool={{
          snap: gridSnapStrategy<Path>(20),
        }}
        debug={debug}
        layers={{
          scene: {
            drawOne: (_o, p): DrawCommand[] => [{
              kind: 'path',
              path: p,
              fill: { color: '#7fb069' },
              stroke: { paint: { color: '#1a130d' }, width: 1.5 },
            }],
          },
        }}
      />
    </div>
  );
}
