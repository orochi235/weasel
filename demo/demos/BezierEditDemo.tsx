import { useRef, useState } from 'react';
import {
  Canvas,
  PathBuilder,
  pathPoseDescriptor,
  boundsOfPath,
  pointInPath,
  traceToContext,
  PATH_C,
} from '@orochi235/weasel';
import type {
  Path,
  PolygonPath,
  MoveAdapter,
  ResizeAdapter,
} from '@orochi235/weasel';

interface PathObj { id: string }
type Pose = Path;

const W = 720, H = 360, HANDLE = 8;
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

  const appendCurve = () => {
    const p = pathRef.current;
    if (p.kind !== 'polygon') return;
    // Every command (M/L/C/Q) ends on (x,y), so the trailing pair of coords
    // is the current end of the path. Append a cubic ~80px to the right.
    const cs = p.coords;
    const ex = cs[cs.length - 2];
    const ey = cs[cs.length - 1];
    const nx = ex + 80;
    const ny = ey + (Math.random() < 0.5 ? -40 : 40);
    const c1x = ex + 30, c1y = ey - 30;
    const c2x = nx - 30, c2y = ny - 30;
    const nextCmds = new Uint8Array(p.commands.length + 1);
    nextCmds.set(p.commands);
    nextCmds[p.commands.length] = PATH_C;
    const nextCoords = new Float32Array(cs.length + 6);
    nextCoords.set(cs);
    nextCoords.set([c1x, c1y, c2x, c2y, nx, ny], cs.length);
    const next: PolygonPath = { kind: 'polygon', commands: nextCmds, coords: nextCoords, fillRule: p.fillRule };
    setPath(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <button
          onClick={appendCurve}
          style={{
            padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            background: '#2a2018', color: '#d4c4a8',
            border: '1px solid #4a3c2e', borderRadius: 3,
          }}
        >Add point</button>
      </div>
      <Canvas<PathObj, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      geometry={pathPoseDescriptor}
      handleHitRadius={HANDLE}
      hitBody={hitBody}
      onTapEmpty={() => {}}
      editAnchors
      layers={{
        scene: {
          drawOne: (cx, _o, p) => {
            cx.strokeStyle = '#f5b7a3';
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
    </div>
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
    geometry={pathPoseDescriptor}
    hitBody={hitBody}
    editAnchors
    layers={{
      scene: { drawOne: (cx, _o, p) => { cx.strokeStyle = '#f5b7a3'; cx.lineWidth = 2; traceToContext(cx, p); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
      anchorEditOverlay: { selectedAnchorFill: '#7fb069' },
    }}
  />
);
`;
