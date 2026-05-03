import { useRef, useState } from 'react';
import {
  Canvas,
  PathBuilder,
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

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3];

export function BezierEditDemo() {
  const [path, setPath] = useState<Path>(INITIAL_PATH);
  const pathRef = useRef(path);
  pathRef.current = path;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const adapter: MoveAdapter<PathObj, Pose> & ResizeAdapter<PathObj, Pose> = {
    getObject: (id) => (id === ID ? { id } : undefined),
    getObjects: () => [{ id: ID }],
    getPose: () => pathRef.current,
    getParent: () => null,
    setPose: (_id, p) => setPath(p),
    setParent: () => {},
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

  // Scaled-canvas zoom: a CSS transform on the wrapper grows/shrinks the
  // canvas pixels visually without touching its internal coords. The custom
  // `clientToWorld` divides client→canvas-CSS-px by the live zoom so pointer
  // math stays in content units, and `handleHitRadius` is inversely scaled so
  // the user perceives the same screen-px tolerance at any zoom.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={appendCurve}
          style={btn}
        >Add point</button>
        <span style={{ width: 12 }} />
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            style={{
              ...btn,
              background: zoom === z ? '#7fb069' : '#2a2018',
              color: zoom === z ? '#1a130d' : '#d4c4a8',
            }}
          >{z}×</button>
        ))}
      </div>
      <div style={{ width: W * zoom, height: H * zoom, overflow: 'hidden' }}>
        <div style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <Canvas<PathObj, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      tool="none"
      handleHitRadius={HANDLE / zoom}
      clientToWorld={(canvas, cx, cy) => {
        const r = canvas.getBoundingClientRect();
        const z = zoomRef.current;
        return [(cx - r.left) / z, (cy - r.top) / z];
      }}
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
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  background: '#2a2018', color: '#d4c4a8',
  border: '1px solid #4a3c2e', borderRadius: 3,
};

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
//
// Zoom is a CSS transform on the wrapper — the canvas pixels grow visually
// without changing internal coords. \`clientToWorld\` divides by zoom so
// pointer math stays in content units; \`handleHitRadius\` is inversely
// scaled so the user-perceived hit tolerance is constant in screen px.
return (
  <div style={{ width: W * zoom, height: H * zoom, overflow: 'hidden' }}>
    <div style={{ width: W, height: H, transform: \`scale(\${zoom})\`, transformOrigin: '0 0' }}>
      <Canvas<PathObj, Path>
        width={W} height={H}
        adapter={adapter}
        tool="none"
        editAnchors
        handleHitRadius={HANDLE / zoom}
        clientToWorld={(canvas, cx, cy) => {
          const r = canvas.getBoundingClientRect();
          return [(cx - r.left) / zoomRef.current, (cy - r.top) / zoomRef.current];
        }}
        layers={{
          scene: { drawOne: (cx, _o, p) => { cx.strokeStyle = '#f5b7a3'; cx.lineWidth = 2; traceToContext(cx, p); cx.stroke(); } },
          selectionOverlay: { handles: { size: HANDLE } },
          anchorEditOverlay: { selectedAnchorFill: '#7fb069' },
        }}
      />
    </div>
  </div>
);
`;
