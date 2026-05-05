import { useRef, useState } from 'react';
import {
  Canvas,
  pathOriginProjection,
  pathPoseDescriptor,
  pointInPath,
  polygonFromPoints,
  traceToContext,
  gridSnapStrategy,
  snap as snapBehavior,
  useSelection,
  useSelectTool,
  useTools,
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

interface PathObj { id: string }
type Pose = Path;

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
  const [path, setPath] = useState<Path>(INITIAL_PATH);
  const pathRef = useRef(path);
  pathRef.current = path;
  const [debugIdx, setDebugIdx] = useState(0);
  const debug = DEBUG_STATES[debugIdx].config;

  const selection = useSelection({ initial: [ID] });

  const adapter = {
    getObject: (id: string) => (id === ID ? { id } : undefined),
    getObjects: () => [{ id: ID }],
    getPose: () => pathRef.current,
    setPose: (_id: string, p: Pose) => setPath(p),
    ...selection.adapterMethods,
  };

  const select = useSelectTool<PathObj, Pose>(adapter, {
    pickEvery: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
    boundsOf: (id) => (id === ID ? pathPoseDescriptor.getBounds(pathRef.current) : null),
    handleHitRadius: HANDLE,
    move: { behaviors: [snapBehavior(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))] },
    resize: { geometry: pathPoseDescriptor },
    drawGhost: (cx, _o, p) => {
      cx.fillStyle = '#7fb069';
      cx.strokeStyle = '#1a130d';
      cx.lineWidth = 1.5;
      cx.beginPath();
      traceToContext(cx, p);
      cx.fill();
      cx.stroke();
    },
    getObject: (id) => (id === ID ? { id } : null),
  });
  const tools = useTools({ active: 'select', registry: { select } });

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
      <Canvas
        width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter}
        selection={selection}
        tools={tools}
        onTapEmpty={() => {}}
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
const [path, setPath] = useState<Path>(polygonFromPoints([...]));

const adapter: MoveAdapter<PathObj, Path> & ResizeAdapter<PathObj, Path> = {
  getObject, getObjects, getPose: () => path, setPose: (_id, p) => setPath(p),
};

// Path TPose is auto-detected — Canvas's default geometry dispatches on
// pose.kind, so pickEvery / boundsOf / move.translatePose /
// resize.geometry all know about Paths without an explicit prop.
// The only Path-specific extra is the snap behavior, which reads the origin
// via pathOriginProjection.
return (
  <Canvas
    width={W} height={H}
    adapter={adapter}
    handleHitRadius={HANDLE}
    selectionOptions={{ initial: ['p'] }}
    onTapEmpty={() => {}}
    snap={gridSnapStrategy<Path>(20, { origin: pathOriginProjection })}
    layers={{
      scene: { drawOne: (cx, _o, p) => { traceToContext(cx, p); cx.fill(); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
