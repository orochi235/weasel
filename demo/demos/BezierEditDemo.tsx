import { useRef, useState } from 'react';
import {
  Canvas,
  PathBuilder,
  pathPoseDescriptor,
  pointInPath,
  PATH_C,
  traceToContext,
  useSelection,
  useSelectWithAnchorEdit,
} from '@orochi235/weasel';
import type {
  Path,
  PolygonPath,
} from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useBackend } from '../BackendContext';

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
  const backend = useBackend();
  const [path, setPath] = useState<Path>(INITIAL_PATH);
  const pathRef = useRef(path);
  pathRef.current = path;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const selection = useSelection();

  const adapter = {
    getObject: (id: string) => (id === ID ? { id } : undefined),
    getObjects: () => [{ id: ID }],
    getPose: () => pathRef.current,
    setPose: (_id: string, p: Pose) => setPath(p),
    ...selection.adapterMethods,
  };

  const { tools, onDoubleClick } = useSelectWithAnchorEdit<PathObj, Pose>(adapter, {
    pickEvery: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
    boundsOf: (id) => (id === ID ? pathPoseDescriptor.getBounds(pathRef.current) : null),
    handleHitRadius: HANDLE / zoom,
    resize: { geometry: pathPoseDescriptor },
    drawGhost: (cx, _o, p) => {
      cx.strokeStyle = '#f5b7a3';
      cx.lineWidth = 2;
      cx.beginPath();
      traceToContext(cx, p);
      cx.stroke();
    },
    drawGhostGL: (_o, p): DrawCommand[] => [{
      kind: 'path',
      path: p,
      stroke: { paint: { color: '#f5b7a3' }, width: 2 },
    }],
    getObject: (id) => (id === ID ? { id } : null),
    editAnchors: {
      hitRadius: HANDLE / zoom,
      overlayStyle: { selectedAnchorFill: '#7fb069' },
    },
    editingFilter: (ids) => (ids.includes(ID) ? ID : null),
    clientToWorld: (canvas, cx, cy) => {
      const r = canvas.getBoundingClientRect();
      const z = zoomRef.current;
      return [(cx - r.left) / z, (cy - r.top) / z];
    },
  });


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
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={appendCurve} style={btn}>Add point</button>
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
      <div onDoubleClick={onDoubleClick} style={{ width: W * zoom, height: H * zoom, overflow: 'hidden' }}>
        <div style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <Canvas
backend={backend}
                  width={W}
            height={H}
            className="ckd-canvas"
            adapter={adapter}
            selection={selection}
            tools={tools}
            clientToWorld={(canvas, cx, cy) => {
              const r = canvas.getBoundingClientRect();
              const z = zoomRef.current;
              return [(cx - r.left) / z, (cy - r.top) / z];
            }}
            layers={{
              scene: {
                drawOne: (cx, _o, p) => {
                  cx.strokeStyle = '#f5b7a3';
                  cx.lineWidth = 2;
                  cx.beginPath();
                  traceToContext(cx, p);
                  cx.stroke();
                },
                drawOneGL: (_o, p): DrawCommand[] => [{
                  kind: 'path',
                  path: p,
                  stroke: { paint: { color: '#f5b7a3' }, width: 2 },
                }],
              },
              selectionOverlay: { handles: { size: HANDLE } },
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

// useSelectWithAnchorEdit composes select + edit-anchors with the modal
// "double-click body → edit anchors; Escape → back to select" flip wired
// internally. The demo no longer owns editingId.
const { tools, onDoubleClick } = useSelectWithAnchorEdit<PathObj, Path>(adapter, {
  pickEvery: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
  boundsOf: (id) => pathPoseDescriptor.getBounds(pathRef.current),
  resize: { geometry: pathPoseDescriptor },
  drawGhost: (cx, _o, p) => { /* trace path */ },
  getObject: (id) => /* lookup */,
  editAnchors: {
    hitRadius: HANDLE / zoom,
    overlayStyle: { selectedAnchorFill: '#7fb069' },
  },
  editingFilter: (ids) => (ids.includes(ID) ? ID : null),
  clientToWorld: (canvas, cx, cy) => /* zoom-aware */,
});

return (
  <div onDoubleClick={onDoubleClick}>
    <Canvas
      adapter={adapter} selection={selection} tools={tools}
      clientToWorld={(canvas, cx, cy) => /* zoom-aware */}
      layers={{
        scene: { drawOne: (cx, _o, p) => { /* trace path */ } },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  </div>
);
`;
