import { useRef, useState } from 'react';
import {
  Canvas,
  PathBuilder,
  pathPoseDescriptor,
  PATH_C,
  countPathAnchors,
  selectFromMarquee,
  useSelection,
  useSelectWithAnchorEdit,
} from '@orochi235/weasel';
import type {
  Path,
  PolygonPath,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

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

function rainbowColors(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 360) / Math.max(1, n);
    const [r, g, b] = hslToRgb(h, 0.8, 0.6);
    out.push(r, g, b, 1);
  }
  return out;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

export function BezierEditDemo() {
  const [path, setPath] = useState<Path>(INITIAL_PATH);
  const pathRef = useRef(path);
  pathRef.current = path;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const selection = useSelection();

  const adapter = {
    getNode: (id: string) => (id === ID ? { id } : undefined),
    getNodes: () => [{ id: ID }],
    getPose: () => pathRef.current,
    setPose: (_id: string, p: Pose) => setPath(p),
    // hitTestArea + applyOps: required for drag-marquee selection to work.
    // useSelectTool's areaSelectCapable check requires hitTestArea AND
    // applyOps AND getSelection AND setSelection — the demo previously had
    // only the last two via useSelection.adapterMethods, so the marquee
    // gesture silently dropped its selection ops. The path's pointInPath
    // hit-test fails for open polylines, so drag-marquee is the only
    // working selection path.
    hitTestArea: (rect: { x: number; y: number; width: number; height: number }) => {
      const b = pathPoseDescriptor.getBounds(pathRef.current);
      const ix = Math.max(rect.x, b.x);
      const iy = Math.max(rect.y, b.y);
      const iw = Math.min(rect.x + rect.width, b.x + b.width) - ix;
      const ih = Math.min(rect.y + rect.height, b.y + b.height) - iy;
      return iw > 0 && ih > 0 ? [ID] : [];
    },
    applyOps: (ops: import('@orochi235/weasel').Op[]) => {
      for (const op of ops) op.apply(adapter);
    },
    ...selection.adapterMethods,
  };

  const { tools, onDoubleClick } = useSelectWithAnchorEdit<PathObj, Pose>(adapter, {
    // pointInPath only fills closed regions, so an S-curve has no body to
    // hit. Approximate stroke-hit: AABB containment with an 8-px slop.
    // Lets click + double-click work on the visible curve.
    pickEvery: (wx, wy) => {
      const b = pathPoseDescriptor.getBounds(pathRef.current);
      const slop = 8;
      const inside = wx >= b.x - slop && wx <= b.x + b.width + slop
        && wy >= b.y - slop && wy <= b.y + b.height + slop;
      return inside ? [ID] : [];
    },
    boundsOf: (id) => (id === ID ? pathPoseDescriptor.getBounds(pathRef.current) : null),
    handleHitRadius: HANDLE / zoom,
    resize: { geometry: pathPoseDescriptor },
    // Marquee is opt-in at the kit level — restored here because pointInPath
    // hit-testing fails on the open polyline, so drag-marquee is the only
    // working selection path.
    areaSelect: { behaviors: [selectFromMarquee()] },
    drawGhost: (_o, p): DrawCommand[] => {
      const colors = rainbowColors(countPathAnchors(p));
      return [{
        kind: 'path',
        path: p,
        stroke: { paint: { color: '#ffffff' }, width: 2, vertexColors: colors },
      }];
    },
    getNode: (id) => (id === ID ? { id } : null),
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
                drawOne: (_o, p): DrawCommand[] => {
                  const colors = rainbowColors(countPathAnchors(p));
                  return [{
                    kind: 'path',
                    path: p,
                    stroke: { paint: { color: '#ffffff' }, width: 2, vertexColors: colors },
                  }];
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
