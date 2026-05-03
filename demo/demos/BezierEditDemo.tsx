import { useRef, useState } from 'react';
import {
  Canvas,
  PathBuilder,
  pathPoseDescriptor,
  translatePath,
  boundsOfPath,
  pointInPath,
  traceToContext,
} from '@orochi235/weasel';
import type {
  Path,
  MoveAdapter,
  ResizeAdapter,
} from '@orochi235/weasel';

interface PathObj { id: string }
type Pose = Path;

const W = 480, H = 320, HANDLE = 8;
const ID = 'curve';

// An open S-curve: two cubic segments back to back.
const INITIAL_PATH: Path = new PathBuilder()
  .moveTo(60, 220)
  .curveTo(140, 60, 220, 60, 260, 160)
  .curveTo(300, 260, 380, 260, 420, 100)
  .build();

export function BezierEditDemo() {
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

  // Hit-test the curve's silhouette generously: the open path has no fill, so
  // augment with an AABB padding so single-click still selects.
  const hitBody = (wx: number, wy: number): string | null => {
    const p = pathRef.current;
    if (pointInPath(p, wx, wy)) return ID;
    const b = boundsOfPath(p);
    const PAD = 10;
    if (wx >= b.x - PAD && wx <= b.x + b.width + PAD && wy >= b.y - PAD && wy <= b.y + b.height + PAD) return ID;
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
      onTapEmpty={() => {}}
      moveOptions={{ translatePose: translatePath }}
      resizeOptions={{ geometry: pathPoseDescriptor }}
      editAnchors
      layers={{
        scene: {
          drawOne: (cx, _o, p) => {
            cx.strokeStyle = '#1a130d';
            cx.lineWidth = 2;
            cx.beginPath();
            traceToContext(cx, p);
            cx.stroke();
          },
        },
        selectionOverlay: { handles: { size: HANDLE } },
        anchorEditOverlay: { selectedAnchorFill: '#7fb069' },
      }}
    />
  );
}

export const BEZIER_EDIT_DEMO_SOURCE = `// --- Bezier control-point editing (Figma-style modal entry) ---
const INITIAL_PATH = new PathBuilder()
  .moveTo(60, 220)
  .curveTo(140, 60, 220, 60, 260, 160)
  .curveTo(300, 260, 380, 260, 420, 100)
  .build();

// Canvas owns the editAnchors state. Double-click a polygon-shaped object's
// body to enter edit mode; Esc exits. While editing, anchor + control-handle
// circles render via the anchorEditOverlay slot, and the selection AABB for
// the editing object is suppressed.
//
// v1 corner-only behavior: dragging an anchor moves only its on-curve coord;
// adjacent control handles stay where they are in world space (no smoothing
// yet — that's the deferred next iteration).
return (
  <Canvas<PathObj, Path>
    width={W} height={H}
    adapter={adapter}
    hitBody={hitBody}
    boundsOf={boundsOf}
    moveOptions={{ translatePose: translatePath }}
    resizeOptions={{ geometry: pathPoseDescriptor }}
    editAnchors
    layers={{
      scene: { drawOne: (cx, _o, p) => { traceToContext(cx, p); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
      anchorEditOverlay: { selectedAnchorFill: '#7fb069' },
    }}
  />
);
`;
