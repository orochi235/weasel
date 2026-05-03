import { useRef, useState } from 'react';
import {
  Canvas,
  pathPoseDescriptor,
  pathOriginProjection,
  polygonFromPoints,
  translatePath,
  boundsOfPath,
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

  const hitBody = (wx: number, wy: number): string | null => {
    const b = boundsOfPath(pathRef.current);
    if (wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height) return ID;
    return null;
  };

  const boundsOf = (id: string) => (id === ID ? boundsOfPath(pathRef.current) : null);

  return (
    <Canvas<PathObj, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      handleHitRadius={HANDLE}
      hitBody={hitBody}
      boundsOf={boundsOf}
      selectionOptions={{ initial: [ID] }}
      onTapEmpty={() => {}}
      moveOptions={{
        translatePose: translatePath,
        behaviors: [snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))],
      }}
      resizeOptions={{ geometry: pathPoseDescriptor }}
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

// <Canvas> drives both move and resize over a Path TPose. The kit machinery is
// rect-shaped, so plug in two small projections:
//   - resizeOptions.geometry: pathPoseDescriptor (read AABB, remap on resize)
//   - moveOptions.translatePose + pathOriginProjection (snap-to-grid on path origin)
// hitBody / boundsOf are explicit because the default rect-fold-in doesn't
// know how to AABB-test a Path; selectionOverlay reads boundsOf for handles.
return (
  <Canvas<PathObj, Path>
    width={W} height={H}
    adapter={adapter}
    handleHitRadius={HANDLE}
    hitBody={(wx, wy) => /* bounds-test path */}
    boundsOf={(id) => boundsOfPath(pathRef.current)}
    selectionOptions={{ initial: ['p'] }}
    onTapEmpty={() => {}}
    moveOptions={{
      translatePose: translatePath,
      behaviors: [snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection }))],
    }}
    resizeOptions={{ geometry: pathPoseDescriptor }}
    layers={{
      scene: { drawOne: (cx, _o, p) => { traceToContext(cx, p); cx.fill(); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
