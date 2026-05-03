import { useRef, useState } from 'react';
import {
  Canvas,
  pathPoseDescriptor,
  pathOriginProjection,
  polygonFromPoints,
  traceToContext,
  snap,
  gridSnapStrategy,
} from '@orochi235/weasel';
import type {
  Path,
  MoveAdapter,
  ResizeAdapter,
} from '@orochi235/weasel';

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

  const adapter: MoveAdapter<PathObj, Pose> & ResizeAdapter<PathObj, Pose> = {
    getObject: (id) => (id === ID ? { id } : undefined),
    getObjects: () => [{ id: ID }],
    getPose: () => pathRef.current,
    getParent: () => null,
    setPose: (_id, p) => setPath(p),
    setParent: () => {},
  };

  return (
    <Canvas<PathObj, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      geometry={pathPoseDescriptor}
      handleHitRadius={HANDLE}
      selectionOptions={{ initial: [ID] }}
      onTapEmpty={() => {}}
      moveOptions={{
        behaviors: [snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))],
      }}
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
  );
}

export const PATH_POSE_DEMO_SOURCE = `// --- Scene: pose IS a Path (no rect translation step) ---
const [path, setPath] = useState<Path>(polygonFromPoints([...]));

const adapter: MoveAdapter<PathObj, Path> & ResizeAdapter<PathObj, Path> = {
  getObject, getObjects, getPose: () => path, setPose: (_id, p) => setPath(p),
  getParent: () => null, setParent: () => {},
};

// geometry={pathPoseDescriptor} wires up the Path-aware bounds, translate,
// and resize-remap behind a single prop, so the default hitBody / boundsOf /
// moveOptions.translatePose / resizeOptions.geometry all know about Paths.
// The only Path-specific extra is the snap behavior, which reads the origin
// via pathOriginProjection.
return (
  <Canvas<PathObj, Path>
    width={W} height={H}
    adapter={adapter}
    geometry={pathPoseDescriptor}
    handleHitRadius={HANDLE}
    selectionOptions={{ initial: ['p'] }}
    onTapEmpty={() => {}}
    moveOptions={{
      behaviors: [snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))],
    }}
    layers={{
      scene: { drawOne: (cx, _o, p) => { traceToContext(cx, p); cx.fill(); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
