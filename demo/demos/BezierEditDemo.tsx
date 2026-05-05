import { useMemo, useRef, useState } from 'react';
import {
  Canvas,
  PathBuilder,
  pathPoseDescriptor,
  pointInPath,
  PATH_C,
  traceToContext,
  useEditAnchors,
  useEditAnchorsTool,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type {
  EditAnchorsAdapter,
  Path,
  PolygonPath,
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const selection = useSelection();

  const adapter = {
    getObject: (id: string) => (id === ID ? { id } : undefined),
    getObjects: () => [{ id: ID }],
    getPose: () => pathRef.current,
    getParent: () => null,
    setPose: (_id: string, p: Pose) => setPath(p),
    setParent: () => {},
    ...selection.adapterMethods,
    hitTestArea: () => [],
    applyOps: () => {},
  };

  const select = useSelectTool<PathObj, Pose>(adapter, {
    hitBody: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
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
    getObject: (id) => (id === ID ? { id } : null),
  });

  // Anchor-edit gesture — driven by the tool dispatcher when 'edit-anchors'
  // is the active slot. The consumer owns `editingId`: set it on dbl-click,
  // clear it on Esc (via the tool's `onExit`).
  const editAnchorsAdapter = useMemo<EditAnchorsAdapter<PathObj>>(() => ({
    getObject: (id) => (id === ID ? { id } : undefined),
    getPose: () => pathRef.current,
    setPose: (_id, p) => setPath(p),
  }), []);
  const editAnchorsCtl = useEditAnchors<PathObj>(editAnchorsAdapter, {
    editingId,
    hitRadius: HANDLE / zoom,
  });
  const editAnchorsTool = useEditAnchorsTool(editAnchorsCtl, {
    onExit: () => setEditingId(null),
    overlayStyle: { selectedAnchorFill: '#7fb069' },
  });

  const tools = useTools({
    active: editingId ? 'edit-anchors' : 'select',
    registry: { select, 'edit-anchors': editAnchorsTool },
  });

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const canvas = target.tagName === 'CANVAS'
      ? (target as HTMLCanvasElement)
      : target.querySelector('canvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const z = zoomRef.current;
    const wx = (e.clientX - r.left) / z;
    const wy = (e.clientY - r.top) / z;
    if (pointInPath(pathRef.current, wx, wy)) setEditingId(ID);
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
      <div
        style={{ width: W * zoom, height: H * zoom, overflow: 'hidden' }}
        onDoubleClick={onDoubleClick}
      >
        <div style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <Canvas
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
            onTapEmpty={() => {}}
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

// Demo owns the editingId state. Double-click a polygon body → enter edit
// mode (active tool flips to 'edit-anchors'). Esc → onExit clears
// editingId, which flips the active tool back to 'select'.
const [editingId, setEditingId] = useState<string | null>(null);

const select = useSelectTool<PathObj, Path>(adapter, {
  hitBody: (wx, wy) => (pointInPath(pathRef.current, wx, wy) ? [ID] : []),
  boundsOf: (id) => pathPoseDescriptor.getBounds(pathRef.current),
  resize: { geometry: pathPoseDescriptor },
  drawGhost: (cx, _o, p) => { /* trace path */ },
  getObject: (id) => /* lookup */,
});

const editAnchorsAdapter = useMemo<EditAnchorsAdapter<PathObj>>(() => ({
  getObject: (id) => (id === ID ? { id } : undefined),
  getPose: () => pathRef.current,
  setPose: (_id, p) => setPath(p),
}), []);
const editAnchorsCtl = useEditAnchors(editAnchorsAdapter, { editingId, hitRadius: HANDLE / zoom });
const editAnchorsTool = useEditAnchorsTool(editAnchorsCtl, {
  onExit: () => setEditingId(null),
  overlayStyle: { selectedAnchorFill: '#7fb069' },
});

const tools = useTools({
  active: editingId ? 'edit-anchors' : 'select',
  registry: { select, 'edit-anchors': editAnchorsTool },
});

return (
  <div onDoubleClick={(e) => /* if pointInPath → setEditingId(ID) */}>
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
