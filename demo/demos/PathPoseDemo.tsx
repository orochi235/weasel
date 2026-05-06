import { useState } from 'react';
import {
  asNodeId,
  pathOriginProjection,
  pathPoseDescriptor,
  polygonFromPoints,
  traceToContext,
  gridSnapStrategy,
  SceneCanvas,
  useScene,
  useSelection,
} from '@orochi235/weasel';
import type {
  Path,
  DebugConfig,
} from '@orochi235/weasel';

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

const W = 400, H = 300, HANDLE = 8;
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
  const selection = useSelection({ initial: [ID] });

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
        handleHitRadius={HANDLE}
        snap={gridSnapStrategy<Path>(20, { origin: pathOriginProjection })}
        resizeOptions={{ geometry: pathPoseDescriptor }}
        debug={debug}
        layers={{
          scene: {
            drawOne: (cx, _o, p) => {
              cx.fillStyle = '#7fb069';
              cx.strokeStyle = '#1a130d';
              cx.lineWidth = 1.5;
              cx.beginPath();
              traceToContext(cx, p);
              cx.fill();
              cx.stroke();
            },
          },
          selectionOverlay: { handles: { size: HANDLE } },
        }}
      />
    </div>
  );
}

export const PATH_POSE_DEMO_SOURCE = `// --- Scene: pose IS a Path (no rect translation step) ---
// Full useScene form because Path carries no id field — trivial form would
// require items to BE Paths.
const scene = useScene<{ id: string }, 'default', Path>({
  systemLayers: [{ id: 'default' }],
  initial: [{ kind: 'leaf', layer: 'default', pose: INITIAL_PATH, data: { id: 'p' }, id: asNodeId('p') }],
});
const selection = useSelection({ initial: ['p'] });

// Path TPose is auto-detected — SceneCanvas's default pickEvery / boundsOf
// dispatch on pose.kind via pathPoseDescriptor, so no manual hit-test glue.
// The only Path-specific extras are the snap origin projection and the
// resize geometry descriptor.
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selection={selection}
    handleHitRadius={HANDLE}
    snap={gridSnapStrategy<Path>(20, { origin: pathOriginProjection })}
    resizeOptions={{ geometry: pathPoseDescriptor }}
    layers={{
      scene: { drawOne: (cx, _o, p) => { traceToContext(cx, p); cx.fill(); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
